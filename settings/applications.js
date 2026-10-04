import { listApplications, getFile, deleteApplication } from "../idb.js";
import { el, icon, paneHeader, group, row, button, popup, send } from "./ui.js";

const DAY = 86400000;
const STATUSES = [["saved", "Saved"], ["applied", "Applied"], ["interview", "Interviewing"], ["offer", "Offer"], ["rejected", "Rejected"]];
const LABEL = Object.fromEntries(STATUSES);
const REPLIES = ["interview", "offer", "rejected"];

const firstAt = (app, statuses) => app.history?.find((h) => statuses.includes(h.status))?.at;
const lastAt = (app) => Date.parse(app.history?.at(-1)?.at || app.savedAt);

function statusLabel(app, now) {
  return app.status === "applied" && now - lastAt(app) > 21 * DAY ? "No reply in 3+ weeks" : LABEL[app.status] || "Saved";
}

function digest(apps, now) {
  const applied = apps.filter((a) => firstAt(a, ["applied"]));
  if (!applied.length) return null;
  const since = (a) => now - Date.parse(firstAt(a, ["applied"]));
  const replied = applied.filter((a) => firstAt(a, REPLIES));
  const days = replied.map((a) => (Date.parse(firstAt(a, REPLIES)) - Date.parse(firstAt(a, ["applied"]))) / DAY);
  const hosts = new Map();
  for (const a of applied) {
    const host = new URL(a.url).hostname;
    const h = hosts.get(host) || { total: 0, replied: 0 };
    h.total++;
    if (firstAt(a, REPLIES)) h.replied++;
    hosts.set(host, h);
  }
  return group(
    "Your search",
    [
      row("Applied in the last 7 days", el("span", { className: "callout", textContent: String(applied.filter((a) => since(a) < 7 * DAY).length) })),
      row("Reply rate", el("span", { className: "callout", textContent: `${Math.round((replied.length / applied.length) * 100)}% (${replied.length} of ${applied.length})` })),
      days.length && row("Average days to a reply", el("span", { className: "callout", textContent: String(Math.round(days.reduce((x, y) => x + y, 0) / days.length)) })),
      row("Follow-ups due", el("span", { className: "callout", textContent: String(applied.filter((a) => a.status === "applied" && since(a) >= 7 * DAY).length) })),
      row("Replies by site", el("span", { className: "callout secondary", textContent: [...hosts].map(([h, v]) => `${h} ${v.replied}/${v.total}`).join(" · ") })),
    ].filter(Boolean)
  );
}

export default {
  id: "applications",
  title: "Applications",
  color: "var(--yellow)",
  iconName: "briefcase",
  keywords: "applications jobs saved tailored resume",

  async render(root) {
    const header = paneHeader("Applications", "Jobs you saved, where each one stands, and the resume tailored for it.");
    const list = el("div");
    const open = new Set();
    let apps = await listApplications();

    async function download(app) {
      const file = await getFile(`resume:${app.id}`);
      if (!file) return;
      const a = el("a", { href: URL.createObjectURL(file.blob), download: file.name });
      a.click();
      URL.revokeObjectURL(a.href);
    }

    function detail(app) {
      const tailor = button(app.tailoredResume ? "Re-tailor resume" : "Tailor resume", "prominent", async () => {
        tailor.disabled = true;
        tailor.textContent = "Tailoring…";
        const response = await send({ type: "TG_TAILOR", id: app.id });
        if (response?.ok) header.saved();
        apps = await listApplications();
        draw();
      });
      const status = popup(STATUSES, app.status || "saved", async (value) => {
        await send({ type: "TG_SET_STATUS", id: app.id, status: value });
        header.saved();
        apps = await listApplications();
        draw();
      });
      return el(
        "div",
        { className: "detail" },
        el("div", { className: "inline" }, el("span", { className: "footnote secondary", textContent: "Status" }), status),
        app.tailoredResume && el("div", { className: "footnote secondary", textContent: `Summary: ${app.tailoredResume.summary}` }),
        el(
          "div",
          { className: "detail-actions" },
          el(
            "div",
            { className: "inline" },
            el("a", { className: "btn", href: app.url, target: "_blank", rel: "noopener", textContent: "Open posting" }),
            button("Remove", "destructive", async () => {
              await deleteApplication(app.id);
              apps = apps.filter((a) => a !== app);
              header.saved();
              draw();
            })
          ),
          el("div", { className: "inline" }, app.tailoredResume && button("Download .docx", "", () => download(app)), tailor)
        )
      );
    }

    function draw() {
      if (!apps.length) {
        list.replaceChildren(el("div", { className: "empty" }, icon("briefcase", "empty-icon"), el("div", { className: "headline", textContent: "No jobs yet" }), el("div", { className: "footnote secondary", textContent: "Click Save Job or Tailor Resume on a posting and it shows up here." })));
        return;
      }
      const now = Date.now();
      list.replaceChildren(
        digest(apps, now) || "",
        group(
          `${apps.length} ${apps.length === 1 ? "job" : "jobs"}`,
          apps.flatMap((app) => {
            const jd = app.jdStructured || {};
            const entry = el(
              "div",
              { className: `row clickable entry${open.has(app.id) ? " open" : ""}` },
              icon("chevron", "disclosure"),
              el(
                "div",
                { className: "label" },
                el("div", { className: "headline", textContent: jd.title || app.url }),
                el("div", { className: "footnote secondary", textContent: [jd.company, new Date(app.savedAt).toLocaleDateString()].filter(Boolean).join(" · ") })
              ),
              el("div", { className: "inline" }, app.tailoredResume && el("span", { className: "badge green", textContent: "Tailored" }), el("span", { className: "badge", textContent: statusLabel(app, now) }))
            );
            entry.addEventListener("click", () => {
              open.has(app.id) ? open.delete(app.id) : open.add(app.id);
              draw();
            });
            return open.has(app.id) ? [entry, detail(app)] : [entry];
          })
        )
      );
    }

    root.replaceChildren(header.node, list);
    draw();
  },
};
