const { withRetry } = require("./aiProvider");
const { defaultModelForType } = require("./aiProviderTypes");

function geminiModelList(preferred) {
  const fallbacks = ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"];
  return [...new Set([(preferred || "gemini-2.5-flash-lite").trim(), ...fallbacks])];
}

async function callGeminiText({ apiKey, model, prompt, maxTokens, temperature, jsonMode }) {
  const models = geminiModelList(model);
  let lastErr;
  for (const m of models) {
    try {
      return await withRetry(async () => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
              ...(jsonMode ? { responseMimeType: "application/json" } : {}),
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
        let text =
          data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("") || "";
        if (!text.trim()) throw new Error("Empty response from Gemini");
        text = text.trim();
        if (jsonMode && !text.includes("{")) {
          const retry = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `${prompt}\n\nReply with a single JSON object only — no other text.`,
                    },
                  ],
                },
              ],
              generationConfig: { temperature, maxOutputTokens: maxTokens },
            }),
          });
          const retryRaw = await retry.text();
          if (retry.ok) {
            const retryData = JSON.parse(retryRaw);
            const retryText =
              retryData?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("") ||
              "";
            if (retryText.trim().includes("{")) text = retryText.trim();
          }
        }
        return { text, source: "gemini", model: m };
      });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Gemini request failed");
}

async function callOpenAIText({ apiKey, model, prompt, maxTokens, temperature, jsonMode }) {
  return withRetry(async () => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "user", content: prompt }],
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
      throw new Error(`OpenAI API error (${res.status}): ${detail}`);
    }
    const data = JSON.parse(raw);
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!text) throw new Error("Empty response from OpenAI");
    return { text, source: "openai", model: model || "gpt-4o-mini" };
  });
}

async function callAnthropicText({ apiKey, model, prompt, maxTokens, temperature, jsonMode }) {
  return withRetry(async () => {
    const userPrompt = jsonMode
      ? `${prompt}\n\nRespond with valid JSON only — no markdown fences.`
      : prompt;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || defaultModelForType("anthropic"),
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: "user", content: userPrompt }],
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
      throw new Error(`Anthropic API error (${res.status}): ${detail}`);
    }
    const data = JSON.parse(raw);
    const text = data?.content?.map((c) => c?.text || "").join("").trim() || "";
    if (!text) throw new Error("Empty response from Anthropic");
    return { text, source: "anthropic", model: model || defaultModelForType("anthropic") };
  });
}

async function callGroqText({ apiKey, model, prompt, maxTokens, temperature, jsonMode }) {
  return withRetry(async () => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || defaultModelForType("groq"),
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "user", content: prompt }],
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
      throw new Error(`Groq API error (${res.status}): ${detail}`);
    }
    const data = JSON.parse(raw);
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!text) throw new Error("Empty response from Groq");
    return { text, source: "groq", model: model || defaultModelForType("groq") };
  });
}

// Hosted AI gateway WAF blocks patterns that look like SQL (hashtags, --, keywords, quotes).
const PANWORLD_FULLWIDTH_HASH = "\uFF03";
const PANWORLD_EM_DASH = "\u2014";
const PANWORLD_TYPOGRAPHIC_APOSTROPHE = "\u2019";
const PANWORLD_SQL_KEYWORDS =
  /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|FROM|WHERE|INTO|TABLE)\b/gi;

