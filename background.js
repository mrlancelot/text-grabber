import { getFolderHandle, setProfile, createApplication } from "./idb.js";
import { nextFilename } from "./counter.js";
import { runStructured } from "./ai.js";
import { resumeProfileSchema, jobDescriptionSchema } from "./schemas.js";

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TG_SAVE_TEXT") {
    (async () => {
      try {
        const handle = await getFolderHandle();

        if (handle) {
          const permission = await handle.queryPermission({ mode: "readwrite" });
          if (permission === "granted") {
            const filename = await nextFilename(handle);
            await writeFile(handle, filename, message.text);
            sendResponse({ ok: true, folderName: handle.name });
            return;
          }
        }

        await chrome.storage.local.set({
          tgPending: { text: message.text },
        });
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: false, needsFolder: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }

  if (message.type === "TG_LOAD_PROFILE") {
    (async () => {
      const result = await runStructured(
        "You extract structured resume data from a person's Markdown resume. Only use facts present in the text — never invent experience, dates, or skills.",
        message.markdown,
        resumeProfileSchema
      );
      if (result.ok) {
        await setProfile(result.data);
        sendResponse({ ok: true, profile: result.data });
      } else {
        sendResponse({ ok: false, status: result.status, reason: result.reason });
      }
    })();
    return true;
  }

  if (message.type === "TG_EXTRACT_JD") {
    (async () => {
      const result = await runStructured(
        "You extract structured job posting data from raw job listing page text. Only use facts present in the text — never invent requirements or details.",
        message.text,
        jobDescriptionSchema
      );
      if (result.ok) {
        const record = await createApplication({
          url: message.url,
          savedAt: new Date().toISOString(),
          jdRaw: message.text,
          jdStructured: result.data,
          tailoredResume: null,
          status: "extracted",
        });
        sendResponse({ ok: true, id: record.id, jdStructured: result.data });
      } else {
        sendResponse({ ok: false, status: result.status, reason: result.reason });
      }
    })();
    return true;
  }
});

async function writeFile(dirHandle, filename, text) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}
