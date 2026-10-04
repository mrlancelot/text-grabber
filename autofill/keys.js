import { yearsOfExperience } from "../lib/dates.js";

export const FIELD_KEYS = {
  firstName: "first / given name",
  lastName: "last / family name",
  fullName: "full legal name in one field",
  preferredName: "preferred name or nickname",
  email: "email address",
  phone: "phone number",
  phoneCountryCode: "phone country code",
  addressLine1: "street address",
  city: "city",
  state: "state / province",
  postalCode: "zip / postal code",
  country: "country of residence",
  location: "current location (city, state)",
  linkedin: "LinkedIn profile URL",
  github: "GitHub URL",
  website: "personal website / portfolio URL",
  currentCompany: "current or most recent company / employer",
  currentTitle: "current or most recent job title",
  yearsExperience: "total years of work experience",
  school: "school / university",
  degree: "degree",
  fieldOfStudy: "major / field of study",
  graduationYear: "graduation year",
  workAuthorization: "legally authorized to work in the country (yes/no)",
  sponsorship: "will need visa sponsorship (yes/no)",
  relocate: "willing to relocate (yes/no)",
  over18: "at least 18 years old (yes/no)",
  startDate: "earliest start date",
  noticePeriod: "notice period",
  salary: "desired salary / compensation",
  heardAbout: "how they heard about the job",
  pronouns: "pronouns",
  summary: "professional summary / about yourself / bio / additional information",
  "eeo.gender": "gender (EEO self-identification)",
  "eeo.race": "race / ethnicity (EEO)",
  "eeo.hispanic": "Hispanic or Latino (EEO)",
  "eeo.veteran": "veteran status (EEO)",
  "eeo.disability": "disability status (EEO)",
  resumeUpload: "resume / CV file upload",
  coverLetterUpload: "cover letter file upload",
};
export const CHOICE_KEYS = {
  workAuthorization: ["yes", "no"],
  sponsorship: ["yes", "no"],
  relocate: ["yes", "no"],
  over18: ["yes", "no"],
  "eeo.gender": ["male", "female", "nonbinary", "decline"],
  "eeo.race": ["asian", "black", "white", "hispanic", "native-american", "pacific-islander", "two-or-more", "decline"],
  "eeo.hispanic": ["yes", "no", "decline"],
  "eeo.veteran": ["not-veteran", "protected-veteran", "decline"],
  "eeo.disability": ["no", "yes", "decline"],
};
export const CHOICE_LABELS = {
  yes: "Yes",
  no: "No",
  decline: "Decline to self-identify",
  male: "Male",
  female: "Female",
  nonbinary: "Non-binary",
  asian: "Asian",
  black: "Black or African American",
  white: "White",
  hispanic: "Hispanic or Latino",
  "native-american": "American Indian or Alaska Native",
  "pacific-islander": "Native Hawaiian or Other Pacific Islander",
  "two-or-more": "Two or more races",
  "not-veteran": "I am not a protected veteran",
  "protected-veteran": "I identify as one or more classifications of protected veteran",
};

const DECLINE = /decline|prefer not|(do not|don.?t) (wish|want)|not to (say|disclose|answer|self.?identify)|choose not|rather not|not specified|not declared/;

const NEGATION = /\bnot\b|\b(don|can|won|isn|aren|wasn|haven|doesn|didn)'?t\b/;
export const OPTION_SYNONYMS = {
  yes: { re: /^(yes|y|true)\b|^i (am|do|will|have|can)\b(?! not)/, not: NEGATION },
  no: { re: /^(no|n|false)\b|^i (am|do|will|have|can) not\b|^i (don.?t|won.?t|can.?t)\b/, not: DECLINE },
  decline: { re: DECLINE },
  male: { re: /^(male|man|cis ?male)\b/ },
  female: { re: /^(female|woman|cis ?female)\b/ },
  nonbinary: { re: /non.?binary|gender.?(queer|non.?conforming)/ },
  asian: { re: /^asian/ },
  black: { re: /black|african/ },
  white: { re: /^white|caucasian/ },
  hispanic: { re: /hispanic|latin[oax]/, not: NEGATION },
  "native-american": { re: /american indian|alaska|native american|indigenous/ },
  "pacific-islander": { re: /hawaiian|pacific island/ },
  "two-or-more": { re: /two or more|multiracial|multiple races/ },
  "not-veteran": { re: /not a (protected )?veteran|i am not a|^no\b/, not: DECLINE },
  "protected-veteran": { re: /protected veteran|one or more (of the )?classifications|^yes\b|i am a (protected )?veteran/, not: /\bnot\b|decline|don'?t/ },
};
export const DISABILITY_SYNONYMS = {
  yes: { re: /^yes|i have a disability|had one in the past/, not: NEGATION },
  no: { re: /^no\b|(do not|don.?t) have a disability/, not: DECLINE },
  decline: { re: /(do not|don.?t) (wish|want) to answer|decline|prefer not/ },
};

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function isCurrent(role) {
  return !role.endDate || /present|current|now/i.test(role.endDate);
}
export function buildValues(profile, answers) {
  const p = profile || {};
  const c = p.contact || {};
  const exp = p.experience || [];
  const edu = p.education || [];
  const { first, last } = splitName(c.name);
  const locParts = String(c.location || "").split(",").map((s) => s.trim()).filter(Boolean);
  const current = exp.find(isCurrent) || exp[0] || {};
  const school = edu[0] || {};
  const years = exp.length ? yearsOfExperience(exp) : "";

  const derived = {
    firstName: first,
    lastName: last,
    preferredName: first,
    fullName: c.name || "",
    email: c.email || "",
    phone: c.phone || "",
    phoneCountryCode: (/^\s*(\+\d{1,3})/.exec(c.phone || "") || [""])[0].trim(),
    location: c.location || "",
    city: locParts[0] || "",
    state: locParts.length > 1 ? locParts[1] : "",
    country: locParts.length > 2 ? locParts[locParts.length - 1] : "",
    linkedin: c.linkedin || "",
    github: c.github || "",
    website: c.portfolio || "",
    currentCompany: current.company || "",
    currentTitle: current.title || "",
    yearsExperience: years === "" ? "" : String(years),
    school: school.school || "",
    degree: school.degree || "",
    fieldOfStudy: school.field || "",
    graduationYear: (/\d{4}/.exec(school.endDate || "") || [""])[0],
    summary: p.summary || "",
  };

  const values = { ...derived };
  for (const [k, v] of Object.entries(answers || {})) {
    if (v != null && String(v).trim() !== "") values[k] = v;
  }
  return values;
}

export const FILE_KEYS = ["resumeUpload", "coverLetterUpload"];

export function catalog(values, hasResume) {
  const out = {};
  for (const [key, desc] of Object.entries(FIELD_KEYS)) {
    if (values[key] != null && values[key] !== "") out[key] = desc;
  }
  if (hasResume) out.resumeUpload = FIELD_KEYS.resumeUpload;
  return out;
}
