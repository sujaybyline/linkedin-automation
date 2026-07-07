const {
  scrapeWebsite,
  extractCleanWebsiteText,
  extractFileText,
  prepareTextForAi,
  MAX_AI_INPUT_CHARS,
} = require("./documentTextExtractor");
const { assertAiEnabled } = require("./aiConfig");
const { resolveProviderSlots } = require("./aiProvider");
const { generateTextWithSlot } = require("./aiTextClient");
const { parseAiJson } = require("./parseAiJson");

const MAX_AI_OUTPUT_TOKENS = Number(process.env.FETCH_INFO_MAX_AI_TOKENS) || 2048;

const INTEL_SCHEMA = `{
  "companyName": "string",
  "tagline": "string",
  "summary": "2-3 sentence company overview for marketers",
  "industry": "string",
  "targetAudience": ["audience segment 1", "audience segment 2"],
  "brandVoice": "tone and style guidance for LinkedIn posts",
  "contentPillars": ["pillar 1", "pillar 2", "pillar 3"],
  "hotTopics": [
    {
      "topic": "trending or timely topic",
      "why": "why it matters now for this company",
      "urgency": "high|medium|low",
      "suggestedAngle": "LinkedIn post angle in one sentence"
    }
  ],
  "postIdeas": [
    {
      "title": "post title",
      "format": "carousel|single image|text|poll|video",
      "hook": "opening line hook",
      "pillar": "content pillar"
    }
  ],
  "keyMessages": ["core message 1", "core message 2"],
  "suggestedHashtags": ["#Hashtag1", "#Hashtag2"],
  "competitorInsights": "brief competitive positioning note",
  "contentCalendarHints": ["weekly theme or timing suggestion"]
}`;

function buildIntelPrompt({ companyName, sources }) {
  const sourceBlocks = sources
    .map((s, i) => {
      const label = s.label || `Source ${i + 1}`;
      return `### ${label}\n${s.aiText}`;
    })
    .join("\n\n");

  return `Analyze the company information below and produce actionable LinkedIn marketing intelligence.

Company hint: ${companyName || "Infer from sources"}

CRITICAL: Reply with a single JSON object only — no introduction, no markdown fences.
Schema:
${INTEL_SCHEMA}

Rules:
- 5-8 hotTopics, 6-10 postIdeas, 8-12 hashtags
- Company-specific insights only — no generic marketing advice
- Infer carefully when sources are sparse

SOURCE MATERIAL (pre-scraped, no further web access needed):
${sourceBlocks}`;
}

function parseIntelJson(raw) {
  const data = parseAiJson(raw, { label: "company intel" });
  return normalizeIntel(data);
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v || "").trim()).filter(Boolean);
}

function normalizeIntel(data) {
  return {
    companyName: String(data.companyName || "").trim(),
    tagline: String(data.tagline || "").trim(),
    summary: String(data.summary || "").trim(),
    industry: String(data.industry || "").trim(),
    targetAudience: asStringArray(data.targetAudience),
    brandVoice: String(data.brandVoice || "").trim(),
    contentPillars: asStringArray(data.contentPillars),
    hotTopics: Array.isArray(data.hotTopics)
      ? data.hotTopics
          .map((t) => ({
            topic: String(t?.topic || "").trim(),
            why: String(t?.why || "").trim(),
            urgency: ["high", "medium", "low"].includes(String(t?.urgency || "").toLowerCase())
              ? String(t.urgency).toLowerCase()
              : "medium",
            suggestedAngle: String(t?.suggestedAngle || "").trim(),
          }))
          .filter((t) => t.topic)
      : [],
    postIdeas: Array.isArray(data.postIdeas)
      ? data.postIdeas
          .map((p) => ({
            title: String(p?.title || "").trim(),
            format: String(p?.format || "single image").trim(),
            hook: String(p?.hook || "").trim(),
            pillar: String(p?.pillar || "").trim(),
          }))
          .filter((p) => p.title)
      : [],
    keyMessages: asStringArray(data.keyMessages),
    suggestedHashtags: asStringArray(data.suggestedHashtags),
    competitorInsights: String(data.competitorInsights || "").trim(),
    contentCalendarHints: asStringArray(data.contentCalendarHints),
  };
}

/**
 * Step 1 — Scrape website (no AI).
 */
async function scrapeWebsiteSource(websiteUrl) {
  let url = websiteUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const scrape = await scrapeWebsite(url);
  return { url, scrape };
}

/**
 * Step 2 — Extract and clean text from scraped content or uploaded file (no AI).
 */
async function extractAndCleanSources({ websiteUrl, file, scrapeResult }) {
  const sources = [];

  if (scrapeResult) {
    const extracted = await extractCleanWebsiteText(scrapeResult.scrape);
    if (!extracted.cleanText?.trim()) {
      throw new Error("Could not extract readable text from the website");
    }
    const prepared = prepareTextForAi(extracted.cleanText, {
      label: extracted.title || scrapeResult.url,
    });
    sources.push({
      label: `Website: ${extracted.title || scrapeResult.url}`,
      cleanText: extracted.cleanText,
      aiText: prepared.text,
      cleanChars: prepared.cleanChars,
      aiInputChars: prepared.aiInputChars,
      textTruncatedForAi: prepared.truncated,
      meta: { type: "website", url: extracted.url, ...extracted.scrapeMeta },
    });
  }

  if (file) {
    const doc = await extractFileText(file);
    if (!doc.cleanText?.trim()) {
      throw new Error(`Could not extract text from ${file.originalname}`);
    }
    const prepared = prepareTextForAi(doc.cleanText, { label: doc.filename });
    sources.push({
      label: `Document: ${doc.filename}`,
      cleanText: doc.cleanText,
      aiText: prepared.text,
      cleanChars: prepared.cleanChars,
      aiInputChars: prepared.aiInputChars,
      textTruncatedForAi: prepared.truncated,
      meta: { type: doc.source, filename: doc.filename },
    });
  }

  return sources;
}

