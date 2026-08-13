import { getFolderHandle, setFolderHandle } from "./idb.js";
import { nextFilename } from "./counter.js";

const currentFolderEl = document.getElementById("currentFolder");
const pendingNoticeEl = document.getElementById("pendingNotice");
const chooseBtn = document.getElementById("chooseBtn");
const statusEl = document.getElementById("status");

async function refreshFolderDisplay() {
  const handle = await getFolderHandle();
  if (handle) {
    currentFolderEl.textContent = "Saving to: ";
    const nameEl = document.createElement("span");
    nameEl.className = "folder-name";
    nameEl.textContent = handle.name;
    currentFolderEl.appendChild(nameEl);
    chooseBtn.textContent = "Change save folder";
  } else {
    currentFolderEl.textContent = "No save folder chosen yet.";
    chooseBtn.textContent = "Choose save folder";
  }
}

async function writePending(handle) {
  const { tgPending } = await chrome.storage.local.get("tgPending");
  if (!tgPending) return false;

  const filename = await nextFilename();
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(tgPending.text);
  await writable.close();
  await chrome.storage.local.remove("tgPending");
  return true;
}

async function init() {
  const { tgPending } = await chrome.storage.local.get("tgPending");
  pendingNoticeEl.style.display = tgPending ? "block" : "none";
  await refreshFolderDisplay();
}

chooseBtn.addEventListener("click", async () => {
  try {
    const handle = await window.showDirectoryPicker();
    const permission = await handle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      statusEl.textContent = "Permission denied for that folder.";
      return;
    }
    await setFolderHandle(handle);
    await refreshFolderDisplay();

    const saved = await writePending(handle);
    if (saved) {
      pendingNoticeEl.style.display = "none";
      statusEl.textContent = "Saved the pending job posting to this folder.";
    } else {
      statusEl.textContent = "Folder saved. Future job postings will save here automatically.";
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
    statusEl.textContent = `Error: ${err.message || err}`;
  }
});

init();
