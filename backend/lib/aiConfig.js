const crypto = require("crypto");
const env = require("../env");
const { getSettingsMap, upsertSettings, deleteSetting } = require("./aiSettingsRepository");
const { PROVIDER_CATALOG, isValidProviderType, defaultModelForType } = require("./aiProviderTypes");

let cache = null;
let cacheTime = 0;
const CACHE_MS = 5000;

function parseBool(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  const v = String(value).trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return fallback;
}

function maskSecret(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (v.length <= 8) return "••••••••";
  return `${v.slice(0, 4)}••••••••${v.slice(-4)}`;
}

function isMaskedPlaceholder(value) {
  const v = String(value || "");
  return v.includes("••••") || v.includes("****");
}

function parseExtraProviders(raw) {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => ({
        id: String(item?.id || "").trim() || crypto.randomUUID(),
        name: String(item?.name || "Extra provider").trim().slice(0, 80),
        type: String(item?.type || "").trim().toLowerCase(),
        apiKey: String(item?.apiKey || item?.api_key || "").trim(),
        model: String(item?.model || "").trim(),
        enabled: item?.enabled !== false,
      }))
      .filter((item) => isValidProviderType(item.type));
  } catch {
    return [];
  }
}

function normalizeExtraProvider(item, existingById) {
  const id = String(item?.id || "").trim() || crypto.randomUUID();
  const existing = existingById.get(id);
  const type = String(item?.type || existing?.type || "anthropic").trim().toLowerCase();
  if (!isValidProviderType(type)) return null;

  let apiKey = existing?.apiKey || "";
  if (item?.api_key !== undefined && item?.api_key !== null) {
    const incoming = String(item.api_key).trim();
    if (!incoming) apiKey = "";
    else if (!isMaskedPlaceholder(incoming)) apiKey = incoming;
  } else if (item?.apiKey !== undefined && item?.apiKey !== null) {
    const incoming = String(item.apiKey).trim();
    if (!incoming) apiKey = "";
    else if (!isMaskedPlaceholder(incoming)) apiKey = incoming;
  }

  return {
    id,
    name: String(item?.name || existing?.name || "Extra provider").trim().slice(0, 80),
    type,
    apiKey,
    model: String(item?.model || existing?.model || defaultModelForType(type)).trim(),
    enabled: item?.enabled !== false,
  };
}

