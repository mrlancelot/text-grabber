export async function checkAvailability(opts = {}) {
  if (typeof LanguageModel === "undefined") {
    return { status: "unavailable", reason: "Gemini Nano (Prompt API) isn't available in this browser." };
  }
  try {
    const availability = await LanguageModel.availability(opts);
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

async function createSession(systemPrompt, opts = {}, onProgress) {
  return LanguageModel.create({
    initialPrompts: systemPrompt ? [{ role: "system", content: systemPrompt }] : undefined,
    ...opts,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        if (onProgress) onProgress(e.loaded);
      });
    },
  });
}

export async function runStructured(systemPrompt, userPrompt, schema, opts = {}) {
  const availability = await checkAvailability(opts);
  if (availability.status !== "ok" && availability.status !== "downloading") {
    return { ok: false, ...availability };
  }

  let session;
  try {
    session = await createSession(systemPrompt, opts);
    const raw = await session.prompt(userPrompt, { responseConstraint: schema });
    const data = JSON.parse(raw);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, status: "error", reason: String(err && err.message ? err.message : err) };
  } finally {
    if (session) session.destroy();
  }
}

export async function runText(systemPrompt, userPrompt, opts = {}) {
  const availability = await checkAvailability(opts);
  if (availability.status !== "ok" && availability.status !== "downloading") {
    return { ok: false, ...availability };
  }

  let session;
  try {
    session = await createSession(systemPrompt, opts);
    const text = await session.prompt(userPrompt);
    return { ok: true, data: text };
  } catch (err) {
    return { ok: false, status: "error", reason: String(err && err.message ? err.message : err) };
  } finally {
    if (session) session.destroy();
  }
}