/**
 * Step 3 — Single AI call to analyze pre-cleaned text (only step that uses AI tokens).
 */
async function analyzeCompanyWithAi({ companyName, sources, provider }) {
  const totalAiChars = sources.reduce((n, s) => n + s.aiInputChars, 0);
  if (totalAiChars < 80) {
    throw new Error("Not enough content to analyze — try a longer document or a richer website page");
  }

  const prompt = buildIntelPrompt({ companyName, sources });
  const requestedProvider = (provider || "auto").trim().toLowerCase() || "auto";
  
  // Disable cross-fallback when user selects a specific provider
  const enableCrossFallback = requestedProvider === "auto";
  const slots = await resolveProviderSlots(requestedProvider, { enableCrossFallback });
  
  const errors = [];

  for (const slot of slots) {
    const label = slot.label || slot.key;
    try {
      const response = await generateTextWithSlot(slot, prompt, {
        maxTokens: MAX_AI_OUTPUT_TOKENS,
        temperature: 0.4,
        jsonMode: true,
      });
      if (!response) {
        errors.push(`${label}: no API key configured`);
        continue;
      }

      const intel = parseIntelJson(response.text);
      const usedFallback =
        requestedProvider !== "auto" &&
        !requestedProvider.startsWith("extra:") &&
        requestedProvider !== response.source &&
        slots.length > 1;

      return {
        intel,
        ai: {
          source: response.source,
          model: response.model,
          providerLabel: label,
          providerRequested: requestedProvider,
          providersTried: slots.map((s) => s.label || s.key).join(", "),
          providerFallback: usedFallback,
          fallbackNote: usedFallback
            ? `${requestedProvider} was unavailable — used ${label} instead.`
            : "",
          aiCalls: 1,
          maxAiInputChars: MAX_AI_INPUT_CHARS,
          aiInputCharsUsed: totalAiChars,
          maxAiOutputTokens: MAX_AI_OUTPUT_TOKENS,
        },
      };
    } catch (err) {
      errors.push(`${label}: ${err.message || String(err)}`);
    }
  }

  throw new Error(errors.join(" | ") || "No AI provider available — add keys in Admin → AI Config");
}

/**
 * Fetch-info pipeline:
 *   1. Scrape website (no AI)
 *   2. Extract & clean text (no AI)
 *   3. AI analyzes company (single call, token-budgeted)
 *   4. Caller stores structured profile (see aiRoutes POST /fetch-info)
 */
async function fetchCompanyIntel(input) {
  await assertAiEnabled();
  const { companyName, websiteUrl, file, provider } = input;

  if (!websiteUrl?.trim() && !file) {
    throw new Error("Provide a website URL or upload a company document (at least one is required)");
  }

  const pipeline = {
    step1_scrape: { status: "skipped" },
    step2_extractClean: { status: "pending" },
    step3_aiAnalyze: { status: "pending" },
    step4_store: { status: "pending", note: "handled by API route after pipeline" },
  };

  let scrapeResult = null;
  if (websiteUrl?.trim()) {
    scrapeResult = await scrapeWebsiteSource(websiteUrl);
    pipeline.step1_scrape = {
      status: "done",
      url: scrapeResult.url,
      bytesFetched: scrapeResult.scrape.bytesFetched,
      usedAi: false,
    };
  }

  const sources = await extractAndCleanSources({ websiteUrl, file, scrapeResult });
  pipeline.step2_extractClean = {
    status: "done",
    sources: sources.map((s) => ({
      label: s.label,
      cleanChars: s.cleanChars,
      aiInputChars: s.aiInputChars,
      truncatedForAi: s.textTruncatedForAi,
      ...s.meta,
    })),
    usedAi: false,
  };

  const { intel, ai } = await analyzeCompanyWithAi({ companyName, sources, provider });
  pipeline.step3_aiAnalyze = {
    status: "done",
    ...ai,
    usedAi: true,
  };

  return {
    ...intel,
    companyName: intel.companyName || companyName?.trim() || "",
    source: ai.source,
    model: ai.model,
    providerLabel: ai.providerLabel,
    providerRequested: ai.providerRequested,
    providersTried: ai.providersTried,
    providerFallback: ai.providerFallback,
    fallbackNote: ai.fallbackNote,
    sourcesAnalyzed: sources.map((s) => ({
      label: s.label,
      chars: s.cleanChars,
      aiInputChars: s.aiInputChars,
      truncatedForAi: s.textTruncatedForAi,
      ...s.meta,
    })),
    pipeline,
  };
}

module.exports = { fetchCompanyIntel };