function mergeConfig(db) {
  const geminiFromDb = (db.gemini_api_key || "").trim();
  const openaiFromDb = (db.openai_api_key || "").trim();
  const extraProviders = parseExtraProviders(db.ai_extra_providers);

  const ollamaBaseUrlFromDb = (db.ollama_base_url || "").trim();
  
  // Ollama API Key - ALWAYS use .env, never database (to avoid SQL injection issues)
  const ollamaApiKeyFromEnv = (env.OLLAMA_API_KEY || "").trim();
  
  // Ollama Hosted specific configs
  const ollamaHostedModelFromDb = (db.ollama_hosted_model || "").trim();
  const ollamaHostedEmbeddingModelFromDb = (db.ollama_hosted_embedding_model || "").trim();
  const ollamaHostedEmbeddingDimFromDb = (db.ollama_hosted_embedding_dim || "").trim();
  const ollamaHostedQuestionModelFromDb = (db.ollama_hosted_question_model || "").trim();
  const ollamaHostedAnalysisModelFromDb = (db.ollama_hosted_analysis_model || "").trim();
  const ollamaHostedNumGpuFromDb = (db.ollama_hosted_num_gpu || "").trim();
  const ollamaHostedNumCtxFromDb = (db.ollama_hosted_num_ctx || "").trim();
  const ollamaHostedChatTimeoutFromDb = (db.ollama_hosted_chat_timeout_ms || "").trim();
  const ollamaHostedRagTopKFromDb = (db.ollama_hosted_rag_top_k || "").trim();

  return {
    aiEnabled: parseBool(db.ai_enabled, true),
    geminiApiKey: geminiFromDb || (env.GEMINI_API_KEY || "").trim(),
    openaiApiKey: openaiFromDb || (env.OPENAI_API_KEY || "").trim(),
    geminiModel: (db.gemini_model || env.GEMINI_MODEL || "gemini-2.5-flash-lite").trim(),
    openaiModel: (db.openai_model || env.OPENAI_MODEL || "gpt-4o-mini").trim(),
    ollamaBaseUrl: ollamaBaseUrlFromDb || (env.OLLAMA_BASE_URL || "").trim(),
    ollamaApiKey: ollamaApiKeyFromEnv,  // ALWAYS from .env only
    ollamaModel: (db.ollama_model || env.OLLAMA_MODEL || "llama3.1:8b").trim(),
    
    // Ollama Hosted specific configs
    ollamaHostedModel: ollamaHostedModelFromDb || (env.DEFAULT_AI_MODEL || "qwen2.5:14b-instruct").trim(),
    ollamaHostedEmbeddingModel: ollamaHostedEmbeddingModelFromDb || (env.EMBEDDING_MODEL || "nomic-embed-text").trim(),
    ollamaHostedEmbeddingDim: ollamaHostedEmbeddingDimFromDb || (env.EMBEDDING_DIM || "768").trim(),
    ollamaHostedQuestionModel: ollamaHostedQuestionModelFromDb || (env.QUESTION_GENERATION_MODEL || "qwen2.5:14b-instruct").trim(),
    ollamaHostedAnalysisModel: ollamaHostedAnalysisModelFromDb || (env.ANALYSIS_AI_MODEL || "qwen2.5:14b-instruct").trim(),
    ollamaHostedNumGpu: ollamaHostedNumGpuFromDb || (env.OLLAMA_NUM_GPU || "0").trim(),
    ollamaHostedNumCtx: ollamaHostedNumCtxFromDb || (env.OLLAMA_NUM_CTX || "8192").trim(),
    ollamaHostedChatTimeout: ollamaHostedChatTimeoutFromDb || (env.OLLAMA_CHAT_TIMEOUT_MS || "900000").trim(),
    ollamaHostedRagTopK: ollamaHostedRagTopKFromDb || (env.RAG_TOP_K || "5").trim(),
    
    aiProvider: (db.ai_provider || env.AI_PROVIDER || "auto").trim().toLowerCase(),
    geminiKeyFromDb: Boolean(geminiFromDb),
    openaiKeyFromDb: Boolean(openaiFromDb),
    ollamaBaseUrlFromDb: Boolean(ollamaBaseUrlFromDb),
    ollamaApiKeyFromDb: false,  // Never from DB
    
    // Track if Ollama Hosted configs are from DB
    ollamaHostedModelFromDb: Boolean(ollamaHostedModelFromDb),
    ollamaHostedEmbeddingModelFromDb: Boolean(ollamaHostedEmbeddingModelFromDb),
    ollamaHostedEmbeddingDimFromDb: Boolean(ollamaHostedEmbeddingDimFromDb),
    ollamaHostedQuestionModelFromDb: Boolean(ollamaHostedQuestionModelFromDb),
    ollamaHostedAnalysisModelFromDb: Boolean(ollamaHostedAnalysisModelFromDb),
    ollamaHostedNumGpuFromDb: Boolean(ollamaHostedNumGpuFromDb),
    ollamaHostedNumCtxFromDb: Boolean(ollamaHostedNumCtxFromDb),
    ollamaHostedChatTimeoutFromDb: Boolean(ollamaHostedChatTimeoutFromDb),
    ollamaHostedRagTopKFromDb: Boolean(ollamaHostedRagTopKFromDb),
    
    extraProviders,
  };
}

async function loadMergedConfig() {
  const db = await getSettingsMap();
  return mergeConfig(db);
}

async function getAiConfig() {
  if (!cache || Date.now() - cacheTime > CACHE_MS) {
    cache = await loadMergedConfig();
    cacheTime = Date.now();
  }
  return cache;
}

function invalidateAiConfigCache() {
  cache = null;
  cacheTime = 0;
}

async function assertAiEnabled() {
  const config = await getAiConfig();
  if (!config.aiEnabled) {
    const err = new Error("AI assistant is disabled — enable it in Admin → AI Config");
    err.status = 503;
    throw err;
  }
  return config;
}

