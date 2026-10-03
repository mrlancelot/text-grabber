import { detectFields, hasValue, comboboxValue } from "./detect.js";
import { exactKey, signature, matchOption, matchText, isOpenQuestion, findLearnedExact, rankLearned, bestKey, isYesNo, sharesWord } from "./match.js";
import { buildValues, catalog, CHOICE_KEYS, CHOICE_LABELS, FILE_KEYS, FIELD_KEYS } from "./keys.js";
import { fillText, fillSelect, fillRadio, fillCheckboxes, fillButton, fillFile, fillCombobox, highlight, clearHighlights, markPending, jump } from "./fill.js";
import { ready, log, table } from "../lib/log.js";

const CUSTOM = new Set(["none", "freeText"]);
const OPTION_KINDS = new Set(["select", "radio", "checkboxes", "buttons"]);
const CACHE = "tgFieldCache";

function send(message) {
  return new Promise((resolve) => {
    if (!chrome.runtime?.id) return resolve(null);
    chrome.runtime.sendMessage(message, (response) => resolve(chrome.runtime.lastError ? null : response));
  });
}

function base64ToFile({ name, type, base64 }) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}

const state = {
  running: false,
  seen: new WeakSet(),
  results: [],
  observer: null,
  jd: null,
  onProgress: () => {},
  onStatus: () => {},
  cursor: { filled: -1, review: -1, needs: -1 },
  done: 0,
  total: 0,
};

async function load() {
  await ready;
  const [data, stored] = await Promise.all([send({ type: "TG_GET_FILL_DATA" }), chrome.storage.local.get(CACHE)]);
  state.data = data;
  state.values = buildValues(data.profile, data.answers);
  state.catalog = catalog(state.values, !!data.resume);
  state.cache = stored[CACHE] || {};
  state.resume = data.resume ? base64ToFile(data.resume) : null;
  log("Data", { nano: data.nano, catalog: Object.keys(state.catalog), learned: data.learned.length, cached: Object.keys(state.cache).length });
}

function live() {
  return state.results.filter((r) => r.desc.el.isConnected);
}

function summary() {
  const counts = { filled: 0, review: 0, needs: 0 };
  for (const r of live()) counts[r.status]++;
  return counts;
}

const NEEDS_REASON = {
  "no saved value": "Not in your profile",
  "no saved answer": "No saved answer yet",
  "no option matched": "No option fits your answer",
  "site rejected value": "The site didn't accept it",
  "dropdown never opened": "Couldn't open the menu",
  cleared: "The site cleared it",
};

const REVIEW_REASON = {
  draft: "Written by AI",
  "ai choice": "Chosen by AI",
  "saved answer (nano)": "Similar saved answer",
};

function reasonOf(d, status) {
  if (status === "needs") return NEEDS_REASON[d.trace?.reason] || "Needs your input";
  return REVIEW_REASON[d.trace?.via] || (d.trace?.option === "nano" ? "Option chosen by AI" : "Matched by AI");
}

function progress() {
  const items = live()
    .filter((r) => r.status !== "filled")
    .sort((a, b) => (a.status === "needs" ? -1 : 0) - (b.status === "needs" ? -1 : 0))
    .map((r) => ({ uid: r.desc.uid, label: r.desc.label, status: r.status, reason: reasonOf(r.desc, r.status) }));
  state.onProgress({ counts: summary(), items, done: state.done, total: state.total });
}

function record(d, status) {
  state.done++;
  if (status) {
    state.results.push({ desc: d, status });
    highlight(d, status);
  }
  progress();
}

const isUrl = (v) => /^(https?:\/\/|www\.)|\.(com|io|dev|me|org|net|ai)(\/|$)/i.test(String(v));
const isNumber = (v) => /^\d+([.,]\d+)?$/.test(String(v));

function choicesFor(d) {
  const keys = Object.keys(state.catalog).filter((k) => !FILE_KEYS.includes(k));
  const text = keys.filter((k) => !CHOICE_KEYS[k]);
  if (OPTION_KINDS.has(d.kind)) {
    return keys.filter(
      (k) => !isUrl(state.values[k]) && (matchOption(k, state.values[k], d.options) >= 0 || (!CHOICE_KEYS[k] && sharesWord(state.values[k], d.options)))
    );
  }
  if (d.kind === "combobox") return keys;
  if (d.inputType === "url" || /\b(url|link|website|portfolio|github|linkedin)\b/i.test(`${d.label} ${d.placeholder}`)) return text.filter((k) => isUrl(state.values[k]));
  if (d.inputType === "number") return text.filter((k) => isNumber(state.values[k]));
  return [...text, ...(isOpenQuestion(d) ? ["freeText"] : [])];
}

