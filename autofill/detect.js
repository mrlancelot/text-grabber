const TEXT_TYPES = new Set(["text", "email", "tel", "url", "number", "search", ""]);
export function deepQueryAll(root, selector) {
  const out = [...root.querySelectorAll(selector)];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let n = walker.currentNode; n; n = walker.nextNode()) {
    if (n.shadowRoot) out.push(...deepQueryAll(n.shadowRoot, selector));
  }
  return out;
}

export function isVisible(el) {
  if (!el || !el.isConnected) return false;
  if (el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
function ownText(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);
  clone.querySelectorAll("input, select, textarea, option, [role=listbox], [role=option], button, svg").forEach((n) => n.remove());
  return cleanText(clone.textContent);
}

function byIds(ids, root) {
  return String(ids || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => (root.getElementById ? root.getElementById(id) : document.getElementById(id)))
    .filter(Boolean);
}

function commonAncestor(els) {
  let node = els[0].parentElement;
  while (node && !els.every((e) => node.contains(e))) node = node.parentElement;
  return node;
}

function holdsOtherField(node, els) {
  return [...node.querySelectorAll("input, select, textarea, button[aria-pressed]")].some(
    (c) => !els.includes(c) && c.type !== "hidden" && isVisible(c)
  );
}

function checkboxBlock(el) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (node.querySelectorAll("input[type=checkbox]").length < 2) continue;
    const others = node.querySelectorAll("input:not([type=checkbox]):not([type=hidden]), select, textarea, button[aria-pressed]");
    return [...others].some(isVisible) ? null : node;
  }
  return null;
}

function wrapperLabel(node, els) {
  const optionLabels = els.flatMap((e) => [...(e.labels || [])]);
  const isOwn = (n) => els.some((e) => n.contains(e)) || optionLabels.some((l) => l.contains(n));
  const label = [...node.querySelectorAll("label, legend")].find((l) => !isOwn(l) && ownText(l));
  if (label) return { text: ownText(label), el: label, box: node };
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const parent = t.parentElement;
    if (!t.textContent.trim() || isOwn(parent) || parent.closest("button, select, option, [role=option], script, style")) continue;
    return { text: ownText(parent), el: parent, box: node };
  }
  return null;
}

function labelOf(els) {
  const el = els[0];
  const root = el.getRootNode();
  const group = els.length > 1 || el.type === "radio" ? el.closest("[role=radiogroup], [role=group], fieldset") : null;
  const named = group || (els.length === 1 ? el : null);
  if (named) {
    if (!group && el.labels?.length && ownText(el.labels[0])) return { text: ownText(el.labels[0]), el: el.labels[0], box: el };
    const refs = byIds(named.getAttribute("aria-labelledby"), root);
    if (refs.length && refs.map(ownText).join("")) return { text: cleanText(refs.map(ownText).join(" ")), el: refs[0], box: named };
    if (named.getAttribute("aria-label")) return { text: cleanText(named.getAttribute("aria-label")), el: null, box: named };
    const legend = group?.querySelector("legend");
    if (legend && ownText(legend)) return { text: ownText(legend), el: legend, box: group };
  }
  let node = commonAncestor(els);
  for (let depth = 0; node && node !== document.body && depth < 8; depth++, node = node.parentElement) {
    if (holdsOtherField(node, els)) break;
    const found = wrapperLabel(node, els);
    if (found) return found;
  }
  return { text: cleanText(el.getAttribute("placeholder") || el.getAttribute("name") || ""), el: null, box: el };
}

function optionLabel(input) {
  if (input.labels && input.labels.length) return ownText(input.labels[0]);
  if (input.getAttribute("aria-label")) return cleanText(input.getAttribute("aria-label"));
  const next = input.nextElementSibling || input.parentElement;
  return ownText(next) || cleanText(input.value);
}

const STAR = /\s*\*\s*$/;

function starredByStyle(labelEl) {
  if (!labelEl) return false;
  const nodes = [labelEl, labelEl.parentElement, ...labelEl.querySelectorAll("*")].filter(Boolean);
  return nodes.some(
    (n) =>
      /required/i.test(n.getAttribute("class") || "") ||
      ["::after", "::before"].some((p) => getComputedStyle(n, p).content.includes("*"))
  );
}

function isRequired(el, label) {
  return (
    el.required ||
    el.getAttribute("aria-required") === "true" ||
    STAR.test(label.text) ||
    /\(required\)/i.test(label.text) ||
    starredByStyle(label.el)
  );
}