function extraProviderForAdmin(p) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    model: p.model,
    enabled: p.enabled,
    api_key_masked: maskSecret(p.apiKey),
    api_key_set: Boolean(p.apiKey),
  };
}

async function getAiConfigForAdmin() {
  const db = await getSettingsMap();
  const merged = mergeConfig(db);
  const enabledExtras = merged.extraProviders.filter((p) => p.enabled && p.apiKey);

  return {
    ai_enabled: merged.aiEnabled,
    gemini_api_key_masked: maskSecret(merged.geminiApiKey),
    gemini_api_key_set: Boolean(merged.geminiApiKey),
    gemini_api_key_from_db: merged.geminiKeyFromDb,
    gemini_model: merged.geminiModel,
    openai_api_key_masked: maskSecret(merged.openaiApiKey),
    openai_api_key_set: Boolean(merged.openaiApiKey),
    openai_api_key_from_db: merged.openaiKeyFromDb,
    openai_model: merged.openaiModel,
    ollama_base_url: merged.ollamaBaseUrl,
    ollama_api_key_masked: maskSecret(merged.ollamaApiKey),
    ollama_api_key_set: Boolean(merged.ollamaApiKey),
    ollama_api_key_from_db: merged.ollamaApiKeyFromDb,
    ollama_model: merged.ollamaModel,
    ollama_base_url_set: Boolean(merged.ollamaBaseUrl),
    ollama_base_url_from_db: merged.ollamaBaseUrlFromDb,
    
    // Ollama Hosted specific configs
    ollama_hosted_model: merged.ollamaHostedModel,
    ollama_hosted_embedding_model: merged.ollamaHostedEmbeddingModel,
    ollama_hosted_embedding_dim: merged.ollamaHostedEmbeddingDim,
    ollama_hosted_question_model: merged.ollamaHostedQuestionModel,
    ollama_hosted_analysis_model: merged.ollamaHostedAnalysisModel,
    ollama_hosted_num_gpu: merged.ollamaHostedNumGpu,
    ollama_hosted_num_ctx: merged.ollamaHostedNumCtx,
    ollama_hosted_chat_timeout_ms: merged.ollamaHostedChatTimeout,
    ollama_hosted_rag_top_k: merged.ollamaHostedRagTopK,
    ollama_hosted_model_from_db: merged.ollamaHostedModelFromDb,
    ollama_hosted_embedding_model_from_db: merged.ollamaHostedEmbeddingModelFromDb,
    ollama_hosted_embedding_dim_from_db: merged.ollamaHostedEmbeddingDimFromDb,
    ollama_hosted_question_model_from_db: merged.ollamaHostedQuestionModelFromDb,
    ollama_hosted_analysis_model_from_db: merged.ollamaHostedAnalysisModelFromDb,
    ollama_hosted_num_gpu_from_db: merged.ollamaHostedNumGpuFromDb,
    ollama_hosted_num_ctx_from_db: merged.ollamaHostedNumCtxFromDb,
    ollama_hosted_chat_timeout_from_db: merged.ollamaHostedChatTimeoutFromDb,
    ollama_hosted_rag_top_k_from_db: merged.ollamaHostedRagTopKFromDb,
    
    ai_provider: merged.aiProvider,
    env_fallback_gemini: !merged.geminiKeyFromDb && Boolean((env.GEMINI_API_KEY || "").trim()),
    env_fallback_openai: !merged.openaiKeyFromDb && Boolean((env.OPENAI_API_KEY || "").trim()),
    env_fallback_ollama: !merged.ollamaBaseUrlFromDb && Boolean((env.OLLAMA_BASE_URL || "").trim()),
    env_fallback_ollama_api_key: Boolean((env.OLLAMA_API_KEY || "").trim()),  // Always from .env
    env_fallback_ollama_hosted: !merged.ollamaHostedModelFromDb && Boolean((env.DEFAULT_AI_MODEL || "").trim()),
    extra_providers: merged.extraProviders.map(extraProviderForAdmin),
    active_provider_count:
      [merged.geminiApiKey, merged.openaiApiKey, merged.ollamaBaseUrl].filter(Boolean).length +
      enabledExtras.length,
    provider_catalog: PROVIDER_CATALOG,
  };
}

