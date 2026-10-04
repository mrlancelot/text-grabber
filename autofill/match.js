import {
  OPTION_SYNONYMS,
  DISABILITY_SYNONYMS,
  CHOICE_KEYS,
  FIELD_KEYS,
} from "./keys.js";

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\p{Cf}/gu, "")
    .replace(/[‘’]/g, "'")
    .replace(/[*:;,.()[\]{}"!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const AUTOCOMPLETE = {
  "given-name": "firstName",
  "family-name": "lastName",
  name: "fullName",
  email: "email",
  tel: "phone",
  "tel-national": "phone",
  "street-address": "addressLine1",
  "address-line1": "addressLine1",
  "address-level2": "city",
  "address-level1": "state",
  "postal-code": "postalCode",
  "country-name": "country",
  organization: "currentCompany",
  "organization-title": "currentTitle",
};

export function exactKey(desc) {
  if (desc.kind !== "text") return null;
  const tokens = [String(desc.autocomplete || "").toLowerCase().split(/\s+/).pop(), normalize(desc.label), String(desc.name || "").toLowerCase()];
  const hit = tokens.find((t) => AUTOCOMPLETE[t]);
  if (hit) return AUTOCOMPLETE[hit];
  if (desc.inputType === "email") return "email";
  if (desc.inputType === "tel") return "phone";
  return null;
}

export function signature(desc) {
  return [normalize(desc.label), desc.kind, desc.options.slice(0, 6).map(normalize).join("/")].join("|");
}
export function isOpenQuestion(desc) {
  if (desc.kind === "textarea") return true;
  if (desc.kind !== "text") return false;
  const label = String(desc.label || "");
  return label.length > 25 && (/\?\s*\*?\s*$/.test(label) || /^(why|what|how|describe|tell us|explain|please (describe|explain|share))/i.test(label.trim()));
}
export function matchChoice(key, choice, options) {
  const table = key === "eeo.disability" ? { ...OPTION_SYNONYMS, ...DISABILITY_SYNONYMS } : OPTION_SYNONYMS;
  const syn = table[choice];
  if (!syn) return -1;
  const norm = options.map(normalize);
  return norm.findIndex((o) => o && syn.re.test(o) && !(syn.not && syn.not.test(o)));
}

const COUNTRY_ALIASES = {
  "united states": ["us", "usa", "u s", "u s a", "united states of america", "america"],
  "united kingdom": ["uk", "u k", "great britain", "britain", "england"],
  "united arab emirates": ["uae"],
};

function aliases(text) {
  const n = normalize(text);
  for (const [canonical, list] of Object.entries(COUNTRY_ALIASES)) {
    if (n === canonical || list.includes(n)) return [canonical, ...list];
  }
  return [n];
}
export function matchText(value, options) {
  if (value == null || value === "") return -1;
  const wanted = aliases(value);
  const norm = options.map(normalize);
  let i = norm.findIndex((o) => wanted.includes(o));
  if (i >= 0) return i;
  i = norm.findIndex((o) => wanted.some((w) => o.startsWith(w + " ") || w.startsWith(o + " ")));
  if (i >= 0) return i;
  const v = wanted[0];
  if (v.length >= 4) {
    i = norm.findIndex((o) => o.includes(v));
    if (i >= 0) return i;
  }
  const n = amount(String(value));
  if (n != null) {
    i = options.findIndex((o) => {
      const nums = String(o).match(/\d[\d,]*(?:\.\d+)?\s*k?/gi)?.map(amount) || [];
      if (nums.length >= 2 && /\d\s*k?\s*(?:-|–|to)\s*\$?\s*\d/i.test(o)) return n >= nums[0] && n <= nums[1];
      if (nums.length && /\+|or more|more than|above|over/i.test(o)) return n >= nums[0];
      if (nums.length && /less than|under|below|up to/i.test(o)) return n < nums[0];
      return false;
    });
  }
  return i;
}

function amount(text) {
  const m = /^\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:years?|yrs?)?\s*$/i.exec(text);
  return m ? parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1) : null;
}
export function matchOption(key, value, options) {
  const real = options.map((o) => normalize(o)).filter((o) => !/^(select|choose|please select|--)/.test(o));
  if (real.length === 0) return -1;
  if (CHOICE_KEYS[key] && CHOICE_KEYS[key].includes(value)) {
    return matchChoice(key, value, options);
  }
  return matchText(value, options);
}

const STOP = new Set("a an the of to you your are is do did in on for and or with this that we our be have has will would at as".split(" "));

export function questionTokens(text) {
  return normalize(text).split(" ").filter((t) => t.length > 1 && !STOP.has(t));
}
export function findLearnedExact(question, learned) {
  const q = normalize(question);
  return learned.find((l) => l.normalizedQ === q) || null;
}
export function rankLearned(question, learned, n = 20) {
  const q = new Set(questionTokens(question));
  if (q.size === 0) return [];
  return learned
    .map((l) => {
      const t = new Set(questionTokens(l.questionText));
      let inter = 0;
      for (const w of q) if (t.has(w)) inter++;
      return { ...l, score: inter / (q.size + t.size - inter || 1) };
    })
    .filter((x) => x.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

const DESC_TOKENS = Object.fromEntries(Object.entries(FIELD_KEYS).map(([k, d]) => [k, new Set(questionTokens(d))]));
const DOC_FREQ = {};
for (const tokens of Object.values(DESC_TOKENS)) for (const t of tokens) DOC_FREQ[t] = (DOC_FREQ[t] || 0) + 1;

function sameWord(a, b) {
  if (a === b) return true;
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n >= 5 && n >= 0.6 * Math.min(a.length, b.length);
}

export function descriptionScore(key, label) {
  const words = questionTokens(label);
  let idf = 0;
  let matched = 0;
  for (const t of DESC_TOKENS[key]) {
    if (words.some((w) => sameWord(w, t))) {
      idf += 1 / DOC_FREQ[t];
      matched++;
    }
  }
  return matched ? idf + matched / DESC_TOKENS[key].size : 0;
}

export function bestKey(label, keys) {
  const ranked = keys.map((k) => [k, descriptionScore(k, label)]).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (!top || top[1] < 0.75) return null;
  if (top[1] >= 1 && top[1] >= 1.5 * (second?.[1] || 0)) return top[0];
  const coverage = ranked.filter(([, s]) => s >= 0.6 * top[1]).map(([k]) => [k, coverOf(k, label)]).sort((a, b) => b[1] - a[1]);
  return coverage[0][1] > (coverage[1]?.[1] ?? 0) ? coverage[0][0] : null;
}

function coverOf(key, label) {
  const words = questionTokens(label);
  let matched = 0;
  for (const t of DESC_TOKENS[key]) if (words.some((w) => sameWord(w, t))) matched++;
  return matched / DESC_TOKENS[key].size;
}

export function isYesNo(options) {
  const real = options.map(normalize).filter(Boolean);
  return real.length > 0 && real.every((o) => ["yes", "no", "decline"].some((c) => OPTION_SYNONYMS[c].re.test(o)));
}

export function sharesWord(value, options) {
  const words = new Set(questionTokens(value).filter((w) => w.length > 2));
  return options.some((o) => questionTokens(o).some((w) => words.has(w)));
}
