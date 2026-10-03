export const jobDescriptionSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    seniority: { type: "string" },
    mustHave: { type: "array", items: { type: "string" } },
    niceToHave: { type: "array", items: { type: "string" } },
    responsibilities: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
  },
  required: ["title", "company"],
};
