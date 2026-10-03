import { parseDateRange } from "./dates.js";

export function parseMarkdown(md) {
  const lines = md.split(/\r?\n/).map((l) => l.trim());
  const sections = {};
  let current = "_top";
  sections[current] = [];
  for (const line of lines) {
    const h = /^#{1,3}\s+(.*)$/.exec(line);
    if (h) {
      current = h[1].toLowerCase();
      sections[current] = [];
    } else if (line) sections[current].push(line.replace(/^[-*]\s+/, ""));
  }
  const text = md;
  const find = (re) => (text.match(re) || [""])[0];
  const name = (/^#\s+(.*)$/m.exec(md) || [, sections._top[0] || ""])[1];
  const get = (...keys) => keys.map((k) => Object.keys(sections).find((s) => s.includes(k))).find(Boolean);
  const expKey = get("experience", "employment");
  const eduKey = get("education");
  const skillKey = get("skills");
  const summaryKey = get("summary", "about", "profile");
  return {
    contact: {
      name,
      email: find(/[\w.+-]+@[\w-]+\.[\w.-]+/),
      phone: find(/\+?\d[\d\s().-]{8,}\d/).trim(),
      linkedin: find(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/),
      github: find(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/),
      location: "",
      portfolio: "",
    },
    summary: summaryKey ? sections[summaryKey].join(" ") : "",
    experience: expKey ? parseBlocks(sections[expKey]) : [],
    education: eduKey ? sections[eduKey].map((l) => ({ school: l, degree: "", field: "", startDate: "", endDate: "" })) : [],
    skills: skillKey ? sections[skillKey].join(",").split(/[,;|]/).map((s) => s.trim()).filter(Boolean) : [],
    certifications: [],
  };
}

function parseBlocks(lines) {
  const roles = [];
  for (const line of lines) {
    const range = /(\w+\.? \d{4}|\d{4})\s*[-–—to]+\s*(\w+\.? \d{4}|\d{4}|present)/i.exec(line);
    const head = line.replace(range ? range[0] : "", "").replace(/[()|,–—-]+\s*$/, "").trim();
    if (range) {
      const [title, company] = head.split(/\s+(?:at|@|\||-|–)\s+/);
      const parsed = parseDateRange(range[0]);
      roles.push({ title: title || "", company: company || "", location: "", startDate: parsed?.start || "", endDate: parsed?.end || "", bullets: [] });
    } else if (roles.length) {
      roles[roles.length - 1].bullets.push(line);
    }
  }
  return roles;
}
