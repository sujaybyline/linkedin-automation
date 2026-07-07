const { query } = require("../db");
const { generateCaption, inferTopicFromFilename } = require("./captionGenerator");
const { buildCaptionPrompt, parseCaptionJson, finalizeCaption } = require("./captionPrompt");
const { generateCaptionWithOpenAI } = require("./openaiCaptionService");
const { assertAiEnabled } = require("./aiConfig");
const {
  resolveProviderSlots,
  listAvailableProviders,
  geminiModelCandidatesFromConfig,
  withRetry,
} = require("./aiProvider");
const { generateTextWithSlot } = require("./aiTextClient");
const { getCompanyProfileById, buildCompanyBrief } = require("./companyProfilesRepository");

async function loadKnowledgeBank() {
  const rows = await query(
    "SELECT slug, title, content_md FROM knowledge_bank_sections ORDER BY slug"
  );
  if (!rows.length) return "";
  return rows.map((r) => `## ${r.title}\n${r.content_md}`).join("\n\n");
}

async function callGemini(model, apiKey, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 500);
    try {
      detail = JSON.parse(raw)?.error?.message || detail;
    } catch {
      /* ignore */
    }
    throw new Error(`Gemini API error (${res.status}): ${detail}`);
  }
  const data = JSON.parse(raw);
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("") || "";
  if (!text.trim()) throw new Error("Empty response from Gemini");
  return text.trim();
}

async function generateCaptionWithGemini(input, config) {
  const apiKey = (config.geminiApiKey || "").trim();
  if (!apiKey) return null;

  const prompt = buildCaptionPrompt(input);
  const parts = [{ text: prompt }];
  if (input.image) {
    parts.push({
      inlineData: { mimeType: input.image.mimeType, data: input.image.base64 },
    });
  }

  const models = geminiModelCandidatesFromConfig(config);
  let lastErr;
  for (const model of models) {
    try {
      const text = await withRetry(() => callGemini(model, apiKey, parts));
      const draft = parseCaptionJson(text);
      const result = finalizeCaption(draft, input.topic);
      return { ...result, source: "gemini", model };
    } catch (err) { n
      lastErr = err;
      if (models.indexOf(model) < models.length - 1) continue;
    } 
  }
  throw lastErr || new Error("Gemini request failed");
}

async function tryCaptionSlot(slot, input, config) {
  if (slot.key === "openai") return generateCaptionWithOpenAI(input, config);
  if (slot.key === "gemini") return generateCaptionWithGemini(input, config);
  if (input.image) return null;                                                     

  const prompt = buildCaptionPrompt(input);
  const response = await generateTextWithSlot(slot, prompt, {
    maxTokens: 1024,
    temperature: 0.9,
    jsonMode: true,
  });
  if (!response) return null;
  const draft = parseCaptionJson(response.text);
  const result = finalizeCaption(draft, input.topic);
  return { ...result, source: response.source, model: response.model };
}

function rulesCaption(topic) {
  const rules = generateCaption({ topic, cardClaim: topic });
  return {
    finalPostText: rules.finalPostText,
    suggestedHashtags: rules.suggestedHashtags,
    suggestedCta: rules.suggestedCta,
    blockedWords: rules.blockedWords,
    claimsUsed: rules.claimsUsed,
    riskLevel: rules.riskLevel,
    recommendation: rules.recommendation,
    source: "rules",
  };
}

async function buildCaptionInput(input) {
  const topic = input.topic || input.prompt?.slice(0, 120) || "LinkedIn post";
  const inferred = inferTopicFromFilename(input.filename || "");
  const knowledgeBank = await loadKnowledgeBank();

  let extraPrompt = input.prompt || "";
  if (input.companyProfileId) {
    const profile = await getCompanyProfileById(input.companyProfileId);
    if (profile) {
      const brief = buildCompanyBrief(profile);
      extraPrompt = [extraPrompt, "Company marketing context:", brief].filter(Boolean).join("\n\n");
    }
  }

  return {
    topic,
    contentPillar: input.contentPillar || inferred.pillar,
    audience: input.audience || inferred.audience,
    knowledgeBank,
    extraPrompt,
    image: input.image || null,
  };
}

async function generateCaptionPreview(input) {
  const config = await assertAiEnabled();
  const captionInput = await buildCaptionInput(input);
  
  // Disable cross-fallback when user selects a specific provider
  const enableCrossFallback = !input.provider || input.provider === "auto";
  const slots = await resolveProviderSlots(input.provider, { enableCrossFallback });
  
  const errors = [];
  const tried = slots.map((s) => s.label || s.key).join(", ") || "none";

  for (const slot of slots) {
    const label = slot.label || slot.key;
    try {
      const result = await tryCaptionSlot(slot, captionInput, config);
      if (result) return result;
      errors.push(`${label}: no API key configured`);
    } catch (err) {
      const msg = err.message || String(err);
      console.warn(`[caption-preview] ${label} failed:`, msg);
      errors.push(`${label}: ${msg}`);
    }
  }

  if (!input.fallbackToRules) {
    throw new Error(errors.join(" | ") || "No AI provider available");
  }

  const lastError = errors[errors.length - 1] || "unknown error";
  const providerHint = "Update keys in Admin → AI Config or add a backup provider.";

  return {
    ...rulesCaption(captionInput.topic),
    aiWarning: `AI unavailable (${lastError}). Showing template caption — ${providerHint}`,
    providerRequested: input.provider || config.aiProvider || "auto",
    providersTried: tried,
  };
}

async function generateCaptionForPost({ post, card }) {
  const topic = card?.topic ?? post.post_id;
  const filename = card?.filename ?? "";
  const inferred = inferTopicFromFilename(filename);

  let image = null;
  if (card?.storage_path) {
    const fs = require("fs/promises");
    const path = require("path");
    const { getUploadDir } = require("./repository");
    const filePath = path.join(getUploadDir(), card.storage_path);
    const ext = path.extname(filename).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    try {
      const buffer = await fs.readFile(filePath);
      image = { mimeType: mime, base64: buffer.toString("base64") };
    } catch {
      /* no image */
    }
  }

  try {
    return await generateCaptionPreview({
      topic,
      contentPillar: post.content_pillar || inferred.pillar,
      audience: post.audience || inferred.audience,
      filename,
      image,
      fallbackToRules: true,
    });
  } catch {
    return rulesCaption(topic);
  }
}

module.exports = { generateCaptionForPost, generateCaptionPreview, listAvailableProviders };
