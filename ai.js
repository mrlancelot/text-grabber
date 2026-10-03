// Same options for availability() and create() so they agree (and Chrome doesn't warn).
const NANO_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

export async function checkAvailability() {
  if (typeof LanguageModel === "undefined") {
    return { status: "unavailable", reason: "Gemini Nano (Prompt API) isn't available in this browser." };
  }
  try {
    const availability = await LanguageModel.availability(NANO_OPTIONS);
    if (availability === "unavailable") {
      return { status: "unavailable", reason: "This device doesn't meet Gemini Nano's requirements." };
    }
    if (availability === "downloadable" || availability === "downloading") {
      return { status: "downloading", availability };
    }
    return { status: "ok" };
  } catch (err) {
    return { status: "unavailable", reason: String(err && err.message ? err.message : err) };
  }
}

async function createSession(systemPrompt, onProgress) {
  return LanguageModel.create({
    ...NANO_OPTIONS,
    initialPrompts: systemPrompt ? [{ role: "system", content: systemPrompt }] : undefined,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        if (onProgress) onProgress(e.loaded);
      });
    },
  });
}

export async function runStructured(systemPrompt, userPrompt, schema) {
  const availability = await checkAvailability();
  if (availability.status !== "ok" && availability.status !== "downloading") {
    return { ok: false, ...availability };
  }

  let session;
  try {
    session = await createSession(systemPrompt);
    const raw = await session.prompt(userPrompt, { responseConstraint: schema });
    const data = JSON.parse(raw);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, status: "error", reason: String(err && err.message ? err.message : err) };
  } finally {
    if (session) session.destroy();
  }
}

export async function runText(systemPrompt, userPrompt) {
  const availability = await checkAvailability();
  if (availability.status !== "ok" && availability.status !== "downloading") {
    return { ok: false, ...availability };
  }

  let session;
  try {
    session = await createSession(systemPrompt);
    const text = await session.prompt(userPrompt);
    return { ok: true, data: text };
  } catch (err) {
    return { ok: false, status: "error", reason: String(err && err.message ? err.message : err) };
  } finally {
    if (session) session.destroy();
  }
}

// One warm base session per task, cloned per call: clone() skips re-reading the
// system prompt, so after the first load each call costs only the prompt itself.
// Bases die with the service worker and are recreated lazily.
const bases = new Map();

function getBase(systemPrompt) {
  if (!bases.has(systemPrompt)) {
    bases.set(
      systemPrompt,
      createSession(systemPrompt).catch((err) => {
        bases.delete(systemPrompt); // don't cache a failed create
        throw err;
      })
    );
  }
  return bases.get(systemPrompt);
}

async function cloneBase(systemPrompt) {
  try {
    return await (await getBase(systemPrompt)).clone();
  } catch {
    bases.delete(systemPrompt); // base was destroyed/evicted — rebuild once
    return (await getBase(systemPrompt)).clone();
  }
}

export function warmUp(systemPrompts) {
  if (typeof LanguageModel === "undefined") return;
  for (const p of systemPrompts) getBase(p).catch(() => {});
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
export async function askStructured(systemPrompt, userText, schema) {
  if (typeof LanguageModel === "undefined") return null;
  let session;
  try {
    session = await cloneBase(systemPrompt);
    if (!(await fitsContext(session, userText, schema))) return "too-long";
    const reply = await session.prompt(userText, { responseConstraint: schema });
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
