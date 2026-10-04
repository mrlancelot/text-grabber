const DAY = 86400000;
const MONEY = /(?:[$€£]|usd|eur|gbp)\s?\d[\d,]*(?:\.\d+)?\s?k?\s*(?:-|–|—|to)\s*(?:[$€£]|usd|eur|gbp)?\s?\d[\d,]*(?:\.\d+)?\s?k?/i;
const NO_SPONSOR = /\b(not|unable|no|cannot|can't|won't|will not|without|doesn't|does not)\b[^.]{0,50}\b(sponsor|visa)|\b(sponsor\w*|visa)\b[^.]{0,30}\b(not (be )?(available|provided|offered|possible))/i;
const SPONSOR = /\b(sponsor\w*|visa support|h-?1b)\b/i;
const FREE_MAIL = /[\w.+-]+@(gmail|yahoo|outlook|hotmail|aol|icloud|proton(mail)?)\.\w+/i;
const CHAT_APP = /\b(whatsapp|telegram)\b/i;
const PAY_TO_WORK = /\b((purchase|buy) (your own |the )?(equipment|laptop)|check deposit|training fee|wire transfer|gift cards?|pay (a|the|an) (fee|deposit))\b/i;

const short = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

function salary(job) {
  const s = job.baseSalary;
  const v = s?.value;
  if (v && (v.minValue || v.value)) {
    const sign = { USD: "$", EUR: "€", GBP: "£" }[s.currency] ?? `${s.currency || ""} `;
    const range = v.maxValue && v.maxValue !== v.minValue ? `${short(v.minValue)}-${sign}${short(v.maxValue)}` : short(v.minValue || v.value);
    const unit = { YEAR: "/yr", HOUR: "/hr", MONTH: "/mo" }[v.unitText] || "";
    return `${sign}${range}${unit}`;
  }
  return MONEY.exec(job.text)?.[0].replace(/\s+/g, " ").replace(/\s?[–—]\s?/, "-") || "";
}

function workplace(job) {
  if (job.remote) return "Remote";
  if (/\bhybrid\b/i.test(job.text)) return "Hybrid";
  if (/\bremote\b/i.test(job.text)) return "Remote";
  if (/\bon-?site\b|\bin[- ]office\b/i.test(job.text)) return "On-site";
  return "";
}

function sponsorship(job) {
  if (NO_SPONSOR.test(job.text)) return "No visa sponsorship";
  if (SPONSOR.test(job.text)) return "Mentions visa sponsorship";
  return "";
}

function warnings(job, now) {
  const out = [];
  const posted = Date.parse(job.datePosted);
  if (posted && now - posted > 30 * DAY) out.push(`Posted ${Math.round((now - posted) / DAY)} days ago`);
  const until = Date.parse(job.validThrough);
  if (until && until < now) out.push("The listing has expired");
  if (FREE_MAIL.test(job.text)) out.push("Contact uses a personal email address");
  if (CHAT_APP.test(job.text)) out.push("Asks to talk on a chat app");
  if (PAY_TO_WORK.test(job.text)) out.push("Mentions paying for equipment or fees");
  if (!job.company) out.push("No company is named");
  return out;
}

export function jobSignals(job, now = Date.now()) {
  return { chips: [salary(job), workplace(job), sponsorship(job)].filter(Boolean), warnings: warnings(job, now) };
}
