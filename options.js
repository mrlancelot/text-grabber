import { getFolderHandle, setFolderHandle, getProfile } from "./idb.js";
import { nextFilename } from "./counter.js";

const currentFolderEl = document.getElementById("currentFolder");
const pendingNoticeEl = document.getElementById("pendingNotice");
const chooseBtn = document.getElementById("chooseBtn");
const statusEl = document.getElementById("status");
const profileSummaryEl = document.getElementById("profileSummary");
const loadProfileBtn = document.getElementById("loadProfileBtn");
const profileStatusEl = document.getElementById("profileStatus");

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

  const filename = await nextFilename(handle);
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(tgPending.text);
  await writable.close();
  await chrome.storage.local.remove("tgPending");
  return true;
}

function describeProfile(profile) {
  const name = profile?.contact?.name;
  const roles = (profile?.experience || []).length;
  return `Loaded: ${name || "profile"} — ${roles} experience ${roles === 1 ? "entry" : "entries"}.`;
}

async function refreshProfileDisplay() {
  const profile = await getProfile();
  profileSummaryEl.textContent = profile ? describeProfile(profile) : "No profile loaded yet.";
}

async function init() {
  const { tgPending } = await chrome.storage.local.get("tgPending");
  pendingNoticeEl.style.display = tgPending ? "block" : "none";
  await refreshFolderDisplay();
  await refreshProfileDisplay();
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

loadProfileBtn.addEventListener("click", async () => {
  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [{ description: "Markdown resume", accept: { "text/markdown": [".md", ".markdown"] } }],
    });
    const file = await fileHandle.getFile();
    const markdown = await file.text();

    profileStatusEl.textContent = "Reading with Gemini Nano — this may take a moment on first use…";
    loadProfileBtn.disabled = true;

    chrome.runtime.sendMessage({ type: "TG_LOAD_PROFILE", markdown }, async (response) => {
      loadProfileBtn.disabled = false;
      if (chrome.runtime.lastError) {
        profileStatusEl.textContent = "Error — try again";
        return;
      }
      if (response && response.ok) {
        profileStatusEl.textContent = "Profile loaded successfully.";
        await refreshProfileDisplay();
      } else if (response && response.status === "unavailable") {
        profileStatusEl.textContent = `Gemini Nano isn't available: ${response.reason || "unsupported device."}`;
      } else if (response && response.status === "downloading") {
        profileStatusEl.textContent = "Gemini Nano is still downloading on this device. Try again shortly.";
      } else {
        profileStatusEl.textContent = response?.reason || "Could not parse profile — try again";
      }
    });
  } catch (err) {
    loadProfileBtn.disabled = false;
    if (err && err.name === "AbortError") return;
    profileStatusEl.textContent = `Error: ${err.message || err}`;
  }
});

init();
