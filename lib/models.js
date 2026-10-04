export const MODELS = [
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", name: "Qwen 2.5 0.5B", tier: "Fast", size: "about 0.3 GB", vram: 945, lib: "Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", name: "Llama 3.2 1B", tier: "Balanced", size: "about 0.7 GB", vram: 879, lib: "Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm" },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", name: "Llama 3.2 3B", tier: "Quality", size: "about 1.8 GB", vram: 2264, lib: "Llama-3.2-3B-Instruct-q4f16_1_cs1k-webgpu.wasm" },
];

export function appConfig() {
  return {
    model_list: MODELS.map((m) => ({
      model: `https://huggingface.co/mlc-ai/${m.id}`,
      model_id: m.id,
      model_lib: chrome.runtime.getURL(`vendor/web-llm/libs/${m.lib}`),
      vram_required_MB: m.vram,
      low_resource_required: true,
      overrides: { context_window_size: 4096 },
    })),
  };
}

export async function activeModel() {
  const { tgModel = "nano", tgModels = {} } = await chrome.storage.local.get(["tgModel", "tgModels"]);
  return tgModel !== "nano" && tgModels[tgModel] === "ready" ? tgModel : "nano";
}
