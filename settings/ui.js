import { icon } from "../ui/icons.js";

export { icon };

export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

export function paneHeader(title, description) {
  const saved = el("span", { className: "saved footnote" }, icon("check"), "Saved");
  let timer = null;
  const node = el(
    "header",
    { className: "pane-header" },
    el("div", { className: "pane-title-row" }, el("h1", { className: "large-title", textContent: title }), saved),
    description && el("p", { className: "pane-desc callout secondary", textContent: description })
  );
  return {
    node,
    saved() {
      saved.classList.add("show");
      clearTimeout(timer);
      timer = setTimeout(() => saved.classList.remove("show"), 1400);
    },
  };
}

export function group(title, rows, footer) {
  return el(
    "section",
    { className: "group-section" },
    title && el("div", { className: "group-title footnote secondary", textContent: title }),
    el("div", { className: "group" }, rows),
    footer && el("div", { className: "group-footer footnote secondary", textContent: footer })
  );
}

export function row(label, control) {
  return el("div", { className: "row" }, el("div", { className: "label body", textContent: label }), el("div", { className: "value" }, control));
}

export function textField(value, onInput, props = {}) {
  const input = el("input", { className: "field", value: value || "", ...props });
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

export function textArea(value, onInput, props = {}) {
  const area = el("textarea", { className: "textarea", value: value || "", ...props });
  const grow = () => {
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight + 2}px`;
  };
  area.addEventListener("input", () => {
    grow();
    onInput(area.value);
  });
  requestAnimationFrame(grow);
  return area;
}

export function segmented(options, value, onChange) {
  const node = el("div", { className: "segmented", role: "group" });
  for (const [v, label] of options) {
    const b = el("button", { type: "button", textContent: label });
    b.setAttribute("aria-pressed", String(v === value));
    b.addEventListener("click", () => {
      node.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onChange(v);
    });
    node.append(b);
  }
  return node;
}

export function popup(options, value, onChange) {
  const select = el("select", { className: "popup" }, options.map(([v, label]) => el("option", { value: v, textContent: label })));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

export function toggle(checked, onChange) {
  const input = el("input", { type: "checkbox", className: "switch", checked: !!checked });
  input.setAttribute("role", "switch");
  input.addEventListener("change", () => onChange(input.checked));
  return input;
}

export function button(label, className, onClick, iconName) {
  const b = el("button", { type: "button", className: `btn ${className}` }, iconName && icon(iconName), label);
  b.addEventListener("click", onClick);
  return b;
}

export function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export async function pickFile(description, accept) {
  try {
    const [handle] = await window.showOpenFilePicker({ types: [{ description, accept }] });
    return handle.getFile();
  } catch (err) {
    if (err?.name === "AbortError") return null;
    throw err;
  }
}

export function send(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, (r) => resolve(chrome.runtime.lastError ? null : r)));
}
