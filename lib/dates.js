// Date parsing for resume / LinkedIn date ranges. Pure functions (unit-tested in node).

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const PRESENT = /^(present|current|now|today|ongoing)$/i;

// "January 2020" | "Jan 2020" | "01/2020" | "2020-01" | "2020" | "Present" -> "2020-01" | "2020" | "present" | ""
export function parseDate(text) {
  const t = String(text || "").trim().replace(/[.,]/g, "");
  if (!t) return "";
  if (PRESENT.test(t)) return "present";
  let m = /^([a-z]+)\s+(\d{4})$/i.exec(t);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[2]}-${pad(MONTHS[m[1].toLowerCase()])}`;
  m = /^(\d{1,2})\s*\/\s*(\d{4})$/.exec(t);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${pad(+m[1])}`;
  m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${pad(+m[2])}`;
  m = /^(?:[a-z]+\s+)?(\d{4})$/i.exec(t); // "2020" or "Summer 2020"
  if (m) return m[1];
  return "";
}

const RANGE_SEP = /\s*(?:-|–|—|\bto\b|\buntil\b)\s*/i;

// "January 2020 - Present (3 years 2 months)" -> { start: "2020-01", end: "present" }
// Returns null when the text isn't a date range.
export function parseDateRange(text) {
  const t = String(text || "")
    .replace(/\([^)]*\)/g, "") // LinkedIn's "(3 years 2 months)" duration
    .replace(/·/g, " ")
    .trim();
  const parts = t.split(RANGE_SEP).filter(Boolean);
  if (parts.length === 2) {
    const start = parseDate(parts[0]);
    const end = parseDate(parts[1]);
    if (start && end && start !== "present") return { start, end };
  }
  if (parts.length === 1) {
    const only = parseDate(parts[0]);
    if (only && only !== "present") return { start: only, end: only };
  }
  return null;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// "2020-03" | "2020" | "present" -> months since year 0 (start of year for bare years).
function toMonthIndex(value, now, isEnd) {
  if (value === "present") return now.getFullYear() * 12 + now.getMonth();
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(value || "");
  if (!m) return null;
  const month = m[2] ? +m[2] - 1 : isEnd ? 11 : 0;
  return +m[1] * 12 + month;
}

// Total years of experience across roles, counting overlapping roles once.
export function yearsOfExperience(roles, now = new Date()) {
  const spans = [];
  for (const r of roles || []) {
    const start = toMonthIndex(r.startDate, now, false);
    const end = toMonthIndex(r.endDate || "present", now, true);
    if (start != null && end != null && end >= start) spans.push([start, end + 1]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  let months = 0;
  let cur = null;
  for (const s of spans) {
    if (!cur || s[0] > cur[1]) {
      if (cur) months += cur[1] - cur[0];
      cur = [...s];
    } else {
      cur[1] = Math.max(cur[1], s[1]);
    }
  }
  if (cur) months += cur[1] - cur[0];
  return Math.round(months / 12);
}
