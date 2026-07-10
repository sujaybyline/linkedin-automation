const { getAiConfig } = require("./aiConfig");

const EXTRA_PREFIX = "extra:";

function isRetryableAiError(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("503") ||
    m.includes("429") ||
    m.includes("high demand") ||
    m.includes("overloaded") ||
    m.includes("rate limit") ||
    m.includes("temporarily unavailable") ||
    m.includes("resource exhausted") ||
    m.includes("capacity") ||
    m.includes("quota") ||
    m.includes("exceeded")
  );
}

function normalizeOllamaUrls(rawUrl) {
  return String(rawUrl || "")
    .split(/[,\n;]+/)
    .map((url) => String(url || "").trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function isLocalOllamaUrl(url) {
  const lower = String(url || "").toLowerCase();
  return (
    lower.startsWith("http://127.0.0.1") ||
    lower.startsWith("http://localhost") ||
    lower.startsWith("http://[::1]") ||
    lower.startsWith("https://127.0.0.1") ||
    lower.startsWith("https://localhost") ||
    lower.startsWith("https://[::1]")
  );
}

function builtinSlotsFromConfig(config) {
  const slots = [];
  if ((config.geminiApiKey || "").trim()) {
    slots.push({
      key: "gemini",
      type: "gemini",
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      label: "Gemini",
    });
  }
  if ((config.openaiApiKey || "").trim()) {
    slots.push({
      key: "openai",
      type: "openai",
      apiKey: config.openaiApiKey,
      model: config.openaiModel,
      label: "OpenAI",
    });
  }

  const ollamaUrls = normalizeOllamaUrls(config.ollamaBaseUrl);
  const localUrls = ollamaUrls.filter(isLocalOllamaUrl);
  const hostedUrls = ollamaUrls.filter((url) => !isLocalOllamaUrl(url));

  if (hostedUrls.length) {
    slots.push({
      key: "ollama-hosted",
      type: "ollama",
      apiKey: config.ollamaApiKey || "",  // Use API key for hosted Ollama
      model: config.ollamaModel,
      baseUrl: hostedUrls.join(","),
      label: "Ollama (Hosted)",
    });
  }

  if (localUrls.length) {
    slots.push({
      key: "ollama-local",
      type: "ollama",
      apiKey: "",  // Local Ollama doesn't need API key
      model: config.ollamaModel,
      baseUrl: localUrls.join(","),
      label: "Ollama (Local)",
    });
  }

  return slots;
}

function extraSlotsFromConfig(config) {
  return (config.extraProviders || [])
    .filter((p) => p.enabled && (p.apiKey || "").trim())
    .map((p) => ({
      key: `${EXTRA_PREFIX}${p.id}`,
      type: p.type,
      apiKey: p.apiKey,
      model: p.model,
      label: p.name || p.type,
      extraId: p.id,
    }));
}

function allConfiguredProvidersFromConfig(config) {
  return [...builtinSlotsFromConfig(config), ...extraSlotsFromConfig(config)].map((s) => s.key);
}

async function allConfiguredProviders() {
  const config = await getAiConfig();
  return allConfiguredProvidersFromConfig(config);
}

function orderSlots(primaryKeys, allSlots) {
  const ordered = [];
  const seen = new Set();
  for (const key of primaryKeys) {
    const slot = allSlots.find((s) => s.key === key);
    if (slot && !seen.has(slot.key)) {
      ordered.push(slot);
      seen.add(slot.key);
    }
  }
  for (const slot of allSlots) {
    if (!seen.has(slot.key)) {
      ordered.push(slot);
      seen.add(slot.key);
    }
  }
  return ordered;
}

/**
 * Resolve provider keys (gemini, openai, extra:id) for legacy loops.
 */
async function resolveProviders(requestProvider, { enableCrossFallback = true } = {}) {
  const slots = await resolveProviderSlots(requestProvider, { enableCrossFallback });
  return slots.map((s) => s.key);
}

/**
 * Full slot objects for unified AI text calls including extra providers.
 */
async function resolveProviderSlots(requestProvider, { enableCrossFallback = true } = {}) {
  const config = await getAiConfig();
  const requested = (requestProvider || "").trim().toLowerCase();
  const builtin = builtinSlotsFromConfig(config);
  const extras = extraSlotsFromConfig(config);
  const allSlots = [...builtin, ...extras];

  let primaryKeys = [];

  if (requested.startsWith(EXTRA_PREFIX)) {
    primaryKeys = [requested];
  } else if (requested === "openai" || requested === "gemini") {
    primaryKeys = [requested];
  } else if (requested === "ollama") {
    primaryKeys = allSlots.filter((s) => s.type === "ollama").map((s) => s.key);
  } else if (requested === "ollama-local" || requested === "ollama-hosted") {
    primaryKeys = [requested];
  } else if (requested === "auto" || !requested) {
    const mode = (config.aiProvider || "auto").toLowerCase();
    if (mode === "openai") primaryKeys = ["openai"];
    else if (mode === "gemini") primaryKeys = ["gemini"];
    else if (mode === "ollama") primaryKeys = allSlots.filter((s) => s.type === "ollama").map((s) => s.key);
    else if (mode === "ollama-local") primaryKeys = ["ollama-local"];
    else if (mode === "ollama-hosted") primaryKeys = ["ollama-hosted"];
    else primaryKeys = builtin.map((s) => s.key);
    if (!primaryKeys.length) primaryKeys = ["gemini"];
  } else {
    primaryKeys = [requested];
  }

  if (!enableCrossFallback) {
    return orderSlots(primaryKeys, allSlots).filter((s) => primaryKeys.includes(s.key));
  }

  return orderSlots(primaryKeys, allSlots);
}

function slotByKey(config, key) {
  const all = [...builtinSlotsFromConfig(config), ...extraSlotsFromConfig(config)];
  return all.find((s) => s.key === key) || null;
}

async function listAvailableProviders() {
  const config = await getAiConfig();
  const builtin = builtinSlotsFromConfig(config);
  const extras = extraSlotsFromConfig(config);
  const providers = [...builtin, ...extras].map((s) => ({
    id: s.key,
    label: s.label,
    type: s.type,
  }));

  const ollamaSlots = builtin.filter((s) => s.type === "ollama");
  if (ollamaSlots.length) {
    providers.push({ id: "ollama", label: "Ollama", type: "ollama" });
  }

  const envDefault = (config.aiProvider || "auto").toLowerCase();
  let defaultProvider = "auto";
  if (envDefault === "openai" && builtin.some((s) => s.key === "openai")) defaultProvider = "openai";
  else if (envDefault === "gemini" && builtin.some((s) => s.key === "gemini")) defaultProvider = "gemini";
  else if (envDefault === "ollama-local" && builtin.some((s) => s.key === "ollama-local")) defaultProvider = "ollama-local";
  else if (envDefault === "ollama-hosted" && builtin.some((s) => s.key === "ollama-hosted")) defaultProvider = "ollama-hosted";
  else if (envDefault === "ollama" && ollamaSlots.length) defaultProvider = "ollama";
  else if (providers.length === 1) defaultProvider = providers[0].id;
  else if (providers.length > 1) defaultProvider = "auto";

  return {
    providers,
    defaultProvider,
    aiEnabled: config.aiEnabled,
    extras: extras.map((s) => ({ id: s.extraId, label: s.label, type: s.type })),
  };
}

function geminiModelCandidatesFromConfig(config) {
  const preferred = (config.geminiModel || "gemini-2.5-flash-lite").trim();
  const fallbacks = ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"];
  return [...new Set([preferred, ...fallbacks])];
}

async function geminiModelCandidates() {
  const config = await getAiConfig();
  return geminiModelCandidatesFromConfig(config);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { retries = 2, baseDelayMs = 1200 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isRetryableAiError(err.message)) {
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

module.exports = {
  EXTRA_PREFIX,
  isRetryableAiError,
  allConfiguredProviders,
  allConfiguredProvidersFromConfig,
  resolveProviders,
  resolveProviderSlots,
  slotByKey,
  listAvailableProviders,
  geminiModelCandidates,
  geminiModelCandidatesFromConfig,
  withRetry,
};
