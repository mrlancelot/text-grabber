export async function nextFilename() {
  const { tgFileCounter = 0 } = await chrome.storage.local.get("tgFileCounter");
  const next = tgFileCounter + 1;
  await chrome.storage.local.set({ tgFileCounter: next });
  return `${next}.txt`;
}