function fieldLine(d) {
  const attrs = [d.name, d.id, d.placeholder].filter(Boolean).join(" ");
  return [d.label, d.section || "-", d.kind, d.options.slice(0, 6).join(" / ") || "-", attrs || "-"]
    .map((s) => String(s).slice(0, 150))
    .join(" | ");
}

function resumeTarget(fields) {
  const files = fields.filter((d) => d.kind === "file");
  return files.find((d) => /^(resume|cv)\b/i.test(d.label)) || files[0];
}

function shapeKeys(d) {
  const all = Object.keys(FIELD_KEYS).filter((k) => !FILE_KEYS.includes(k));
  if (OPTION_KINDS.has(d.kind)) return isYesNo(d.options) ? Object.keys(CHOICE_KEYS) : all;
  if (d.kind === "combobox") return all;
  return all.filter((k) => !CHOICE_KEYS[k]);
}

function decideFast(fields) {
  const resumeField = state.resume ? resumeTarget(fields) : null;
  const pending = [];
  for (const d of fields) {
    const set = (key, source) => Object.assign(d, { key, source });
    if (d.kind === "file") {
      set(d === resumeField ? "resumeUpload" : "none", "shape");
      continue;
    }
    d.choices = choicesFor(d);
    const exact = exactKey(d);
    const cached = state.cache[signature(d)];
    const winner = exact || d.kind === "textarea" ? null : bestKey(d.label, shapeKeys(d));
    if (exact) set(exact, "shape");
    else if (d.kind === "textarea") set("freeText", "shape");
    else if (winner) set(state.catalog[winner] ? winner : "none", state.catalog[winner] ? "match" : `match: ${winner}, not saved`);
    else if (cached && (cached === "none" || d.choices.includes(cached))) set(cached, "cache");
    else if (!d.choices.length) set("none", "no candidates");
    else pending.push(d);
  }
  table("Decided", fields.map((d) => ({ uid: d.uid, label: d.label, key: d.key || "?", source: d.source || "nano next", choices: (d.choices || []).join(", ") })));
  return pending;
}

async function decideNano(d) {
  if (!state.data.nano) return Object.assign(d, { key: "none", source: "nano unavailable" });
  const res = await send({
    type: "TG_MATCH_FIELD",
    line: fieldLine(d),
    choices: d.choices.map((k) => ({ key: k, desc: k === "freeText" ? "open-ended question needing a written answer" : state.catalog[k] })),
  });
  Object.assign(d, { key: res?.key || "none", source: "nano" });
  state.cache[signature(d)] = d.key;
  await chrome.storage.local.set({ [CACHE]: state.cache });
}

function getJd() {
  state.jd ??= send({ type: "TG_GET_JD", url: location.href, text: document.body.innerText.slice(0, 6000) }).then((r) => r?.jd || null);
  return state.jd;
}

function fail(d, reason) {
  d.trace.reason = reason;
  return d.required ? "needs" : null;
}

async function fillValue(d, key, value) {
  if (d.kind === "text" || d.kind === "textarea") return fillText(d.el, String(value));
  const pick = async (options) => {
    let i = key ? matchOption(key, value, options) : matchText(value, options);
    d.trace.option = "rules";
    if (i < 0 && state.data.nano) {
      const res = await send({ type: "TG_MATCH_OPTION", question: d.label, answer: CHOICE_LABELS[value] || String(value), options });
      i = res?.index ?? -1;
      d.trace.option = "nano";
    }
    if (i < 0) d.trace.reason = "no option matched";
    else d.trace.chosen = options[i];
    return i;
  };
  if (d.kind === "combobox") {
    const r = await fillCombobox(d.el, pick, CHOICE_KEYS[key] ? "" : String(value));
    if (!r.ok) d.trace.reason = r.reason;
    return r.ok;
  }
  const i = await pick(d.options);
  if (i < 0) return false;
  if (d.kind === "select") return fillSelect(d.el, i);
  if (d.kind === "radio") return fillRadio(d.optionEls[i]);
  if (d.kind === "buttons") return fillButton(d.optionEls[i]);
  return fillCheckboxes(d.optionEls, [i]);
}

