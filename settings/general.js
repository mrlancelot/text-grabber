import { getFolderHandle, setFolderHandle } from "../idb.js";
import { nextFilename } from "../counter.js";
import { el, paneHeader, group, row, toggle, button, send } from "./ui.js";

const NANO_STATUS = {
  ok: ["var(--green)", "Ready"],
  downloading: ["var(--yellow)", "Downloading"],
  unavailable: ["var(--red)", "Unavailable"],
};

export const ai = {
  id: "ai",
  title: "AI & Privacy",
  color: "var(--green)",
  iconName: "sparkles",
  keywords: "gemini nano ai model privacy field memory cache clear on-device",

  async render(root) {
    const header = paneHeader("AI & Privacy", "Matching and writing run on Gemini Nano, inside Chrome on this device.");
    const status = el("span", { className: "status-value callout secondary", textContent: "Checking…" });
    const memory = el("span", { className: "callout secondary" });

    async function drawMemory() {
      const { tgFieldCache } = await chrome.storage.local.get("tgFieldCache");
      const n = Object.keys(tgFieldCache || {}).length;
      memory.textContent = `${n} remembered ${n === 1 ? "match" : "matches"}`;
    }

    root.replaceChildren(
      header.node,
      group("On-device model", [row("Gemini Nano", status)], "Your profile, answers and resume never leave this device. Nothing is sent to a server."),
      group(
        "Field memory",
        [
          row(
            "Form fields",
            el(
              "div",
              { className: "inline" },
              memory,
              button("Clear", "", async () => {
                await chrome.storage.local.remove("tgFieldCache");
                await drawMemory();
                header.saved();
              })
            )
          ),
        ],
        "When the AI matches a form question to your data, the match is remembered so the next form fills instantly."
      )
    );
    drawMemory();

    const result = (await send({ type: "TG_NANO_STATUS" })) || { status: "unavailable", reason: "No response from the extension." };
    const [color, label] = NANO_STATUS[result.status] || NANO_STATUS.unavailable;
    status.replaceChildren(el("span", { className: "dot", style: `background: ${color}` }), result.reason && result.status !== "ok" ? `${label} — ${result.reason}` : label);
  },
};

async function writePending(handle) {
  const { tgPending } = await chrome.storage.local.get("tgPending");
  if (!tgPending) return false;
  const file = await handle.getFileHandle(await nextFilename(handle), { create: true });
  const writable = await file.createWritable();
  await writable.write(tgPending.text);
  await writable.close();
  await chrome.storage.local.remove("tgPending");
  return true;
}

export const jobs = {
  id: "jobs",
  title: "Job Saving",
  color: "var(--blue)",
  iconName: "folder",
  keywords: "save job folder posting text files",

  async render(root) {
    const header = paneHeader("Job Saving", "Save Job writes the posting's text to a numbered file in this folder.");
    const note = el("div", { className: "group-footer footnote secondary" });

    async function draw() {
      const handle = await getFolderHandle();
      const { tgPending } = await chrome.storage.local.get("tgPending");
      root.replaceChildren(
        header.node,
        tgPending && el("div", { className: "banner" }, "A job posting is waiting to be saved. Choose a folder to finish."),
        group("Folder", [
          row(
            handle ? handle.name : "No folder chosen",
            button(handle ? "Change…" : "Choose…", "", async () => {
              try {
                const picked = await window.showDirectoryPicker();
                if ((await picked.requestPermission({ mode: "readwrite" })) !== "granted") return;
                await setFolderHandle(picked);
                note.textContent = (await writePending(picked)) ? "Saved the waiting job posting." : "";
                header.saved();
                draw();
              } catch (err) {
                if (err?.name !== "AbortError") note.textContent = `Error: ${err.message || err}`;
              }
            })
          ),
        ]),
        note
      );
    }

    await draw();
  },
};

export const debug = {
  id: "debug",
  title: "Debugging",
  color: "var(--red)",
  iconName: "ladybug",
  keywords: "debug logs console",

  async render(root) {
    const header = paneHeader("Debugging");
    const { tgDebug } = await chrome.storage.local.get("tgDebug");
    root.replaceChildren(
      header.node,
      group(
        null,
        [
          row(
            "Debug logs",
            toggle(tgDebug, async (on) => {
              await chrome.storage.local.set({ tgDebug: on });
              header.saved();
            })
          ),
        ],
        "Prints each autofill step to the page's console, and each Gemini Nano call to the extension's service worker console."
      )
    );
  },
};