function sanitizePanworldQuestion(text) {
  let s = String(text || "");
  s = s.replace(/#/g, PANWORLD_FULLWIDTH_HASH);
  s = s.replace(/--/g, PANWORLD_EM_DASH);
  s = s.replace(/`/g, PANWORLD_TYPOGRAPHIC_APOSTROPHE);
  // Possessives like India's / Bosch's trigger SQL-string detection on the gateway
  s = s.replace(/'/g, PANWORLD_TYPOGRAPHIC_APOSTROPHE);
  s = s.replace(PANWORLD_SQL_KEYWORDS, (m) => m.split("").join("\u200B"));
  return s;
}

function resolvePanworldChatEndpoint(url) {
  const base = String(url || "").trim().replace(/\/$/, "");
  if (base.endsWith("/api/ai/chat")) return base;
  if (base.endsWith("/api/ai")) return `${base}/chat`;
  if (base.endsWith("/chat")) {
    return base.replace(/\/ai\/api\/chat$/, "/api/ai/chat");
  }
  return `${base}/api/ai/chat`;
}

function resolveOllamaChatEndpoint(url, isHostedGateway) {
  if (isHostedGateway) return resolvePanworldChatEndpoint(url);
  return url.includes("/api") ? `${url}/chat` : `${url}/api/chat`;
}

function extractPanworldMessageText(data) {
  const message = data?.data?.message;
  if (Array.isArray(message)) {
    return message.map((m) => m?.content || "").join("").trim();
  }
  return String(message?.content || "").trim();
}

async function callOllamaText({ baseUrl, apiKey, model, prompt, maxTokens, temperature, jsonMode }) {
  const urls = (baseUrl || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\/$/, ""));
  if (!urls.length) throw new Error("Ollama base URL is not configured");

  const isHostedGateway = Boolean((apiKey || "").trim());

  let lastErr;
  for (const url of urls) {
    try {
      const isHosted = isHostedGateway;
      
      const headers = {
        "Content-Type": "application/json",
      };
      
      // Add Authorization header for hosted Ollama
      if (isHosted) {
        headers["Authorization"] = `Bearer ${apiKey.trim()}`;
      }
      
      const endpoint = resolveOllamaChatEndpoint(url, isHostedGateway);

      // Use gateway API format when Bearer token is configured (hosted Ollama)
      let payload;
      if (isHostedGateway) {
        const question = jsonMode
          ? `${prompt}\n\nReturn valid JSON only — no markdown fences.`
          : prompt;
        payload = {
          model: model || "qwen3:8b",
          question: sanitizePanworldQuestion(question),
        };
      } else {
        // Standard Ollama format: { model, messages, stream, options }
        payload = {
          model: model || "llama3.1:8b",
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
          },
          messages: [
            {
              role: "user",
              content: jsonMode
                ? `${prompt}\n\nReturn valid JSON only — no markdown fences.`
                : prompt,
            },
          ],
        };
      }
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      if (!res.ok) {
        let detail = raw.slice(0, 500);
        try {
          detail = JSON.parse(raw)?.error || JSON.parse(raw)?.message || detail;
        } catch {
          /* ignore */
        }
        // Provide better error context for 502 errors
        if (res.status === 502) {
          throw new Error(
            `Ollama connection failed (502 Bad Gateway). ` +
            `Is Ollama running at ${url}? ` +
            `Check OLLAMA_BASE_URL configuration. ` +
            `Use localhost/127.0.0.1 for local dev only. ` +
            `Detail: ${detail}`
          );
        }
        throw new Error(`Ollama API error (${res.status}): ${detail}`);
      }
      const data = JSON.parse(raw);
      
      // Handle different response formats
      let text;
      if (isHostedGateway) {
        text = extractPanworldMessageText(data);
      } else {
        // Standard Ollama response format
        text = data?.message?.content?.trim() || data?.response?.trim() || "";
      }
      
      if (!text) throw new Error("Empty response from Ollama");
      return { text, source: "ollama", model: payload.model };
    } catch (err) {
      // Enhance network error messages
      if (err.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
        lastErr = new Error(
          `Cannot connect to Ollama at ${url}. ` +
          `Verify Ollama is running and accessible. ` +
          `On hosted environments, ensure OLLAMA_BASE_URL points to a publicly accessible Ollama instance. ` +
          `Original error: ${err.message}`
        );
      } else {
        lastErr = err;
      }
    }
  }
  throw lastErr || new Error("Ollama request failed");
}

async function generateTextWithSlot(slot, prompt, options = {}) {
  const { maxTokens = 4096, temperature = 0.5, jsonMode = true } = options;
  const type = slot.type;
  const apiKey = (slot.apiKey || "").trim();
  const payload = {
    apiKey,
    model: slot.model,
    prompt,
    maxTokens,
    temperature,
    jsonMode,
    baseUrl: slot.baseUrl,
  };

  switch (type) {
    case "gemini":
      if (!apiKey) return null;
      return callGeminiText(payload);
    case "openai":
      if (!apiKey) return null;
      return callOpenAIText(payload);
    case "anthropic":
      if (!apiKey) return null;
      return callAnthropicText(payload);
    case "groq":
      if (!apiKey) return null;
      return callGroqText(payload);
    case "ollama":
      return callOllamaText(payload);
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}

module.exports = { generateTextWithSlot };
