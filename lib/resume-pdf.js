import { parseDateRange } from "./dates.js";

const DURATION = /^\d+\s+(years?|months?)(\s+\d+\s+months?)?$/i;
const BULLET = /^[•·▪◦\-–*]\s*/;
const SPLIT_TITLE = /\s+[—–|]\s+|\s+-\s+/;

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

function toRows(items, page) {
  const rows = [];
  for (const it of items) {
    const str = decode(it.str);
    if (!str) continue;
    let row = rows.find((r) => Math.abs(r.y - it.y) <= 2);
    if (!row) rows.push((row = { y: it.y, page, parts: [] }));
    row.parts.push({ ...it, str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => {
      const parts = r.parts.sort((a, b) => a.x - b.x).map((p) => p.str);
      return { page: r.page, text: parts.join(" "), parts, size: Math.max(...r.parts.map((p) => p.size)) };
    })
    .filter((r) => !/^Page \d+ of \d+$/.test(r.text));
}

function mode(values) {
  const counts = {};
  for (const v of values) counts[v.toFixed(1)] = (counts[v.toFixed(1)] || 0) + 1;
  return +Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

const SECTIONS = [
  ["experience", /experience|employment/i],
  ["education", /education/i],
  ["skills", /skill/i],
  ["summary", /summary|about|profile/i],
  ["projects", /project/i],
  ["certifications", /certif|licens/i],
  ["contact", /contact/i],
];

function isHeading(row, body) {
  const letters = row.text.replace(/[^A-Za-z]/g, "");
  return row.size >= body + 2 || (letters.length > 2 && letters === letters.toUpperCase() && row.text.split(" ").length <= 5);
}

function splitSections(rows, body) {
  const out = { _top: [] };
  let current = "_top";
  for (const row of rows) {
    if (isHeading(row, body)) {
      const found = SECTIONS.find(([, re]) => re.test(row.text));
      current = found ? found[0] : `other:${row.text}`;
      out[current] ??= [];
      continue;
    }
    out[current].push(row);
  }
  return out;
}

function rowRange(row) {
  for (const [i, part] of row.parts.entries()) {
    const range = /\d{4}/.test(part) && parseDateRange(part);
    if (range) return { range, header: row.parts.filter((p, j) => j !== i && !/^\(.*\)$/.test(p)).join(" ").trim() };
  }
  return null;
}

function toBullets(rows) {
  const bullets = [];
  for (const r of rows) {
    if (BULLET.test(r.text) || !bullets.length) bullets.push(r.text.replace(BULLET, ""));
    else bullets[bullets.length - 1] += ` ${r.text}`;
  }
  return bullets.filter(Boolean);
}

function parseExperience(rows, body) {
  const anchors = rows.map((r, i) => ({ i, ...rowRange(r) })).filter((a) => a.range);
  const roles = [];
  let company = "";
  anchors.forEach((a, n) => {
    const role = { company: "", title: "", location: "", startDate: a.range.start, endDate: a.range.end, bullets: [] };
    let bodyStart = a.i + 1;
    if (a.header) {
      company = a.header;
      const [title, location] = (rows[a.i + 1]?.text || "").split(SPLIT_TITLE);
      Object.assign(role, { title: title || "", location: location || "" });
      bodyStart = a.i + 2;
      a.headerStart = a.i;
    } else {
      role.title = rows[a.i - 1]?.text || "";
      let j = a.i - 2;
      if (rows[j] && DURATION.test(rows[j].text)) j--;
      if (rows[j] && rows[j].size > body + 0.2 && rows[j].size > rows[a.i - 1].size) company = rows[j].text;
      a.headerStart = rows[j] && rows[j].text === company ? j : a.i - 1;
      const next = rows[a.i + 1];
      if (next && next.text.length < 50 && !/[.!?]$/.test(next.text) && !BULLET.test(next.text)) {
        role.location = next.text;
        bodyStart = a.i + 2;
      }
    }
    role.company = company;
    a.bodyStart = bodyStart;
    roles.push(role);
  });
  anchors.forEach((a, n) => {
    const end = n + 1 < anchors.length ? anchors[n + 1].headerStart : rows.length;
    roles[n].bullets = toBullets(rows.slice(a.bodyStart, end));
  });
  return roles;
}

function parseEducation(rows, body) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const start = i;
    let text = rows[i].text;
    if (/\(\s*[^)]*$/.test(text) && rows[i + 1]) text += ` ${rows[++i].text}`;
    const paren = /^(.*?)\s*·?\s*\(([^)]*\d{4}[^)]*)\)\s*$/.exec(text);
    const range = paren ? parseDateRange(paren[2]) : rowRange(rows[start])?.range;
    if (!range) continue;
    const head = paren ? paren[1] : rowRange(rows[start]).header;
    const big = rows[start - 1] && rows[start - 1].size > body + 0.2;
    const [degree, field] = head.split(/,\s*/);
    const school = big ? rows[start - 1].text : rows[i + 1]?.text || "";
    out.push({ school, degree: degree || "", field: field || "", startDate: range.start === range.end ? "" : range.start, endDate: range.end });
  }
  return out;
}

function parseSkills(rows) {
  return rows
    .flatMap((r) => r.text.replace(/^[^:]{1,30}:\s*/, "").split(/\s*[,·•|]\s*/))
    .map((s) => s.trim())
    .filter((s) => s && s.length < 60);
}

function contactFrom(text) {
  const find = (re) => (text.match(re) || [""])[0];
  return {
    email: find(/[\w.+-]+@[\w-]+\.[\w.-]+/),
    phone: find(/(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/).trim(),
    linkedin: find(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/),
    github: find(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/),
  };
}

export function parsePdfProfile({ author, pages }) {
  const linkedin = author === "LinkedIn";
  const side = [];
  const main = [];
  const kept = pages.map((items) => items.filter((i) => decode(i.str)));
  const split = linkedin ? Math.min(...kept[0].map((i) => i.x)) + 180 : -Infinity;
  kept.forEach((kept, n) => {
    side.push(...toRows(kept.filter((i) => i.x < split), n));
    main.push(...toRows(kept.filter((i) => i.x >= split), n));
  });

  const body = mode(main.map((r) => r.size));
  const nameRow = main.filter((r) => r.page === 0).sort((a, b) => b.size - a.size)[0];
  const sections = splitSections(main.filter((r) => r !== nameRow), body);
  const sideSections = splitSections(side, mode(side.length ? side.map((r) => r.size) : [body]));
  const top = sections._top;
  const allText = [...side, ...main].map((r) => r.text).join(" ");
  const location = top.find((r) => /,/.test(r.text) && !/[@⋄|]|\d{3}/.test(r.text) && r.text.length < 60)?.text || "";

  return {
    fromLinkedIn: linkedin,
    contact: { name: nameRow?.text || "", location, portfolio: "", ...contactFrom(allText) },
    summary: (sections.summary || []).map((r) => r.text).join(" "),
    experience: parseExperience(sections.experience || [], body),
    education: parseEducation(sections.education || [], body),
    skills: parseSkills(linkedin ? sideSections.skills || [] : sections.skills || []),
    certifications: (sideSections.certifications || sections.certifications || []).map((r) => r.text),
  };
}
