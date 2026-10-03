(function () {
  if (window.__tgTextGrabber) return;
  window.__tgTextGrabber = true;

  const url = (path) => chrome.runtime.getURL(path);
  let autofillModule = null;
  const loadAutofill = () => (autofillModule ??= import(url("autofill/main.js")));

  function countFormFields() {
    return document.querySelectorAll(
      'input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select, button[aria-haspopup="listbox"]'
    ).length;
  }

  function extractPageText() {
    const header = `Title: ${document.title}\nURL: ${location.href}\nSaved: ${new Date().toISOString()}\n\n---\n\n`;
    return header + document.body.innerText.trim();
  }

  const alive = () => !!chrome.runtime?.id;

  function send(message) {
    return new Promise((resolve) => {
      if (!alive()) return resolve(null);
      chrome.runtime.sendMessage(message, (response) => resolve(chrome.runtime.lastError ? null : response));
    });
  }

  const STATUS_LABEL = { filled: "Filled", review: "Review", needs: "Needs you" };

  let hudPromise = null;
  const getHud = () => (hudPromise ??= createHud());

  async function createHud() {
    const { icon } = await import(url("ui/icons.js"));
    for (const [family, file, weight] of [
      ["TG Unbounded", "Unbounded-SemiBold", "600"],
      ["TG Plex", "IBMPlexSans-Regular", "400"],
      ["TG Plex", "IBMPlexSans-Medium", "500"],
    ]) document.fonts.add(new FontFace(family, `url(${url(`ui/fonts/${file}.woff2`)})`, { weight }));
    const host = document.createElement("div");
    host.id = "tg-host";
    host.style.visibility = "hidden";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <link rel="stylesheet" href="${url("ui/tokens.css")}">
      <link rel="stylesheet" href="${url("ui/controls.css")}">
      <link rel="stylesheet" href="${url("ui/panel.css")}">
      <div class="hud" data-state="pill">
        <button class="pill"><span class="pill-label"></span><span class="pill-badge" hidden></span></button>
        <div class="card" role="dialog" aria-label="Text Grabber">
          <header>
            <div class="titles"><span class="title3 title"></span><span class="caption secondary subtitle"></span></div>
            <button class="close" aria-label="Close"></button>
          </header>
          <div class="body">
          <div class="progress" hidden><div class="bar"></div></div>
          <div class="status callout" aria-live="polite"><span class="text"></span></div>
          <div class="summary group" hidden>
            ${["filled", "review", "needs"].map((s) => `<button class="stat" data-status="${s}"><span class="title2 tabular num">0</span><span class="caption">${STATUS_LABEL[s]}</span></button>`).join("")}
          </div>
          <div class="attention" hidden><div class="caption secondary section-label">Needs attention</div><div class="group list"></div></div>
          <div class="banner" hidden></div>
          <button class="btn prominent large wide autofill">Autofill</button>
          <div class="actions">
            <button class="btn plain save">Save Job</button>
            <button class="btn plain analyze">Analyze Job</button>
          </div>
          <footer class="caption secondary"><span>Runs on this device</span></footer>
          </div>
        </div>
      </div>
    `;
    (document.body || document.documentElement).appendChild(host);
    await Promise.all([...shadow.querySelectorAll("link")].map((l) => new Promise((r) => (l.onload = l.onerror = r))));
    host.style.visibility = "";

    const $ = (sel) => shadow.querySelector(sel);
    const hud = $(".hud");
    const autofillBtn = $(".autofill");
    const saveBtn = $(".save");
    const analyzeBtn = $(".analyze");
    const statusText = $(".status .text");
    const spinner = icon("spinner", "spinner");
    let isForm = false;

    $(".close").append(icon("xmark"));
    saveBtn.prepend(icon("doc"));
    analyzeBtn.prepend(icon("sparkles"));
    $("footer").prepend(icon("lock"));
    $(".subtitle").textContent = location.hostname.replace(/^www\./, "");

    const expand = () => (hud.dataset.state = "card");
    const collapse = () => (hud.dataset.state = "pill");
    $(".pill").addEventListener("click", expand);
    $(".close").addEventListener("click", collapse);
    shadow.addEventListener("keydown", (e) => e.key === "Escape" && collapse());

    function setStatus(text, busy) {
      statusText.textContent = text;
      if (busy) statusText.before(spinner);
      else spinner.remove();
    }

    function banner(text) {
      const el = $(".banner");
      el.replaceChildren(icon("check"), document.createTextNode(text));
      el.hidden = false;
    }

    function showMode(form) {
      isForm = form;
      $(".pill-label").textContent = form ? "Autofill" : "Save Job";
      $(".title").textContent = form ? "Autofill" : "Save this job";
      autofillBtn.hidden = !form;
      setStatus(form ? "Fill this application from your profile." : "Save the posting or analyze it on-device.", false);
      if (form) loadAutofill().then((m) => m.warmUp()).catch(() => {});
    }

    function showProgress({ counts, items, done, total }) {
      $(".progress").hidden = false;
      $(".bar").style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
      $(".summary").hidden = false;
      for (const status of ["filled", "review", "needs"]) {
        const stat = $(`.stat[data-status="${status}"]`);
        stat.querySelector(".num").textContent = String(counts[status]);
        stat.classList.toggle("zero", !counts[status]);
      }
      const badge = $(".pill-badge");
      badge.hidden = !counts.needs;
      badge.textContent = String(counts.needs);
      $(".attention").hidden = !items.length;
      $(".list").replaceChildren(
        ...items.map((item) => {
          const row = document.createElement("button");
          row.className = "row clickable item";
          row.dataset.status = item.status;
          const texts = document.createElement("span");
          texts.className = "texts";
          const label = document.createElement("span");
          label.className = "headline";
          label.textContent = item.label;
          const reason = document.createElement("span");
          reason.className = "footnote secondary";
          reason.textContent = item.reason;
          texts.append(label, reason);
          row.append(icon("warning", "status-icon"), texts, icon("chevron", "chevron"));
          row.addEventListener("click", async () => !stale() && (await loadAutofill()).scrollToUid(item.uid));
          return row;
        })
      );
    }

    for (const status of ["filled", "review", "needs"]) {
      $(`.stat[data-status="${status}"]`).addEventListener("click", async () => !stale() && (await loadAutofill()).scrollToNext(status));
    }

    function stale() {
      if (alive()) return false;
      expand();
      setStatus("Text Grabber was updated. Reload this page to use it.", false);
      return true;
    }

    async function runAutofill() {
      if (stale()) return;
      expand();
      autofillBtn.disabled = true;
      setStatus("Getting ready", true);
      try {
        const counts = await (await loadAutofill()).autofill({ onProgress: showProgress, onStatus: setStatus });
        if (counts.stale) return stale();
        if (counts.empty) setStatus("No form fields found here.", false);
        $(".bar").style.width = "100%";
        autofillBtn.textContent = "Fill Again";
      } catch (err) {
        setStatus(`Autofill failed: ${err && err.message ? err.message : err}`, false);
      } finally {
        autofillBtn.disabled = false;
      }
    }

    autofillBtn.addEventListener("click", runAutofill);

    analyzeBtn.addEventListener("click", async () => {
      if (stale()) return;
      analyzeBtn.disabled = true;
      setStatus("Reading the job posting", true);
      const response = await send({ type: "TG_EXTRACT_JD", text: extractPageText(), url: location.href });
      analyzeBtn.disabled = false;
      if (response?.ok) {
        const jd = response.jdStructured;
        $(".subtitle").textContent = [jd.company, jd.title].filter(Boolean).join(" · ");
        setStatus(isForm ? "Fill this application from your profile." : "Job analyzed.", false);
        banner(`${jd.title || "Role"} at ${jd.company || "this company"}`);
      } else {
        setStatus(response?.status === "downloading" ? "The on-device model is still downloading." : response?.reason || "Couldn't analyze this page.", false);
      }
    });

    saveBtn.addEventListener("click", async () => {
      if (stale()) return;
      saveBtn.disabled = true;
      setStatus("Saving", true);
      const response = await send({ type: "TG_SAVE_TEXT", text: extractPageText() });
      setStatus(isForm ? "Fill this application from your profile." : "Save the posting or analyze it on-device.", false);
      if (response?.ok) return banner(`Saved to ${response.folderName || "your folder"}`);
      saveBtn.disabled = false;
      setStatus(response?.needsFolder ? "Choose a folder in the tab that just opened." : response?.error || "Couldn't save — try again.", false);
    });

    if (countFormFields() >= 3) showMode(true);
    else {
      showMode(false);
      const watcher = new MutationObserver(() => {
        if (countFormFields() < 3) return;
        watcher.disconnect();
        showMode(true);
      });
      watcher.observe(document.body, { childList: true, subtree: true });
    }

    return { runAutofill };
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!alive()) return;
    if (message?.type !== "TG_RUN_AUTOFILL" || countFormFields() === 0) return;
    getHud().then((hud) => hud.runAutofill());
  });

  if (window.top === window || countFormFields() >= 3) getHud();
})();
