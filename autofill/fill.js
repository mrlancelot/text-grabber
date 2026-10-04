import { deepQueryAll, isVisible, comboboxValue } from "./detect.js";
import { normalize } from "./match.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sameText(shown, wanted) {
  const a = String(shown).toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = String(wanted).toLowerCase().replace(/[^a-z0-9]/g, "");
  return a !== "" && (a === b || a.includes(b) || b.includes(a));
}

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
}

function fire(el, type, init = {}) {
  const Ctor = type.startsWith("key") ? KeyboardEvent : type.startsWith("pointer") ? PointerEvent : type.startsWith("mouse") || type === "click" ? MouseEvent : Event;
  el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, composed: true, ...init }));
}

function realClick(el) {
  fire(el, "pointerdown");
  fire(el, "mousedown");
  fire(el, "pointerup");
  fire(el, "mouseup");
  el.click();
}

export async function fillText(el, value) {
  el.focus();
  setNativeValue(el, value);
  fire(el, "input");
  fire(el, "change");
  fire(el, "blur");
  el.blur();
  await sleep(150);
  return sameText(el.value, value);
}

export async function fillSelect(el, index) {
  el.focus();
  el.selectedIndex = index;
  fire(el, "input");
  fire(el, "change");
  el.blur();
  await sleep(0);
  return el.selectedIndex === index;
}

export async function fillRadio(optionEl) {
  realClick(optionEl.labels?.[0] && !isVisible(optionEl) ? optionEl.labels[0] : optionEl);
  await sleep(0);
  if (!optionEl.checked) optionEl.click();
  return optionEl.checked;
}

export async function fillCheckboxes(optionEls, indices) {
  for (const i of indices) {
    if (!optionEls[i].checked) optionEls[i].click();
  }
  await sleep(0);
  return indices.every((i) => optionEls[i].checked);
}

export async function fillFile(el, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  el.files = dt.files;
  fire(el, "input");
  fire(el, "change");
  if (!el.files.length) {
    const zone = el.closest('[data-automation-id*="drop"], [class*="drop"]') || el.parentElement;
    for (const type of ["dragenter", "dragover", "drop"]) {
      zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    }
  }
  await sleep(300);
  return (el.files && el.files.length > 0) || document.body.innerText.includes(file.name);
}
function openOptions(el) {
  const root = el.getRootNode();
  const ids = `${el.getAttribute("aria-controls") || ""} ${el.getAttribute("aria-owns") || ""}`;
  for (const id of ids.split(/\s+/).filter(Boolean)) {
    const box = root.getElementById ? root.getElementById(id) : document.getElementById(id);
    if (box) {
      const opts = [...box.querySelectorAll('[role=option], [data-automation-id="promptOption"]')].filter(isVisible);
      if (opts.length) return opts;
    }
  }
  return deepQueryAll(document, '[role=option], [data-automation-id="promptOption"], [data-automation-id="promptLeafNode"]').filter(isVisible);
}

async function waitForOptions(el, timeout = 1500) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const opts = openOptions(el);
    if (opts.length) return opts;
    await sleep(100);
  }
  return [];
}

function closeDropdown(el) {
  fire(el, "keydown", { key: "Escape", code: "Escape" });
  el.blur?.();
}

async function typeInto(el, text) {
  el.focus();
  setNativeValue(el, text);
  fire(el, "input");
  fire(el, "keyup", { key: text.slice(-1) || "a" });
}

export async function fillCombobox(el, pick, value) {
  el.scrollIntoView({ block: "center" });
  realClick(el);
  let opts = await waitForOptions(el, 1200);
  if (!opts.length && el.tagName === "INPUT" && value) {
    await typeInto(el, value);
    opts = await waitForOptions(el, 2500);
  }
  if (!opts.length) {
    closeDropdown(el);
    return { ok: false, reason: "dropdown never opened" };
  }
  const texts = opts.map((o) => o.textContent.replace(/\s+/g, " ").trim());
  const index = await pick(texts);
  if (index < 0) {
    closeDropdown(el);
    return { ok: false, reason: "no option matched", options: texts };
  }
  realClick(opts[index]);
  await sleep(150);
  const shown = normalize(comboboxValue(el));
  const wanted = normalize(texts[index]);
  const ok = shown !== "" && (shown.includes(wanted) || wanted.includes(shown));
  if (!ok) closeDropdown(el);
  return { ok, chosen: texts[index], reason: ok ? "" : "site rejected value" };
}

export async function clearField(d) {
  if (d.kind === "text" || d.kind === "textarea") {
    await fillText(d.el, "");
    return d.el.value === "";
  }
  if (d.kind === "select") return fillSelect(d.el, d.before);
  if (d.kind === "radio" || d.kind === "checkboxes") {
    for (const o of d.optionEls.filter((o) => o.checked)) {
      if (o.type === "checkbox") o.click();
      else {
        o.checked = false;
        fire(o, "change");
      }
    }
    await sleep(0);
    return d.optionEls.every((o) => !o.checked);
  }
  if (d.kind === "buttons") {
    for (const b of d.optionEls.filter((b) => b.getAttribute("aria-pressed") === "true")) realClick(b);
    await sleep(100);
    return d.optionEls.every((b) => b.getAttribute("aria-pressed") !== "true");
  }
  return false;
}

export async function fillButton(btn) {
  if (btn.getAttribute("aria-pressed") === "true") return true;
  realClick(btn);
  await sleep(100);
  return btn.getAttribute("aria-pressed") === "true";
}

const marked = new Set();

function visualTarget(desc) {
  return desc.kind === "text" || desc.kind === "textarea" || desc.kind === "select" ? desc.el : desc.box || desc.el;
}

export function markPending(desc, on) {
  (desc.target || visualTarget(desc))?.classList.toggle("tg-pending", on);
}

export function highlight(desc, status) {
  const target = visualTarget(desc);
  target.classList.remove("tg-pending");
  target.classList.add("tg-mark");
  target.dataset.tgStatus = status;
  marked.add(target);
  desc.target = target;
}

export function jump(desc) {
  const target = desc.target || visualTarget(desc);
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.remove("tg-jump");
  void target.offsetWidth;
  target.classList.add("tg-jump");
}

export function clearHighlights() {
  for (const target of marked) {
    target.classList.remove("tg-mark", "tg-pending", "tg-jump");
    delete target.dataset.tgStatus;
  }
  marked.clear();
}
