import { getAnswers, setAnswers } from "../idb.js";
import { CHOICE_KEYS, CHOICE_LABELS } from "../autofill/keys.js";
import { el, paneHeader, group, row, segmented, popup, debounce } from "./ui.js";

const SECTIONS = [
  {
    title: "Work Eligibility",
    rows: [
      ["workAuthorization", "Authorized to work"],
      ["sponsorship", "Needs visa sponsorship"],
      ["relocate", "Willing to relocate"],
      ["over18", "18 or older"],
    ],
  },
  {
    title: "Logistics",
    rows: [
      ["startDate", "Earliest start date", { type: "date" }],
      ["noticePeriod", "Notice period", { placeholder: "2 weeks" }],
      ["salary", "Desired salary", { placeholder: "$180,000" }],
      ["heardAbout", "How you heard about jobs", { placeholder: "LinkedIn" }],
    ],
  },
  {
    title: "Contact & Address",
    rows: [
      ["phone", "Phone", { type: "tel" }],
      ["website", "Website", { type: "url" }],
      ["phoneCountryCode", "Phone country code", { placeholder: "+1" }],
      ["addressLine1", "Street address"],
      ["city", "City"],
      ["state", "State"],
      ["postalCode", "ZIP code"],
      ["country", "Country", { placeholder: "United States" }],
    ],
  },
  {
    title: "Voluntary Self-Identification",
    footer: "Used only where an application asks. Never shared with the AI.",
    rows: [
      ["eeo.gender", "Gender"],
      ["eeo.race", "Race / ethnicity"],
      ["eeo.hispanic", "Hispanic or Latino"],
      ["eeo.veteran", "Veteran status"],
      ["eeo.disability", "Disability status"],
      ["pronouns", "Pronouns", { placeholder: "she/her" }],
    ],
  },
];

export default {
  id: "answers",
  title: "Personal Answers",
  color: "var(--green)",
  iconName: "checklist",
  keywords: SECTIONS.flatMap((s) => [s.title, ...s.rows.map((r) => r[1])]).join(" "),

  async render(root) {
    const answers = (await getAnswers()) || {};
    const header = paneHeader("Personal Answers", "Questions applications ask again and again. Answer once; they fill in exactly as set.");
    const save = debounce(async () => {
      await setAnswers(Object.fromEntries(Object.entries(answers).filter(([, v]) => v)));
      header.saved();
    }, 400);
    const set = (key) => (value) => {
      answers[key] = value;
      save();
    };

    function control(key, props = {}) {
      const choices = CHOICE_KEYS[key];
      if (choices && choices.length === 2) return segmented([["", "Ask Me"], ...choices.map((c) => [c, CHOICE_LABELS[c]])], answers[key] || "", set(key));
      if (choices) return popup([["", "Ask Me"], ...choices.map((c) => [c, CHOICE_LABELS[c]])], answers[key] || "", set(key));
      const input = el("input", { className: "field bare", value: answers[key] || "", placeholder: "Add", ...props });
      input.addEventListener("input", () => set(key)(input.value.trim()));
      return input;
    }

    root.replaceChildren(header.node, ...SECTIONS.map((s) => group(s.title, s.rows.map(([key, label, props]) => row(label, control(key, props))), s.footer)));
  },
};
