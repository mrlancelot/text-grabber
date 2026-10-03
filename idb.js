const DB_NAME = "tg-db";
const STORE = "handles";
const KEY = "folder";
const PROFILE_STORE = "profile";
const PROFILE_KEY = "current";
const APPLICATIONS_STORE = "applications";
const ANSWERS_STORE = "answers";
const ANSWERS_KEY = "current";
const LEARNED_STORE = "learned";
const FILES_STORE = "files";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE);
      }
      if (!db.objectStoreNames.contains(APPLICATIONS_STORE)) {
        db.createObjectStore(APPLICATIONS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(ANSWERS_STORE)) {
        db.createObjectStore(ANSWERS_STORE);
      }
      if (!db.objectStoreNames.contains(LEARNED_STORE)) {
        db.createObjectStore(LEARNED_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getFolderHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function setFolderHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProfile() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILE_STORE, "readonly");
    const req = tx.objectStore(PROFILE_STORE).get(PROFILE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function setProfile(profile) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILE_STORE, "readwrite");
    tx.objectStore(PROFILE_STORE).put(profile, PROFILE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function createApplication(record) {
  const db = await openDb();
  const id = record.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toStore = { ...record, id };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APPLICATIONS_STORE, "readwrite");
    tx.objectStore(APPLICATIONS_STORE).put(toStore);
    tx.oncomplete = () => resolve(toStore);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getApplication(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APPLICATIONS_STORE, "readonly");
    const req = tx.objectStore(APPLICATIONS_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function findApplicationByUrl(url) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APPLICATIONS_STORE, "readonly");
    const req = tx.objectStore(APPLICATIONS_STORE).getAll();
    req.onsuccess = () => {
      const matches = (req.result || []).filter((a) => a.url === url);
      resolve(matches.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))[0] || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateApplication(id, patch) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APPLICATIONS_STORE, "readwrite");
    const store = tx.objectStore(APPLICATIONS_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) {
        reject(new Error(`No application found with id ${id}`));
        return;
      }
      store.put({ ...existing, ...patch });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getValue(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function putValue(storeName, value, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    if (key === undefined) tx.objectStore(storeName).put(value);
    else tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Personal answers (work authorization, EEO, salary, ...) keyed by canonical field key.
export function getAnswers() {
  return getValue(ANSWERS_STORE, ANSWERS_KEY);
}

export function setAnswers(answers) {
  return putValue(ANSWERS_STORE, answers, ANSWERS_KEY);
}

// Answers the user typed into questions the extension couldn't fill, reused next time.
export async function listLearned() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEARNED_STORE, "readonly");
    const req = tx.objectStore(LEARNED_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export function putLearned(entry) {
  return putValue(LEARNED_STORE, entry);
}

export async function deleteLearned(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEARNED_STORE, "readwrite");
    tx.objectStore(LEARNED_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Files to upload into forms, e.g. "resume" -> { name, type, blob }.
export function getFile(key) {
  return getValue(FILES_STORE, key);
}

export function setFile(key, file) {
  return putValue(FILES_STORE, file, key);
}
