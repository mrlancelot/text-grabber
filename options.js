import profile from "./settings/profile.js";
import answers from "./settings/answers.js";
import resume from "./settings/resume.js";
import saved from "./settings/saved.js";
import applications from "./settings/applications.js";
import data from "./settings/data.js";
import { ai, jobs, sites, debug } from "./settings/general.js";
import { el, icon } from "./settings/ui.js";

const PANES = [profile, answers, resume, saved, applications, ai, sites, data, jobs, debug];
const nav = document.querySelector(".nav");
const paneRoot = document.getElementById("pane");

const items = PANES.map((pane) => {
  const item = el(
    "button",
    { type: "button", className: "nav-item" },
    el("span", { className: "nav-icon tile", style: `--tile: ${pane.color}` }, icon(pane.iconName)),
    pane.title
  );
  item.addEventListener("click", () => (location.hash = pane.id));
  nav.append(item);
  return { pane, item };
});

const search = el("input", { className: "field", type: "search", placeholder: "Search" });
document.querySelector(".search").append(icon("magnifier"), search);
search.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  for (const { pane, item } of items) item.hidden = q && !`${pane.title} ${pane.keywords}`.toLowerCase().includes(q);
  const first = items.find(({ item }) => !item.hidden);
  if (first && items.find(({ pane }) => pane.id === current)?.item.hidden) location.hash = first.pane.id;
});

let current = null;
async function show() {
  const { tgPending } = await chrome.storage.local.get("tgPending");
  const id = location.hash.slice(1) || (tgPending ? "jobs" : "profile");
  const pane = PANES.find((p) => p.id === id) || profile;
  current = pane.id;
  for (const { pane: p, item } of items) {
    if (p === pane) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  paneRoot.parentElement.scrollTop = 0;
  await pane.render(paneRoot);
}

window.addEventListener("hashchange", show);
show();