function isCombobox(el) {
  if (el.tagName === "BUTTON") return el.getAttribute("aria-haspopup") === "listbox";
  return (
    el.getAttribute("role") === "combobox" ||
    el.getAttribute("aria-autocomplete") === "list" ||
    el.getAttribute("data-uxi-widget-type") === "selectinput"
  );
}
export function hasValue(desc) {
  const el = desc.el;
  switch (desc.kind) {
    case "radio":
    case "checkboxes":
      return desc.optionEls.some((o) => o.checked);
    case "buttons":
      return desc.optionEls.some((b) => b.getAttribute("aria-pressed") === "true");
    case "select":
      return el.selectedIndex > 0 || (el.selectedIndex === 0 && el.value !== "" && !/^(select|choose|--|please)/i.test(el.options[0]?.text || ""));
    case "file":
      return el.files && el.files.length > 0;
    case "combobox":
      return comboboxValue(el) !== "";
    default:
      return String(el.value || "").trim() !== "";
  }
}
export function comboboxValue(el) {
  if (el.tagName === "BUTTON") {
    const t = cleanText(el.textContent);
    return /^(select one|select|choose)/i.test(t) ? "" : t;
  }
  const container = el.closest('[class*="container"], [class*="select__"], [data-automation-id^="formField-"]') || el.parentElement;
  const single = container && container.querySelector('[class*="singleValue"], [class*="single-value"], [data-automation-id="selectedItem"]');
  if (single) return cleanText(single.textContent);
  return cleanText(el.value);
}

function sectionOf(el, headings) {
  let section = "";
  for (const h of headings) {
    if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) section = ownText(h);
  }
  return section.slice(0, 80);
}

let nextUid = 1;
const uids = new WeakMap();
function uidOf(el) {
  if (!uids.has(el)) uids.set(el, `f${nextUid++}`);
  return uids.get(el);
}
export function detectFields(root = document) {
  const headings = deepQueryAll(root, "h1, h2, h3, h4, legend, [role=heading]");
  const controls = deepQueryAll(
    root,
    'input, textarea, select, button[aria-haspopup="listbox"], button[aria-pressed]'
  );
  const fields = [];
  const groups = new Map();

  for (const el of controls) {
    if (el.disabled || el.readOnly) continue;
    const tag = el.tagName;
    const type = tag === "INPUT" ? (el.getAttribute("type") || "text").toLowerCase() : "";
    if (type === "hidden" || type === "submit" || type === "button" || type === "password") continue;
    if (/captcha/i.test(`${el.id} ${el.name} ${el.className}`)) continue;
    if (type !== "file" && !isVisible(el) && !(el.labels?.[0] && isVisible(el.labels[0]))) continue;

    if (tag === "BUTTON" && el.hasAttribute("aria-pressed")) {
      const key = `buttons:${uidOf(el.parentElement)}`;
      if (!groups.has(key)) groups.set(key, { type: "buttons", els: [] });
      groups.get(key).els.push(el);
      continue;
    }

    if (type === "radio" || type === "checkbox") {
      const container = el.closest("[role=radiogroup], [role=group], fieldset");
      const key = `${type}:${el.name || ""}:${el.name ? "" : uidOf(container || el.parentElement)}`;
      if (!groups.has(key)) groups.set(key, { type, els: [] });
      groups.get(key).els.push(el);
      continue;
    }

    let kind;
    if (tag === "TEXTAREA") kind = "textarea";
    else if (tag === "SELECT") kind = "select";
    else if (type === "file") kind = "file";
    else if (isCombobox(el)) kind = "combobox";
    else if (TEXT_TYPES.has(type)) kind = "text";
    else continue;

    const label = labelOf([el]);
    fields.push({
      uid: uidOf(el),
      el,
      kind,
      inputType: type,
      label: label.text.replace(STAR, ""),
      box: label.box,
      section: sectionOf(el, headings),
      options: kind === "select" ? [...el.options].map((o) => cleanText(o.text)) : [],
      optionEls: [],
      required: isRequired(el, label),
      placeholder: el.getAttribute("placeholder") || "",
      autocomplete: el.getAttribute("autocomplete") || "",
      name: el.getAttribute("name") || "",
      id: el.id || "",
    });
  }

  for (const [key, group] of [...groups]) {
    if (group.type !== "checkbox" || group.els.length !== 1) continue;
    const block = checkboxBlock(group.els[0]);
    if (!block) continue;
    groups.delete(key);
    const merged = `checkbox:block:${uidOf(block)}`;
    if (!groups.has(merged)) groups.set(merged, { type: "checkbox", els: [] });
    groups.get(merged).els.push(group.els[0]);
  }

  for (const { type, els } of groups.values()) {
    if (type === "checkbox" && els.length < 2) continue;
    if (type === "buttons" && (els.length < 2 || els.length > 6)) continue;
    const first = els[0];
    const label = labelOf(els);
    fields.push({
      uid: uidOf(first),
      el: first,
      kind: { radio: "radio", checkbox: "checkboxes", buttons: "buttons" }[type],
      inputType: type,
      label: label.text.replace(STAR, ""),
      box: label.box,
      section: sectionOf(first, headings),
      options: type === "buttons" ? els.map((b) => cleanText(b.textContent)) : els.map(optionLabel),
      optionEls: els,
      required: els.some((e) => e.required || e.getAttribute("aria-required") === "true") || isRequired(first, label),
      placeholder: "",
      autocomplete: "",
      name: first.getAttribute("name") || "",
      id: first.id || "",
    });
  }
  fields.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return fields;
}
