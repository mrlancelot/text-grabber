import { getFile, setFile } from "../idb.js";
import { el, icon, paneHeader, group, button, pickFile } from "./ui.js";

const ACCEPT = { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] };

function size(bytes) {
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export default {
  id: "resume",
  title: "Resume",
  color: "var(--red)",
  iconName: "doc",
  keywords: "resume cv file upload pdf",

  async render(root) {
    const header = paneHeader("Resume", "Attached automatically wherever an application asks for a resume.");
    const store = async (file) => {
      await setFile("resume", { name: file.name, type: file.type, blob: file, addedAt: Date.now() });
      header.saved();
      draw();
    };
    const choose = async () => {
      const file = await pickFile("Resume", ACCEPT);
      if (file) store(file);
    };

    function dropZone() {
      const zone = el("div", { className: "dropzone" }, icon("doc", "drop-icon"), el("div", { className: "headline", textContent: "Drop your resume here" }), el("div", { className: "footnote secondary", textContent: "PDF or Word document" }), button("Choose File…", "", choose));
      zone.addEventListener("dragover", (e) => (e.preventDefault(), zone.classList.add("over")));
      zone.addEventListener("dragleave", () => zone.classList.remove("over"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("over");
        const file = e.dataTransfer.files[0];
        if (file) store(file);
      });
      return zone;
    }

    async function draw() {
      const file = await getFile("resume");
      const details = file && [size(file.blob.size), file.addedAt && `Added ${new Date(file.addedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`].filter(Boolean).join(" · ");
      root.replaceChildren(
        header.node,
        file
          ? group("Current File", [
              el(
                "div",
                { className: "row file-row" },
                el("div", { className: "nav-icon tile", style: "--tile: var(--red)" }, icon("doc")),
                el("div", { className: "label" }, el("div", { className: "headline", textContent: file.name }), el("div", { className: "footnote secondary", textContent: details })),
                button("Replace…", "", choose),
                button("Remove", "plain destructive", async () => {
                  await setFile("resume", null);
                  draw();
                })
              ),
            ])
          : dropZone()
      );
    }

    await draw();
  },
};
