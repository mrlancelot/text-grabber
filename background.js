import { getFolderHandle } from "./idb.js";
import { nextFilename } from "./counter.js";

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "TG_SAVE_TEXT") return;

  (async () => {
    try {
      const handle = await getFolderHandle();

      if (handle) {
        const permission = await handle.queryPermission({ mode: "readwrite" });
        if (permission === "granted") {
          const filename = await nextFilename();
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
});

async function writeFile(dirHandle, filename, text) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}
