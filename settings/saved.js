import { listLearned, deleteLearned } from "../idb.js";
import { el, icon, paneHeader, group } from "./ui.js";

export default {
  id: "saved",
  title: "Saved Answers",
  color: "var(--blue)",
  iconName: "bubble",
  keywords: "saved answers learned questions memory",

  async render(root) {
    const header = paneHeader("Saved Answers", "Answers you typed into application questions. They're reused when the same question comes up again.");
    const search = el("input", { className: "field search-field", type: "search", placeholder: "Search saved answers" });
    const list = el("div");
    let entries = await listLearned();

    function draw() {
      const q = search.value.trim().toLowerCase();
      const shown = entries.filter((e) => `${e.questionText} ${e.answer}`.toLowerCase().includes(q));
      if (!entries.length) {
        list.replaceChildren(el("div", { className: "empty" }, icon("bubble", "empty-icon"), el("div", { className: "headline", textContent: "No saved answers yet" }), el("div", { className: "footnote secondary", textContent: "Answers you type into applications appear here." })));
        return;
      }
      list.replaceChildren(
        group(
          `${shown.length} ${shown.length === 1 ? "answer" : "answers"}`,
          shown.map((entry) => {
            const remove = el("button", { type: "button", className: "remove-btn", ariaLabel: "Remove" }, icon("minus"));
            remove.addEventListener("click", async () => {
              await deleteLearned(entry.id);
              entries = entries.filter((e) => e !== entry);
              header.saved();
              draw();
            });
            return el("div", { className: "row" }, el("div", { className: "label" }, el("div", { className: "body", textContent: entry.questionText }), el("div", { className: "footnote secondary clamp", textContent: entry.answer })), remove);
          })
        )
      );
    }

    search.addEventListener("input", draw);
    root.replaceChildren(header.node, search, list);
    draw();
  },
};
