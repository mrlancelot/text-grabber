import { nanoAvailability, downloadNano } from "../ai.js";
import { MODELS, appConfig } from "../lib/models.js";
import { el, button } from "./ui.js";

const NANO_STATUS = {
  ok: ["var(--green)", "Ready"],
  downloadable: ["var(--yellow)", "Not downloaded · about 4 GB"],
  downloading: ["var(--yellow)", "Downloading"],
  unavailable: ["var(--red)", "Not supported on this device"],
};

const REQUIREMENTS = "Gemini Nano needs Chrome on Windows, macOS 13+, Linux or a Chromebook Plus, 22 GB of free disk space, and either a GPU with more than 4 GB of memory or 16 GB of RAM with 4+ CPU cores.";

const webllm = () => import("../vendor/web-llm/web-llm.js");

async function gpuSupport() {
  const adapter = await navigator.gpu?.requestAdapter().catch(() => null);
  if (!adapter) return "This browser or device has no WebGPU support.";
  if (!adapter.features.has("shader-f16")) return "This GPU doesn't support the 16-bit shaders these models need.";
  return "";
}

function statusLine(node, color, text) {
  node.replaceChildren(el("span", { className: "dot", style: `background: ${color}` }), text);
}

export function modelsGroup() {
  let busy = false;
  const list = el("div", { className: "group" });
  const note = el("div", { className: "group-footer footnote secondary" });

  async function choose(id) {
    await chrome.storage.local.set({ tgModel: id });
    draw();
  }

  function modelRow({ id, title, subtitle, active, enabled, status, actions, meter }) {
    const radio = el("input", { type: "radio", name: "model", checked: active, disabled: !enabled, className: "model-radio" });
    radio.addEventListener("change", () => choose(id));
    return el(
      "div",
      { className: "row model-row" },
      radio,
      el("div", { className: "label" }, el("div", { className: "body", textContent: title }), el("div", { className: "footnote secondary", textContent: subtitle })),
      el("div", { className: "model-status" }, status, meter, el("div", { className: "inline" }, ...actions))
    );
  }

  async function nanoRow(active) {
    const result = await nanoAvailability();
    const [color, label] = NANO_STATUS[result.status] || NANO_STATUS.unavailable;
    const status = el("span", { className: "status-value callout secondary" });
    statusLine(status, color, label);
    const meter = el("progress", { className: "meter", max: 1, value: 0, hidden: true });
    const actions = [button("Details", "", () => chrome.tabs.create({ url: "chrome://on-device-internals" }))];
    if (result.status === "downloadable") {
      const download = button("Download", "prominent", async () => {
        busy = true;
        download.disabled = true;
        meter.hidden = false;
        meter.removeAttribute("value");
        statusLine(status, "var(--yellow)", "Starting download…");
        try {
          await downloadNano((loaded) => {
            meter.value = loaded;
            statusLine(status, "var(--yellow)", `Downloading ${Math.round(loaded * 100)}%`);
          });
        } catch (err) {
          note.textContent = `Download didn't start: ${err?.message || err}`;
        }
        busy = false;
        draw();
      });
      actions.unshift(download);
    }
    if (result.status === "unavailable") note.textContent = `${result.reason} ${REQUIREMENTS}`;
    return modelRow({ id: "nano", title: "Gemini Nano", subtitle: "Built into Chrome · shared with other sites", active, enabled: result.status === "ok", status, actions, meter });
  }

  function localRow(model, active, ready, gpuProblem) {
    const status = el("span", { className: "status-value callout secondary" });
    statusLine(status, ready ? "var(--green)" : gpuProblem ? "var(--red)" : "var(--yellow)", ready ? "Ready" : gpuProblem ? "Needs WebGPU" : `Not downloaded · ${model.size}`);
    const meter = el("progress", { className: "meter", max: 1, value: 0, hidden: true });
    const actions = [];
    if (ready) {
      actions.push(
        button("Delete", "", async () => {
          await chrome.runtime.sendMessage({ target: "offscreen", unload: true }).catch(() => {});
          await (await webllm()).deleteModelAllInfoInCache(model.id, appConfig());
          const { tgModels = {}, tgModel } = await chrome.storage.local.get(["tgModels", "tgModel"]);
          delete tgModels[model.id];
          await chrome.storage.local.set({ tgModels, tgModel: tgModel === model.id ? "nano" : tgModel });
          draw();
        })
      );
    } else if (!gpuProblem) {
      const download = button("Download", "prominent", async () => {
        busy = true;
        download.disabled = true;
        meter.hidden = false;
        meter.removeAttribute("value");
        statusLine(status, "var(--yellow)", "Starting download…");
        try {
          const engine = await (await webllm()).CreateMLCEngine(model.id, {
            appConfig: appConfig(),
            initProgressCallback: ({ progress, text }) => {
              meter.value = progress;
              statusLine(status, "var(--yellow)", /cache|loading/i.test(text) && progress >= 1 ? "Loading onto your GPU…" : `Downloading ${Math.round(progress * 100)}%`);
            },
          });
          await engine.unload();
          const { tgModels = {} } = await chrome.storage.local.get("tgModels");
          await chrome.storage.local.set({ tgModels: { ...tgModels, [model.id]: "ready" }, tgModel: model.id });
        } catch (err) {
          note.textContent = `Couldn't download ${model.name}: ${err?.message || err}`;
        }
        busy = false;
        draw();
      });
      actions.push(download);
    }
    return modelRow({ id: model.id, title: `${model.name} · ${model.tier}`, subtitle: `Downloads once, runs on your GPU · ${model.size}`, active, enabled: ready, status, actions, meter });
  }

  async function draw() {
    if (busy) return;
    note.textContent = "Pick the model autofill and tailoring use. All of them run on this device.";
    const [{ tgModel = "nano", tgModels = {} }, gpuProblem] = await Promise.all([chrome.storage.local.get(["tgModel", "tgModels"]), gpuSupport()]);
    const active = tgModel !== "nano" && tgModels[tgModel] === "ready" ? tgModel : "nano";
    const rows = [await nanoRow(active === "nano"), ...MODELS.map((m) => localRow(m, active === m.id, tgModels[m.id] === "ready", gpuProblem))];
    if (gpuProblem) note.textContent += ` Downloadable models: ${gpuProblem}`;
    list.replaceChildren(...rows);
  }

  window.onfocus = draw;
  draw();
  return el("section", { className: "group-section" }, el("div", { className: "group-title footnote secondary", textContent: "AI model" }), list, note);
}