async function updateAiConfig(body, userId) {
  const db = await getSettingsMap();
  const existingExtras = parseExtraProviders(db.ai_extra_providers);
  const existingById = new Map(existingExtras.map((p) => [p.id, p]));
  const updates = {};

  if (typeof body.ai_enabled === "boolean") {
    updates.ai_enabled = body.ai_enabled ? "1" : "0";
  }
  if (body.gemini_model?.trim()) {
    updates.gemini_model = body.gemini_model.trim();
  }
  if (body.openai_model?.trim()) {
    updates.openai_model = body.openai_model.trim();
  }
  if (body.ai_provider?.trim()) {
    const p = body.ai_provider.trim().toLowerCase();
    if (["auto", "gemini", "openai", "ollama", "ollama-local", "ollama-hosted"].includes(p)) {
      updates.ai_provider = p;
    }
  }

  if (body.ollama_model?.trim()) {
    updates.ollama_model = body.ollama_model.trim();
  }

  if (body.ollama_base_url !== undefined && body.ollama_base_url !== null) {
    const value = String(body.ollama_base_url).trim();
    if (!value) await deleteSetting("ollama_base_url");
    else updates.ollama_base_url = value;
  }

  // Note: ollama_api_key is NOT saved to database - use .env file only

  // Ollama Hosted specific configs
  if (body.ollama_hosted_model?.trim()) {
    updates.ollama_hosted_model = body.ollama_hosted_model.trim();
  }
  if (body.ollama_hosted_embedding_model?.trim()) {
    updates.ollama_hosted_embedding_model = body.ollama_hosted_embedding_model.trim();
  }
  if (body.ollama_hosted_embedding_dim?.trim()) {
    updates.ollama_hosted_embedding_dim = body.ollama_hosted_embedding_dim.trim();
  }
  if (body.ollama_hosted_question_model?.trim()) {
    updates.ollama_hosted_question_model = body.ollama_hosted_question_model.trim();
  }
  if (body.ollama_hosted_analysis_model?.trim()) {
    updates.ollama_hosted_analysis_model = body.ollama_hosted_analysis_model.trim();
  }
  if (body.ollama_hosted_num_gpu?.trim()) {
    updates.ollama_hosted_num_gpu = body.ollama_hosted_num_gpu.trim();
  }
  if (body.ollama_hosted_num_ctx?.trim()) {
    updates.ollama_hosted_num_ctx = body.ollama_hosted_num_ctx.trim();
  }
  if (body.ollama_hosted_chat_timeout_ms?.trim()) {
    updates.ollama_hosted_chat_timeout_ms = body.ollama_hosted_chat_timeout_ms.trim();
  }
  if (body.ollama_hosted_rag_top_k?.trim()) {
    updates.ollama_hosted_rag_top_k = body.ollama_hosted_rag_top_k.trim();
  }

  if (body.gemini_api_key !== undefined && body.gemini_api_key !== null) {
    const key = String(body.gemini_api_key).trim();
    if (!key) await deleteSetting("gemini_api_key");
    else if (!isMaskedPlaceholder(key)) updates.gemini_api_key = key;
  }

  if (body.openai_api_key !== undefined && body.openai_api_key !== null) {
    const key = String(body.openai_api_key).trim();
    if (!key) await deleteSetting("openai_api_key");
    else if (!isMaskedPlaceholder(key)) updates.openai_api_key = key;
  }

  if (Array.isArray(body.extra_providers)) {
    const normalized = body.extra_providers
      .map((item) => normalizeExtraProvider(item, existingById))
      .filter(Boolean)
      .map(({ id, name, type, apiKey, model, enabled }) => ({
        id,
        name,
        type,
        apiKey,
        model,
        enabled,
      }));
    updates.ai_extra_providers = JSON.stringify(normalized);
  }

  if (Object.keys(updates).length) {
    await upsertSettings(updates, userId);
  }

  invalidateAiConfigCache();
  return getAiConfigForAdmin();
}

module.exports = {
  getAiConfig,
  getAiConfigForAdmin,
  updateAiConfig,
  assertAiEnabled,
  invalidateAiConfigCache,
  maskSecret,
};
