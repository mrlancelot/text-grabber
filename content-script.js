(function () {
  if (document.getElementById("tg-popup")) return;

  function extractPageText() {
    const header = `Title: ${document.title}\nURL: ${location.href}\nSaved: ${new Date().toISOString()}\n\n---\n\n`;
    return header + document.body.innerText.trim();
  }

  function createPopup() {
    const el = document.createElement("div");
    el.id = "tg-popup";
    el.innerHTML = `
      <div class="tg-icon">📄</div>
      <div class="tg-text">
        <strong>Save this job posting?</strong>
        <span class="tg-status">Grab the page text as a .txt file</span>
      </div>
      <button class="tg-save">Save</button>
      <button class="tg-close" title="Dismiss">×</button>
    `;
    (document.body || document.documentElement).appendChild(el);

    const statusEl = el.querySelector(".tg-status");
    const saveBtn = el.querySelector(".tg-save");
    const closeBtn = el.querySelector(".tg-close");

    closeBtn.addEventListener("click", () => el.remove());

    saveBtn.addEventListener("click", () => {
      if (el.classList.contains("tg-saved")) return;
      statusEl.textContent = "Saving…";
      chrome.runtime.sendMessage(
        {
          type: "TG_SAVE_TEXT",
          text: extractPageText(),
        },
        (response) => {
          if (chrome.runtime.lastError) {
            statusEl.textContent = "Error — try again";
            return;
          }
          if (response && response.ok) {
            el.classList.add("tg-saved");
            saveBtn.textContent = "Saved ✓";
            statusEl.textContent = `Saved to ${response.folderName || "chosen folder"}`;
            setTimeout(() => el.remove(), 4000);
          } else if (response && response.needsFolder) {
            statusEl.textContent = "Choose a save folder in the tab that just opened…";
          } else {
            statusEl.textContent = response?.error || "Could not save — try again";
          }
        }
      );
    });
  }

  createPopup();
})();
