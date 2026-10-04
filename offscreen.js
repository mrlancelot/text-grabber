import { CreateMLCEngine } from "./vendor/web-llm/web-llm.js";
import { appConfig } from "./lib/models.js";

let engine = null;
let current = null;
let queue = Promise.resolve();

async function load(model) {
  if (!engine) engine = await CreateMLCEngine(model, { appConfig: appConfig() });
  else if (current !== model) await engine.reload(model);
  current = model;
  return engine;
}

async function run({ model, system, text, schema, temperature, warm, unload }) {
  if (unload) {
    await engine?.unload();
    engine = current = null;
    return {};
  }
  const llm = await load(model);
  if (warm) return {};
  const reply = await llm.chat.completions.create({
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
    temperature: temperature ?? 0.3,
    max_tokens: 700,
    response_format: schema ? { type: "json_object", schema: JSON.stringify(schema) } : undefined,
  });
  return { text: reply.choices[0]?.message?.content || "" };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen") return;
  queue = queue.then(() => run(message)).then(sendResponse, (err) => sendResponse({ error: String(err?.message || err) }));
  return true;
});
