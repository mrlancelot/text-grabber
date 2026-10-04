import { getProfile, setProfile, setFile } from "../idb.js";
import { readPdf } from "../import/pdf.js";
import { parsePdfProfile } from "../lib/resume-pdf.js";
import { parseMarkdown } from "../lib/markdown.js";
import { el, icon, paneHeader, group, row, textArea, toggle, button, debounce, pickFile } from "./ui.js";

const CONTACT = [
  ["name", "Name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "Location"],
  ["linkedin", "LinkedIn"],
  ["github", "GitHub"],
  ["portfolio", "Website"],
];

const ROLE_FIELDS = [
  ["title", "Title"],
  ["company", "Company"],
  ["location", "Location"],
];

const SCHOOL_FIELDS = [
  ["school", "School"],
  ["degree", "Degree"],
  ["field", "Field of study"],
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyDate(value) {
  if (!value) return "";
  if (/present/i.test(value)) return "Present";
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : value;
}

function monthValue(value) {
  if (/^\d{4}-\d{2}$/.test(value || "")) return value;
  if (/^\d{4}$/.test(value || "")) return `${value}-01`;
  return "";
}

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default {
  id: "profile",
  title: "Profile",
  color: "var(--blue)",
  iconName: "person",
  keywords: "name email phone location linkedin github website summary experience role company education school degree skills import resume",

  async render(root) {
    let profile = (await getProfile()) || {};
    let imported = null;
    const open = new Set();
    const header = paneHeader("Profile", "Used to fill applications. Everything stays on this device.");
    const autosave = debounce(async () => {
      await setProfile(profile);
      header.saved();
    }, 600);
    const changed = () => {
      if (!imported) autosave();
    };

    function lf(label, control) {
      return el("label", { className: "lf" }, el("span", { className: "footnote secondary", textContent: label }), control);
    }

    function input(entry, key, props = {}) {
      const field = el("input", { className: "field", value: entry[key] || "", ...props });
      field.addEventListener("input", () => {
        entry[key] = field.value;
        changed();
      });
      return field;
    }

    function monthInput(entry, key) {
      const field = el("input", { className: "field", type: "month", value: monthValue(entry[key]) });
      field.addEventListener("change", () => {
        entry[key] = field.value;
        changed();
        draw();
      });
      return field;
    }

    function card() {
      const c = profile.contact || {};
      const roles = profile.experience?.length || 0;
      const schools = profile.education?.length || 0;
      const current = (profile.experience || []).find((r) => /present/i.test(r.endDate || ""));
      return el(
        "div",
        { className: "group profile-card" },
        el("div", { className: "avatar tile", textContent: initials(c.name) }),
        el(
          "div",
          { className: "profile-texts" },
          el("div", { className: "title2", textContent: c.name || "Your name" }),
          el("div", { className: "callout secondary", textContent: [current && `${current.title} at ${current.company}`, c.location].filter(Boolean).join(" · ") || "Import your LinkedIn PDF or resume to start" }),
          el("div", { className: "footnote tertiary", textContent: `${roles} ${roles === 1 ? "role" : "roles"} · ${schools} ${schools === 1 ? "school" : "schools"} · ${(profile.skills || []).length} skills` })
        ),
        button("Import…", "", importFile, "doc")
      );
    }

    function contactGroup() {
      profile.contact ??= {};
      return group(
        "Contact",
        CONTACT.map(([key, label]) => row(label, input(profile.contact, key, { className: "field bare", placeholder: "Add" })))
      );
    }

    function aboutGroup() {
      return group("About", [
        el("div", { className: "detail" }, textArea(profile.summary, (v) => ((profile.summary = v), changed()), { placeholder: "A short summary of your experience" })),
      ]);
    }

    function entryRow(listKey, entry, index, kind) {
      const isOpen = open.has(`${listKey}:${index}`);
      const current = kind === "role" && /present/i.test(entry.endDate || "");
      const dates = [prettyDate(entry.startDate), prettyDate(entry.endDate)].filter(Boolean).join(" – ");
      const title = kind === "role" ? entry.title : entry.school;
      const subtitle = kind === "role" ? [entry.company, dates].filter(Boolean).join(" · ") : [entry.degree, entry.field, dates].filter(Boolean).join(" · ");
      const summary = el(
        "div",
        { className: `row clickable entry${isOpen ? " open" : ""}`, tabIndex: 0 },
        el("div", { className: "initial", textContent: ((kind === "role" ? entry.company : entry.school) || "?")[0].toUpperCase() }),
        el("div", { className: "label" }, el("div", { className: "headline", textContent: title || (kind === "role" ? "New role" : "New school") }), el("div", { className: "footnote secondary", textContent: subtitle })),
        current && el("span", { className: "badge green", textContent: "Current" }),
        icon("chevron", "disclosure")
      );
      const flip = () => {
        const id = `${listKey}:${index}`;
        open.has(id) ? open.delete(id) : open.add(id);
        draw();
      };
      summary.addEventListener("click", flip);
      summary.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), flip()));
      if (!isOpen) return summary;

      const fields = kind === "role" ? ROLE_FIELDS : SCHOOL_FIELDS;
      const end = monthInput(entry, "endDate");
      end.disabled = current;
      const detail = el(
        "div",
        { className: "detail" },
        el("div", { className: "grid2" }, fields.map(([key, label]) => lf(label, input(entry, key)))),
        el("div", { className: "grid2" }, lf("Start", monthInput(entry, "startDate")), lf("End", end)),
        kind === "role" &&
          el(
            "label",
            { className: "inline-toggle body" },
            toggle(current, (on) => {
              entry.endDate = on ? "present" : "";
              changed();
              draw();
            }),
            "I currently work here"
          ),
        kind === "role" &&
          lf(
            "Highlights — one per line",
            textArea((entry.bullets || []).join("\n"), (v) => {
              entry.bullets = v.split("\n").map((b) => b.trim()).filter(Boolean);
              changed();
            })
          ),
        el(
          "div",
          { className: "detail-actions" },
          button(kind === "role" ? "Delete Role" : "Delete School", "plain destructive", () => {
            profile[listKey].splice(index, 1);
            open.clear();
            changed();
            draw();
          }),
          button("Done", "", flip)
        )
      );
      return [summary, detail];
    }

    function listGroup(listKey, title, kind, addLabel) {
      profile[listKey] ??= [];
      const add = el("div", { className: "row button-row", tabIndex: 0 }, icon("plus", "add-icon"), el("span", { className: "body", textContent: addLabel }));
      const addEntry = () => {
        profile[listKey].unshift(kind === "role" ? { title: "", company: "", location: "", startDate: "", endDate: "", bullets: [] } : { school: "", degree: "", field: "", startDate: "", endDate: "" });
        open.clear();
        open.add(`${listKey}:0`);
        draw();
      };
      add.addEventListener("click", addEntry);
      add.addEventListener("keydown", (e) => e.key === "Enter" && addEntry());
      return group(title, [...profile[listKey].flatMap((e, i) => entryRow(listKey, e, i, kind)), add]);
    }

    function skillsGroup() {
      profile.skills ??= [];
      const entry = el("input", { className: "field bare chip-input", placeholder: profile.skills.length ? "Add skill" : "Add skills, press Enter" });
      const commit = () => {
        const parts = entry.value.split(",").map((s) => s.trim()).filter(Boolean);
        if (!parts.length) return;
        profile.skills.push(...parts.filter((p) => !profile.skills.includes(p)));
        changed();
        draw();
        root.querySelector(".chip-input")?.focus();
      };
      entry.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          commit();
        } else if (e.key === "Backspace" && !entry.value && profile.skills.length) {
          profile.skills.pop();
          changed();
          draw();
          root.querySelector(".chip-input")?.focus();
        }
      });
      entry.addEventListener("blur", commit);
      const chips = profile.skills.map((skill, i) => {
        const remove = el("button", { type: "button", ariaLabel: `Remove ${skill}` }, icon("xmark"));
        remove.addEventListener("click", () => {
          profile.skills.splice(i, 1);
          changed();
          draw();
        });
        return el("span", { className: "chip" }, skill, remove);
      });
      return group("Skills", [el("div", { className: "chips" }, chips, entry)]);
    }

    function importBar() {
      return el(
        "div",
        { className: "bottom-bar" },
        el("span", { className: "callout secondary", textContent: `Imported from ${imported}. Review, then save.` }),
        button("Discard", "", async () => {
          profile = (await getProfile()) || {};
          imported = null;
          draw();
        }),
        button("Save", "prominent", async () => {
          await setProfile(profile);
          imported = null;
          header.saved();
          draw();
        })
      );
    }

    async function importFile() {
      const file = await pickFile("LinkedIn PDF, resume PDF or Markdown", { "application/pdf": [".pdf"], "text/markdown": [".md", ".markdown"] });
      if (!file) return;
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const parsed = isPdf ? parsePdfProfile(await readPdf(file)) : parseMarkdown(await file.text());
      if (isPdf && !parsed.fromLinkedIn) await setFile("resume", { name: file.name, type: file.type, blob: file, addedAt: Date.now() });
      delete parsed.fromLinkedIn;
      profile = parsed;
      imported = file.name;
      open.clear();
      draw();
    }

    function draw() {
      const scroll = root.parentElement.scrollTop;
      root.replaceChildren(...[
        header.node,
        imported && el("div", { className: "banner" }, icon("check"), `Imported ${profile.experience?.length || 0} roles and ${profile.education?.length || 0} schools from ${imported}. Check everything below, then Save.`),
        card(),
        contactGroup(),
        aboutGroup(),
        listGroup("experience", "Experience", "role", "Add Role"),
        listGroup("education", "Education", "school", "Add School"),
        skillsGroup(),
        imported && importBar()
      ].filter((child) => child != null && child !== false));
      root.parentElement.scrollTop = scroll;
    }

    draw();
  },
};
