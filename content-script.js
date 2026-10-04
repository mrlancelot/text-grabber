(function () {
  // Recognize the previous marker to avoid duplicate panels on already-open tabs.
  if (window.__paveInjected || window.__tgTextGrabber) return;
  window.__paveInjected = true;

  const url = (path) => chrome.runtime.getURL(path);
  const isTop = window.top === window;
  let autofillModule = null;
  const loadAutofill = () => (autofillModule ??= import(url("autofill/main.js")).then((m) => (m.onSubmitted(reportSubmitted), m)));

  function countFormFields() {
    return document.querySelectorAll(
      'input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select, button[aria-haspopup="listbox"]'
    ).length;
  }
  window.__paveFormFields = countFormFields;

  function whenForm(cb) {
    if (countFormFields() >= 3) return cb();
    const watcher = new MutationObserver(() => {
      if (countFormFields() < 3) return;
      watcher.disconnect();
      cb();
    });
    watcher.observe(document.body || document.documentElement, { childList: true, subtree: true });
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

  const toTop = (message) => send({ type: "TG_TO_TOP", message });
  const frameCmd = (frameId, cmd) => send({ type: "TG_TO_FRAME", frameId, message: { type: "TG_FRAME_CMD", ...cmd } });
  const badge = (state, needs) => send({ type: "TG_BADGE", state, needs });
  const reportSubmitted = () => (hudPromise ? getHud().then((hud) => hud.markApplied()) : toTop({ type: "TG_SUBMITTED" }));

  const STATUS_LABEL = { filled: "Filled", review: "Review", needs: "Needs you" };

  let hudPromise = null;
  const getHud = () => (hudPromise ??= createHud());

  async function createHud() {
    const { icon } = await import(url("ui/icons.js"));
    for (const [family, file, weight] of [
      ["Pave Unbounded", "Unbounded-SemiBold", "600"],
      ["Pave Plex", "IBMPlexSans-Regular", "400"],
      ["Pave Plex", "IBMPlexSans-Medium", "500"],
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
        <button class="pill"><img class="brand-mark" src="${url("icons/icon32.png")}" width="24" height="24" alt=""><span class="pill-label"></span><span class="pill-badge" hidden></span></button>
        <div class="card" role="dialog" aria-label="Pave">
          <header>
            <div class="titles"><img class="brand-mark" src="${url("icons/icon32.png")}" width="24" height="24" alt=""><span class="title3 title">Pave</span><span class="caption secondary subtitle"></span></div>
            <button class="close" aria-label="Close"></button>
          </header>
          <div class="body">
          <div class="signals" hidden><div class="chips-row"></div><ul class="warnings" hidden></ul></div>
          <div class="dup callout" hidden></div>
          <div class="progress" hidden><div class="bar"></div></div>
          <div class="status callout" aria-live="polite"><span class="text"></span></div>
          <div class="summary group" hidden>
            ${["filled", "review", "needs"].map((s) => `<button class="stat" data-status="${s}"><span class="title2 tabular num">0</span><span class="caption">${STATUS_LABEL[s]}</span></button>`).join("")}
          </div>
          <div class="attention" hidden><div class="caption secondary section-label">Needs attention</div><div class="group list"></div></div>
          <div class="banner" hidden></div>
          <button class="btn prominent large wide autofill">Autofill</button>
          <button class="btn plain wide undo" hidden>Undo fill</button>
          <div class="actions">
            <button class="btn plain save">Save Job</button>
            <button class="btn plain tailor"><span>Tailor Resume</span></button>
          </div>
          <div class="resume" hidden><span class="callout name"></span><a class="btn download">Download</a></div>
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
    const undoBtn = $(".undo");
    const frames = new Set();
    const sources = new Map();
    const statusText = $(".status .text");
    const spinner = icon("spinner", "spinner");
    let isForm = false;

    $(".close").append(icon("xmark"));
    saveBtn.prepend(icon("doc"));
    $("footer").prepend(icon("lock"));
    send({ type: "TG_NANO_STATUS" }).then((ai) => {
      if (ai && ai.status !== "ok") $("footer span").textContent = "AI off on this device · filling from your saved data";
    });
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
      autofillBtn.hidden = !form;
      setStatus(form ? "Fill this application from your profile." : "Save the posting to your jobs folder.", false);
      if (!form) return;
      loadAutofill().then((m) => m.warmUp()).catch(() => {});
      if (isTop) badge("ready");
    }

    function addFrame(frameId) {
      if (frames.has(frameId)) return;
      frames.add(frameId);
      frameCmd(frameId, { cmd: "adopt" });
      if (!isForm) showMode(true);
    }

    function showProgress(progress, frameId = null) {
      sources.set(frameId, progress);
      const counts = { filled: 0, review: 0, needs: 0 };
      const items = [];
      let done = 0;
      let total = 0;
      for (const [source, p] of sources) {
        for (const status in counts) counts[status] += p.counts[status];
        items.push(...p.items.map((item) => ({ ...item, frameId: source })));
        done += p.done;
        total += p.total;
      }
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
          row.addEventListener("click", async () => {
            if (stale()) return;
            if (item.frameId == null) (await loadAutofill()).scrollToUid(item.uid);
            else frameCmd(item.frameId, { cmd: "jump", uid: item.uid });
          });
          return row;
        })
      );
    }

    for (const status of ["filled", "review", "needs"]) {
      $(`.stat[data-status="${status}"]`).addEventListener("click", async () => {
        const source = [...sources].find(([, p]) => p.counts[status] > 0)?.[0];
        if (stale() || source === undefined) return;
        if (source === null) (await loadAutofill()).scrollToNext(status);
        else frameCmd(source, { cmd: "next", status });
      });
    }

    function stale() {
      if (alive()) return false;
      expand();
      setStatus("Pave was updated. Reload this page to use it.", false);
      return true;
    }

    async function runAutofill() {
      if (stale()) return;
      expand();
      autofillBtn.disabled = true;
      setStatus("Getting ready", true);
      sources.clear();
      try {
        const results = [];
        if (!frames.size || countFormFields() >= 3) {
          const counts = await (await loadAutofill()).autofill({ onProgress: (p) => showProgress(p), onStatus: setStatus });
          if (counts.stale) return stale();
          results.push(counts);
        }
        for (const frameId of frames) results.push(await frameCmd(frameId, { cmd: "autofill" }));
        if (results.every((counts) => !counts || counts.empty)) return setStatus("No form fields found here.", false);
        $(".bar").style.width = "100%";
        autofillBtn.textContent = "Fill Again";
        undoBtn.hidden = false;
        const needs = [...sources.values()].reduce((n, p) => n + p.counts.needs, 0);
        badge(needs ? "needs" : "ready", needs);
        offerApplied();
      } catch (err) {
        setStatus(`Autofill failed: ${err && err.message ? err.message : err}`, false);
      } finally {
        autofillBtn.disabled = false;
      }
    }

    autofillBtn.addEventListener("click", runAutofill);

    undoBtn.addEventListener("click", async () => {
      if (stale()) return;
      undoBtn.disabled = true;
      const results = [];
      if (sources.has(null)) results.push(await (await loadAutofill()).undo());
      for (const frameId of frames) results.push(await frameCmd(frameId, { cmd: "undo" }));
      const cleared = results.reduce((n, r) => n + (r?.cleared || 0), 0);
      const kept = results.reduce((n, r) => n + (r?.kept || 0), 0);
      sources.clear();
      for (const sel of [".progress", ".summary", ".attention", ".pill-badge"]) $(sel).hidden = true;
      autofillBtn.textContent = "Autofill";
      undoBtn.hidden = true;
      undoBtn.disabled = false;
      setStatus(`Cleared ${cleared} field${cleared === 1 ? "" : "s"}${kept ? ` · ${kept} left as is` : ""}.`, false);
      badge("ready");
    });

    saveBtn.addEventListener("click", async () => {
      if (stale()) return;
      saveBtn.disabled = true;
      setStatus("Saving", true);
      const { readJob } = await import(url("lib/jobpage.js"));
      const response = await send({ type: "TG_SAVE_TEXT", text: extractPageText(), url: location.href, job: readJob() });
      setStatus(isForm ? "Fill this application from your profile." : "Save the posting to your jobs folder.", false);
      if (response?.ok) return banner(`Saved to ${response.folderName || "your folder"}`);
      saveBtn.disabled = false;
      setStatus(response?.needsFolder ? "Choose a folder in the tab that just opened." : response?.error || "Couldn't save — try again.", false);
    });

    if (countFormFields() < 3) showMode(false);
    whenForm(() => showMode(true));

    const tailorBtn = $(".tailor");
    const tailorLabel = tailorBtn.querySelector("span");
    tailorBtn.prepend(icon("sparkles"));

    function showResume(file) {
      const link = $(".download");
      if (link.href) URL.revokeObjectURL(link.href);
      link.href = URL.createObjectURL(new Blob([Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))], { type: file.type }));
      link.download = file.name;
      $(".resume .name").textContent = file.name;
      $(".resume").hidden = false;
      tailorLabel.textContent = "Re-tailor Resume";
    }

    tailorBtn.addEventListener("click", async () => {
      if (stale()) return;
      tailorBtn.disabled = true;
      tailorLabel.textContent = "Tailoring…";
      setStatus("Tailoring your resume to this job", true);
      const { readJob } = await import(url("lib/jobpage.js"));
      const response = await send({ type: "TG_TAILOR", url: location.href, job: readJob() });
      tailorBtn.disabled = false;
      if (!response?.ok) {
        tailorLabel.textContent = "Tailor Resume";
        return setStatus("Couldn't tailor. Set up your profile in settings first.", false);
      }
      showResume(response.file);
      const attached = isForm && (await (await loadAutofill()).attachResume(response.file));
      setStatus(attached ? "Tailored resume attached to the form." : "Tailored resume ready. Download it to review.", false);
    });

    send({ type: "TG_GET_TAILORED", url: location.href }).then((file) => file && showResume(file));

    const STATUS_TEXT = { applied: "You applied", interview: "You're interviewing for this job", offer: "You have an offer for this job", rejected: "You were turned down for this job" };

    function chip(text, className = "") {
      const node = document.createElement(className ? "button" : "span");
      node.className = `chip ${className}`.trim();
      node.textContent = text;
      return node;
    }

    async function jobInfo() {
      const [{ readJob }, { jobSignals }] = await Promise.all([import(url("lib/jobpage.js")), import(url("lib/signals.js"))]);
      const job = readJob();
      if (!job.title) return;
      const { chips, warnings } = jobSignals(job);
      const nodes = chips.map((t) => chip(t));
      if (warnings.length) {
        const warn = chip(`${warnings.length} warning sign${warnings.length > 1 ? "s" : ""}`, "warn");
        const list = $(".warnings");
        list.replaceChildren(...warnings.map((w) => Object.assign(document.createElement("li"), { textContent: w })));
        warn.addEventListener("click", () => (list.hidden = !list.hidden));
        nodes.push(warn);
      }
      $(".chips-row").replaceChildren(...nodes);
      $(".signals").hidden = !nodes.length;
      const dup = await send({ type: "TG_CHECK_DUPLICATE", url: location.href, title: job.title, company: job.company });
      if (!dup) return;
      const date = new Date(dup.savedAt).toLocaleDateString();
      $(".dup").textContent = STATUS_TEXT[dup.status]
        ? `${STATUS_TEXT[dup.status]} · saved ${date}${dup.sameUrl ? "" : ` on ${dup.host}`}`
        : `You saved this job on ${date}${dup.sameUrl ? "" : ` on ${dup.host}`}`;
      $(".dup").hidden = false;
    }

    async function offerApplied() {
      const { readJob } = await import(url("lib/jobpage.js"));
      const job = readJob();
      const dup = await send({ type: "TG_CHECK_DUPLICATE", url: location.href, title: job.title, company: job.company });
      if (dup && dup.status !== "saved") return;
      const box = $(".dup");
      const mark = Object.assign(document.createElement("button"), { className: "btn plain", textContent: "Mark as applied" });
      mark.addEventListener("click", async () => {
        const response = await send({ type: "TG_SET_STATUS", id: dup?.id, url: location.href, job, status: "applied" });
        if (response?.ok) box.textContent = "Marked as applied. You'll get follow-up reminders after 7 and 14 days.";
      });
      box.replaceChildren(document.createTextNode("Submitted it? "), mark);
      box.hidden = false;
    }

    async function markApplied() {
      const { readJob } = await import(url("lib/jobpage.js"));
      const response = await send({ type: "TG_MARK_APPLIED", url: location.href, job: readJob() });
      if (!response?.ok) return;
      const box = $(".dup");
      const undo = Object.assign(document.createElement("button"), { className: "btn plain", textContent: "Undo" });
      undo.addEventListener("click", async () => {
        await send({ type: "TG_SET_STATUS", id: response.id, status: "saved" });
        box.hidden = true;
      });
      box.replaceChildren(document.createTextNode("Marked as applied. Reminders in 7 and 14 days."), undo);
      box.hidden = false;
      expand();
    }

    if (isTop) {
      jobInfo();
      for (const frameId of (await send({ type: "TG_FIND_FORMS" })) || []) addFrame(frameId);
    }

    return {
      runAutofill,
      addFrame,
      markApplied,
      showProgress,
      setStatus,
      remove: () => host.remove(),
    };
  }

  function adopt() {
    const hud = hudPromise;
    hudPromise = null;
    hud?.then((h) => h.remove());
  }

  const FRAME_CMDS = {
    adopt,
    autofill: (m) =>
      m.autofill({
        onProgress: (progress) => toTop({ type: "TG_FRAME_PROGRESS", progress }),
        onStatus: (text, busy) => toTop({ type: "TG_FRAME_STATUS", text, busy }),
      }),
    undo: (m) => m.undo(),
    next: (m, { status }) => m.scrollToNext(status),
    jump: (m, { uid }) => m.scrollToUid(uid),
  };

  const TOP_MESSAGES = {
    TG_RUN_AUTOFILL: (hud) => hud.runAutofill(),
    TG_CHILD_FORM: (hud, { frameId }) => hud.addFrame(frameId),
    TG_FRAME_PROGRESS: (hud, { progress, frameId }) => hud.showProgress(progress, frameId),
    TG_FRAME_STATUS: (hud, { text, busy }) => hud.setStatus(text, busy),
    TG_SUBMITTED: (hud) => hud.markApplied(),
  };

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (!alive() || !message) return;
    if (message.type === "TG_FRAME_CMD" && FRAME_CMDS[message.cmd]) {
      loadAutofill()
        .then((m) => FRAME_CMDS[message.cmd](m, message))
        .then((result) => respond(result ?? null), () => respond(null));
      return true;
    }
    if (isTop && TOP_MESSAGES[message.type]) {
      getHud().then((hud) => TOP_MESSAGES[message.type](hud, message));
      respond(true);
    }
  });

  if (isTop) getHud();
  else {
    whenForm(async () => {
      if (await toTop({ type: "TG_CHILD_FORM" })) return loadAutofill().then((m) => m.warmUp()).catch(() => {});
      getHud();
      badge("enable");
    });
  }
})();
