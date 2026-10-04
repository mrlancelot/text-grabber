import { log } from "./lib/log.js";
import { activeModel } from "./lib/models.js";

// Same options for availability() and create() so they agree (and Chrome doesn't warn).
const NANO_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

export async function checkAvailability() {
  const model = await activeModel();
  if (model !== "nano") return { status: "ok", model };
  return nanoAvailability();
}

export async function nanoAvailability() {
  if (typeof LanguageModel === "undefined") {
    return { status: "unavailable", reason: "Gemini Nano (Prompt API) isn't available in this browser." };
  }
  try {
    const availability = await LanguageModel.availability(NANO_OPTIONS);
    if (availability === "unavailable") {
      return { status: "unavailable", reason: "This device doesn't meet Gemini Nano's requirements." };
    }
    if (availability === "downloadable" || availability === "downloading") return { status: availability };
    return { status: "ok" };
  } catch (err) {
    return { status: "unavailable", reason: String(err && err.message ? err.message : err) };
  }
}

async function createSession(systemPrompt, sampling, onProgress) {
  return LanguageModel.create({
    ...NANO_OPTIONS,
    ...sampling,
    initialPrompts: systemPrompt ? [{ role: "system", content: systemPrompt }] : undefined,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        if (onProgress) onProgress(e.loaded);
      });
    },
  });
}

export async function downloadNano(onProgress) {
  const session = await createSession(undefined, undefined, onProgress);
  session.destroy();
}

// One warm base session per task, cloned per call: clone() skips re-reading the
// system prompt, so after the first load each call costs only the prompt itself.
// Bases die with the service worker and are recreated lazily.
const bases = new Map();

function getBase(systemPrompt, sampling) {
  const key = JSON.stringify([systemPrompt, sampling]);
  if (!bases.has(key)) {
    bases.set(
      key,
      createSession(systemPrompt, sampling).catch((err) => {
        bases.delete(key); // don't cache a failed create
        throw err;
      })
    );
  }
  return bases.get(key);
}

async function cloneBase(systemPrompt, sampling) {
  try {
    return await (await getBase(systemPrompt, sampling)).clone();
  } catch {
    bases.delete(JSON.stringify([systemPrompt, sampling])); // base was destroyed/evicted — rebuild once
    return (await getBase(systemPrompt, sampling)).clone();
  }
}

export async function warmUp(systemPrompts) {
  const model = await activeModel();
  if (model !== "nano") return offscreen({ model, warm: true }).catch(() => {});
  if (typeof LanguageModel === "undefined") return;
  for (const p of systemPrompts) getBase(p).catch(() => {});
}

let offscreenReady = null;

async function offscreen(message) {
  offscreenReady ??= chrome.offscreen
    .hasDocument()
    .then((open) => open || chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["WORKERS"], justification: "Runs the on-device AI model you downloaded." }))
    .catch((err) => {
      offscreenReady = null;
      throw err;
    });
  await offscreenReady;
  const reply = await chrome.runtime.sendMessage({ target: "offscreen", ...message });
  if (reply?.error) throw new Error(reply.error);
  return reply;
}

async function askLocal(model, system, text, schema, sampling) {
  if (system.length + text.length > 12000) return "too-long";
  try {
    const reply = await offscreen({ model, system, text, schema, temperature: sampling?.temperature });
    return schema ? JSON.parse(reply.text) : reply.text.trim() || null;
  } catch {
    return null;
  }
}

// Fraction of the context window left after `text` (1 = plenty). Older Chrome
// builds name these inputQuota/measureInputUsage.
async function fitsContext(session, text, schema) {
  const windowSize = session.contextWindow ?? session.inputQuota;
  const used = session.contextUsage ?? session.inputUsage ?? 0;
  const measure = session.measureContextUsage ?? session.measureInputUsage;
  if (!windowSize || !measure) return true;
  try {
    const cost = await measure.call(session, text, { responseConstraint: schema });
    return used + cost < windowSize * 0.9;
  } catch {
    return true;
  }
}

// Returns the parsed answer, null if Nano couldn't answer, or "too-long" if the
// input doesn't fit the context window (the caller should split it). Never throws.
export async function askStructured(systemPrompt, userText, schema, { sampling, omitSchema } = {}) {
  if (typeof LanguageModel === "undefined") return null;
  let session;
  try {
    session = await cloneBase(systemPrompt, sampling);
    if (!(await fitsContext(session, userText, schema))) return "too-long";
    const reply = await session.prompt(userText, { responseConstraint: schema, omitResponseConstraintInput: !!omitSchema });
    return JSON.parse(reply);
  } catch (err) {
    return err && err.name === "QuotaExceededError" ? "too-long" : null;
  } finally {
    session?.destroy?.();
  }
}

// Free-text answer, or null. Never throws.
export async function askText(systemPrompt, userText) {
  if (typeof LanguageModel === "undefined") return null;
  let session;
  try {
    session = await cloneBase(systemPrompt);
    const reply = await session.prompt(userText);
    return reply.trim();
  } catch {
    return null;
  } finally {
    session?.destroy?.();
  }
}

function choiceSizes(schema) {
  if (!schema) return undefined;
  if (schema.enum) return schema.enum.length;
  return Object.fromEntries(Object.entries(schema.properties || {}).map(([k, v]) => [k, v.enum?.length]));
}

const TIMEOUT_MS = 25000;

export async function ask(task, system, text, schema, options) {
  const t0 = performance.now();
  const model = await activeModel();
  const call =
    model !== "nano"
      ? askLocal(model, system, text, schema, options?.sampling)
      : schema
        ? askStructured(system, text, schema, options)
        : askText(system, text);
  let timer;
  const timeout = new Promise((resolve) => (timer = setTimeout(() => resolve("timeout"), TIMEOUT_MS)));
  const result = await Promise.race([call, timeout]);
  clearTimeout(timer);
  const output = result === "timeout" ? null : result;
  log(`${model === "nano" ? "nano" : "local"}:${task}`, { ms: Math.round(performance.now() - t0), input: text, choices: choiceSizes(schema), output, timeout: result === "timeout" });
  return output;
}
