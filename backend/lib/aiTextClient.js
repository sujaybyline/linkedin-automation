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

async function callOllamaText({ baseUrl, model, prompt, maxTokens, temperature, jsonMode }) {
  const urls = (baseUrl || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\/$/, ""));
  if (!urls.length) throw new Error("Ollama base URL is not configured");

  const payload = {
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

  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(`${url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      if (!res.ok) {
        let detail = raw.slice(0, 500);
        try {
          detail = JSON.parse(raw)?.error || detail;
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
      const text = data?.message?.content?.trim() || data?.response?.trim() || "";
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
