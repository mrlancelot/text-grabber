import { BACKUP_STORES, readStore, replaceStores, clearAllStores } from "../idb.js";
import { el, paneHeader, group, row, button, pickFile } from "./ui.js";

const FORMAT = "text-grabber-backup";

const toB64 = (bytes) => btoa(Array.from(new Uint8Array(bytes), (b) => String.fromCharCode(b)).join(""));
const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

async function collect() {
  const stores = {};
  for (const name of BACKUP_STORES) {
    stores[name] = await Promise.all(
      (await readStore(name)).map(async ({ key, value }) =>
        value?.blob instanceof Blob ? { key, value: { ...value, blob: toB64(await value.blob.arrayBuffer()) } } : { key, value }
      )
    );
  }
  const settings = Object.fromEntries(Object.entries(await chrome.storage.local.get(null)).filter(([k]) => k.startsWith("tg") && k !== "tgPending"));
  return { stores, settings };
}

async function restore({ stores, settings }) {
  for (const entries of Object.values(stores)) {
    for (const entry of entries) if (typeof entry.value?.blob === "string") entry.value.blob = new Blob([fromB64(entry.value.blob)], { type: entry.value.type });
  }
  await replaceStores(stores);
  await chrome.storage.local.set(settings);
}

async function keyFrom(password, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function seal(data, password) {
  if (!password) return { format: FORMAT, version: 1, data };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(password, salt), new TextEncoder().encode(JSON.stringify(data)));
  return { format: FORMAT, version: 1, salt: toB64(salt), iv: toB64(iv), cipher: toB64(cipher) };
}

async function open(file) {
  if (file.format !== FORMAT) throw new Error("This isn't a Text Grabber backup.");
  if (file.data) return file.data;
  const password = prompt("This backup is password-protected. Enter its password:");
  if (!password) throw new Error("No password entered.");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(file.iv) }, await keyFrom(password, fromB64(file.salt)), fromB64(file.cipher)).catch(() => {
    throw new Error("Wrong password.");
  });
  return JSON.parse(new TextDecoder().decode(plain));
}

async function wipeModels() {
  for (const name of await caches.keys()) await caches.delete(name);
  const root = await navigator.storage.getDirectory();
  for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });
}

export default {
  id: "data",
  title: "Data & Privacy",
  color: "var(--blue)",
  iconName: "lock",
  keywords: "backup export import restore wipe delete storage privacy data",

  async render(root) {
    const header = paneHeader("Data & Privacy", "Everything stays in this browser. Back it up, move it, or erase it.");
    const note = el("div", { className: "group-footer footnote secondary" });
    const password = el("input", { className: "field", type: "password", placeholder: "Optional password" });
    const [{ usage = 0 }, counts] = await Promise.all([
      navigator.storage.estimate(),
      Promise.all(BACKUP_STORES.map(async (name) => [name, (await readStore(name)).length])),
    ]);
    const count = Object.fromEntries(counts);

    const exportButton = button("Export…", "prominent", async () => {
      const file = await seal(await collect(), password.value);
      const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" })), download: `text-grabber-backup-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(a.href);
      note.textContent = password.value ? "Backup saved and encrypted with your password." : "Backup saved.";
    });

    const importButton = button("Import…", "", async () => {
      try {
        const file = await pickFile("Text Grabber backup", { "application/json": [".json"] });
        if (!file || !confirm("Replace your current profile, answers and applications with this backup?")) return;
        await restore(await open(JSON.parse(await file.text())));
        header.saved();
        note.textContent = "Backup restored.";
      } catch (err) {
        note.textContent = err.message || String(err);
      }
    });

    const wipeButton = button("Erase everything…", "destructive", async () => {
      if (!confirm("Erase your profile, answers, applications, resumes, settings and downloaded models from this browser? This can't be undone.")) return;
      await Promise.all([clearAllStores(), chrome.storage.local.clear(), wipeModels()]);
      location.reload();
    });

    root.replaceChildren(
      header.node,
      group(
        "Privacy",
        [
          row("Where your data lives", el("span", { className: "callout secondary", textContent: "Only in this browser, on this device" })),
          row("What's sent to servers", el("span", { className: "callout secondary", textContent: "Nothing. The only downloads are AI models you choose to get." })),
        ],
        "No account, no tracking, no analytics. Autofill, tailoring and job checks all run locally."
      ),
      group("Stored here", [
        row("Total storage used", el("span", { className: "callout", textContent: mb(usage) })),
        row("Saved jobs", el("span", { className: "callout", textContent: String(count.applications) })),
        row("Saved answers", el("span", { className: "callout", textContent: String(count.learned) })),
        row("Resumes", el("span", { className: "callout", textContent: String(count.files) })),
      ]),
      group("Backup", [row("Password", password), row("Back up everything to a file", el("div", { className: "inline" }, importButton, exportButton))], "The backup includes your profile, answers, saved jobs, resumes and settings. With a password it's encrypted (AES-256)."),
      group("Erase", [row("Remove all data from this browser", wipeButton)]),
      note
    );
  },
};
