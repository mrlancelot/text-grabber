export const jobDescriptionSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    seniority: { type: "string" },
    yearsRequired: { type: "integer" },
    mustHave: { type: "array", items: { type: "string" }, maxItems: 8 },
    niceToHave: { type: "array", items: { type: "string" }, maxItems: 8 },
    responsibilities: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
  },
  required: ["title", "company"],
};

export function tailorSchema(roleIds, bulletIds, skillIds) {
  return {
    type: "object",
    properties: {
      summary: { type: "string", maxLength: 450 },
      skills: { type: "array", items: { type: "string", enum: skillIds }, maxItems: 15 },
      roles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: roleIds },
            bullets: { type: "array", items: { type: "string", enum: bulletIds }, maxItems: 5 },
          },
          required: ["id", "bullets"],
        },
      },
    },
    required: ["summary", "skills", "roles"],
  };
}
