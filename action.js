const $ = (sel) => document.querySelector(sel);
const send = (message) => new Promise((resolve) => chrome.runtime.sendMessage(message, (r) => resolve(chrome.runtime.lastError ? null : r)));

$(".workspace").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const url = tab?.url ? new URL(tab.url) : null;

if (url && /^https?:$/.test(url.protocol)) {
  const host = url.hostname.replace(/^www\./, "");
  const pattern = `*://${url.hostname}/*`;
  const toggle = $(".toggle-site");
  let mine = false;
  $(".site").hidden = false;
  $(".host").textContent = host;

  async function draw() {
    const [allowed, sites] = await Promise.all([chrome.permissions.contains({ origins: [pattern] }), send({ type: "TG_LIST_SITES" })]);
    mine = (sites || []).includes(pattern);
    toggle.hidden = allowed && !mine;
    toggle.className = `btn wide ${mine ? "" : "prominent"}`;
    toggle.textContent = mine ? "Turn off on this site" : `Enable Pave on ${host}`;
    $(".note").textContent = !allowed
      ? "Pave isn't on this site yet. Enable it to autofill applications and save jobs here."
      : mine
        ? "You added this site. Pave runs here automatically."
        : "Pave runs here automatically.";
  }

  toggle.addEventListener("click", async () => {
    await (mine ? chrome.permissions.remove({ origins: [pattern] }) : chrome.permissions.request({ origins: [pattern] }));
    await draw();
  });

  await draw();
}
