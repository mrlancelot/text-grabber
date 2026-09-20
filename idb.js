const DB_NAME = "tg-db";
const STORE = "handles";
const KEY = "folder";
const PROFILE_STORE = "profile";
const PROFILE_KEY = "current";
const APPLICATIONS_STORE = "applications";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
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