async function fillCustom(d) {
  const learned = state.data.learned;
  let hit = findLearnedExact(d.label, learned);
  let fuzzy = false;
  if (!hit && state.data.nano) {
    const candidates = rankLearned(d.label, learned);
    if (candidates.length) {
      const res = await send({
        type: "TG_MATCH_SAVED_ANSWER",
        question: d.label,
        candidates: candidates.map((c) => ({ id: c.id, questionText: c.questionText })),
      });
      hit = learned.find((l) => l.id === res?.id) || null;
      fuzzy = !!hit;
    }
  }
  if (hit) {
    Object.assign(d.trace, { value: hit.answer, via: fuzzy ? "saved answer (nano)" : "saved answer" });
    if (await fillValue(d, null, hit.answer)) return fuzzy || d.kind === "textarea" ? "review" : "filled";
  }

  if (OPTION_KINDS.has(d.kind) && state.data.nano && !d.source.startsWith("match:")) {
    const res = await send({ type: "TG_DRAFT_CHOICE", question: d.label, options: d.options });
    if (res?.index >= 0) {
      Object.assign(d.trace, { value: d.options[res.index], via: "ai choice" });
      if (await fillValue(d, null, d.options[res.index])) return "review";
    }
  }

  const wantsDraft = d.kind === "textarea" ? d.required || /\?|\b(why|describe|tell us|explain)\b/i.test(d.label) : isOpenQuestion(d);
  if (wantsDraft && state.data.nano && state.data.profile) {
    const maxLength = d.el.maxLength > 0 ? d.el.maxLength : 0;
    const res = await send({ type: "TG_DRAFT_ANSWER", question: d.label, jd: await getJd(), maxLength, url: location.href });
    if (res?.text) {
      Object.assign(d.trace, { value: res.text, via: "draft" });
      if (await fillText(d.el, res.text)) return "review";
    }
  }
  return fail(d, hit ? "saved answer didn't fit" : "no saved answer");
}

async function fillField(d) {
  if (d.key === "resumeUpload") return (await fillFile(d.el, state.resume)) ? "filled" : fail(d, "site rejected file");
  if (d.kind === "file" || FILE_KEYS.includes(d.key)) return fail(d, "no file for this upload");
  if (CUSTOM.has(d.key)) return fillCustom(d);
  const value = state.values[d.key];
  if (value == null || value === "") return fail(d, "no saved value");
  d.trace.value = value;
  if (!(await fillValue(d, d.key, value))) return fail(d, d.trace.reason || "site rejected value");
  return d.source === "nano" || d.trace.option === "nano" ? "review" : "filled";
}

function readAnswer(d) {
  switch (d.kind) {
    case "text":
    case "textarea":
      return d.el.value.trim();
    case "select":
      return d.el.selectedIndex > 0 ? d.options[d.el.selectedIndex] : "";
    case "radio":
    case "checkboxes":
      return d.optionEls.map((o, i) => (o.checked ? d.options[i] : null)).filter(Boolean).join("; ");
    case "buttons":
      return d.optionEls.map((b, i) => (b.getAttribute("aria-pressed") === "true" ? d.options[i] : null)).filter(Boolean).join("; ");
    case "combobox":
      return comboboxValue(d.el);
    default:
      return "";
  }
}

function watch(d) {
  if (d.kind === "file" || d.watched) return;
  d.watched = true;
  const onChange = () =>
    setTimeout(() => {
      const answer = readAnswer(d);
      if (!answer || answer === d.filledAnswer || answer === d.savedAnswer) return;
      d.savedAnswer = answer;
      const sig = signature(d);
      if (CUSTOM.has(d.key)) {
        send({ type: "TG_SAVE_LEARNED", questionText: d.label, answer, kind: d.kind, options: d.options });
        log("Learned", { label: d.label, answer });
      } else if (d.filledAnswer && state.cache[sig]) {
        delete state.cache[sig];
        chrome.storage.local.set({ [CACHE]: state.cache });
        log("Cache dropped", { label: d.label, key: d.key, answer });
      }
    }, 200);
  for (const t of d.optionEls.length ? d.optionEls : [d.el]) {
    for (const type of ["change", "focusout", "click"]) t.addEventListener(type, onChange);
  }
}

