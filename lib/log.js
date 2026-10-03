let enabled = false;

export const ready = chrome.storage.local.get("tgDebug").then((r) => {
  enabled = !!r.tgDebug;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.tgDebug) enabled = !!changes.tgDebug.newValue;
});

export function log(step, data) {
  if (enabled) console.log("[TG]", step, data ?? "");
}

export function table(step, rows) {
  if (!enabled) return;
  console.log("[TG]", step);
  console.table(rows);
}
