const PREF_HEAD = /prefer|nice|bonus|plus|desir|ideal|extra/i;
const SKIP_HEAD = /responsib|you.ll do|you will|day to day|benefit|perk|offer|salary|compensation|pay range|equal|about (us|the|our)|who we are|life at/i;
const REQ_HEAD = /requir|qualif|must|minimum|basic|need|you have|you bring|skill|experience/i;
const PREF_ITEM = /\b(preferred|nice to have|bonus|a plus|desired|ideally)\b/i;
const MAX_ITEMS = 12;

const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
const meta = (name) => clean(document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content);

function ldPosting() {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent);
      const nodes = [data, ...(Array.isArray(data) ? data : data["@graph"] || [])].flat();
      const posting = nodes.find((n) => [].concat(n?.["@type"]).includes("JobPosting"));
      if (posting) return posting;
    } catch {}
  }
  return null;
}

function companyFrom(title) {
  const rest = clean(
    document.title
      .replace(title, " ")
      .replace(/\b(job application|application|jobs?|careers?|at|for)\b/gi, " ")
      .replace(/[-–—|@·:]+/g, " ")
  );
  return rest || meta("og:site_name");
}

function listRoot() {
  const counts = new Map();
  for (const li of document.querySelectorAll("li")) {
    if (li.closest("nav, header, footer, form, [role=navigation]")) continue;
    for (let el = li.parentElement; el && el !== document.body; el = el.parentElement) counts.set(el, (counts.get(el) || 0) + 1);
  }
  const most = Math.max(0, ...counts.values());
  const close = [...counts].filter(([, n]) => n >= most * 0.8).map(([el]) => el);
  return close.sort((a, b) => a.textContent.length - b.textContent.length)[0] || document.body;
}

function isHeading(el) {
  if (/^H[1-6]$/.test(el.tagName)) return true;
  if (!/^(P|DIV|SPAN)$/.test(el.tagName) || el.closest("li")) return false;
  const text = clean(el.textContent);
  const bold = clean([...el.querySelectorAll("strong, b")].map((b) => b.textContent).join(" "));
  return text.length > 2 && text.length < 80 && bold === text;
}

function groups(root) {
  const out = [];
  let current = { head: "", items: [] };
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    if (isHeading(el)) {
      if (current.items.length) out.push(current);
      current = { head: clean(el.textContent), items: [] };
    } else if (el.tagName === "LI" && !el.querySelector("li")) current.items.push(clean(el.textContent));
  }
  if (current.items.length) out.push(current);
  if (out.length) return out;
  const lines = root.textContent.split(/\n+/).map(clean).filter((l) => /^[•*·-]\s/.test(l));
  return lines.length ? [{ head: "", items: lines.map((l) => l.replace(/^[•*·-]\s*/, "")) }] : [];
}

function yearsIn(texts) {
  let best = null;
  for (const text of texts) {
    for (const m of text.matchAll(/(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?years?(?=[^.]{0,40}experience)/gi)) {
      const n = +m[1];
      if (n > 0 && n <= 25) best = best == null ? n : Math.min(best, n);
    }
  }
  return best;
}

export function readJob() {
  const posting = ldPosting();
  const title = clean(posting?.title) || meta("og:title") || clean(document.querySelector("h1")?.textContent);
  const company = clean(posting?.hiringOrganization?.name) || companyFrom(title);
  const root = posting?.description ? new DOMParser().parseFromString(String(posting.description), "text/html").body : listRoot();

  const mustHave = [];
  const niceToHave = [];
  let unknownSeen = false;
  for (const { head, items } of groups(root)) {
    let kind = PREF_HEAD.test(head) ? "nice" : SKIP_HEAD.test(head) ? "skip" : REQ_HEAD.test(head) ? "must" : null;
    if (!kind) {
      kind = unknownSeen || mustHave.length ? "nice" : "must";
      unknownSeen = true;
    }
    if (kind === "skip") continue;
    for (const item of items) {
      if (item.length < 8 || item.length > 300) continue;
      (kind === "must" && !PREF_ITEM.test(item) ? mustHave : niceToHave).push(item);
    }
  }

  const text = clean(root.textContent).slice(0, 20000);
  return {
    title,
    company,
    datePosted: posting?.datePosted || "",
    validThrough: posting?.validThrough || "",
    baseSalary: posting?.baseSalary || null,
    remote: [].concat(posting?.jobLocationType || []).includes("TELECOMMUTE"),
    yearsRequired: yearsIn(mustHave) ?? yearsIn([text]),
    mustHave: mustHave.slice(0, MAX_ITEMS),
    niceToHave: niceToHave.slice(0, MAX_ITEMS),
    text,
  };
}