async function fillOne(d) {
  d.trace = {};
  let status;
  try {
    status = await fillField(d);
  } catch (err) {
    status = fail(d, String(err && err.message ? err.message : err));
  }
  if (status === "filled" || status === "review") d.filledAnswer = readAnswer(d);
  record(d, status);
  log("Filled", { uid: d.uid, label: d.label, key: d.key, source: d.source, ...d.trace, status: status || "skipped" });
}

async function recheck(fields) {
  await new Promise((r) => setTimeout(r, 500));
  for (const r of state.results) {
    if (!fields.includes(r.desc) || r.status === "needs" || r.desc.kind === "file" || readAnswer(r.desc)) continue;
    log("Cleared by site", { uid: r.desc.uid, label: r.desc.label, key: r.desc.key });
    r.desc.trace.reason = "cleared";
    r.status = "needs";
    highlight(r.desc, "needs");
  }
  progress();
}

async function pass() {
  const t0 = performance.now();
  const fields = detectFields().filter((d) => !state.seen.has(d.el));
  for (const d of fields) {
    state.seen.add(d.el);
    d.skip = !d.label ? "no label" : hasValue(d) ? "already filled" : "";
  }
  if (!fields.length) return 0;
  table(
    "Detected",
    fields.map((d) => ({ uid: d.uid, kind: d.kind, label: d.label, section: d.section, options: d.options.join(" / "), required: d.required, skip: d.skip }))
  );

  const todo = fields.filter((d) => !d.skip);
  state.total += todo.length;
  const pending = decideFast(todo);
  const ready = todo.filter((d) => !pending.includes(d) && !CUSTOM.has(d.key));
  state.onStatus(`Filling ${ready.length} fields`, true);
  for (const d of ready) await fillOne(d);
  log("Instant fill done", { ms: Math.round(performance.now() - t0) });

  const slow = async (d, text) => {
    state.onStatus(text, true);
    markPending(d, true);
    await fillOne(d);
    markPending(d, false);
  };
  for (const d of pending) {
    state.onStatus(`Thinking about “${d.label.slice(0, 36)}”`, true);
    markPending(d, true);
    await decideNano(d);
    if (!CUSTOM.has(d.key)) await fillOne(d);
    markPending(d, false);
  }
  const custom = todo.filter((d) => CUSTOM.has(d.key));
  for (const [i, d] of custom.entries()) {
    await slow(d, d.kind === "textarea" ? `Writing answer ${i + 1} of ${custom.length}` : `Answering “${d.label.slice(0, 36)}”`);
  }
  await recheck(todo);
  todo.forEach(watch);
  const counts = summary();
  state.onStatus(counts.needs ? "Ready — a few fields need you" : "Ready to review", false);
  log("Summary", { ...counts, ms: Math.round(performance.now() - t0) });
  return fields.length;
}

export async function autofill({ onProgress, onStatus } = {}) {
  if (!chrome.runtime?.id) return { ...summary(), stale: true };
  if (state.running) return summary();
  state.running = true;
  state.onProgress = onProgress || (() => {});
  state.onStatus = onStatus || (() => {});
  try {
    await load();
    const found = await pass();
    if (found === 0 && state.results.length === 0) return { ...summary(), empty: true };
    startWatching();
    return summary();
  } finally {
    state.running = false;
  }
}

function startWatching() {
  if (state.observer) return;
  let timer = null;
  state.observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!chrome.runtime?.id) return stop();
      if (state.running) return;
      state.running = true;
      try {
        await pass();
      } finally {
        state.running = false;
      }
    }, 800);
  });
  state.observer.observe(document.body, { childList: true, subtree: true });
}

export function stop() {
  state.observer?.disconnect();
  state.observer = null;
  clearHighlights();
}

export function scrollToNext(status) {
  const list = live().filter((r) => r.status === status);
  if (!list.length) return;
  state.cursor[status] = (state.cursor[status] + 1) % list.length;
  jump(list[state.cursor[status]].desc);
}

export function scrollToUid(uid) {
  const r = live().find((r) => r.desc.uid === uid);
  if (r) jump(r.desc);
}

export async function warmUp() {
  if (!chrome.runtime?.id) return;
  await load();
  if (state.data.nano) send({ type: "TG_WARMUP" });
}
