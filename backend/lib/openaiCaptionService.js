const { getAiConfig } = require("./aiConfig");
const { buildCaptionPrompt, parseCaptionJson, finalizeCaption } = require("./captionPrompt");

async function callOpenAI(apiKey, model, messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages,
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
  return text;
}

function buildMessages(prompt, image) {
  if (!image) {
    return [{ role: "user", content: prompt }];
  }
  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: {
            url: `data:${image.mimeType};base64,${image.base64}`,
          },
        },
      ],
    },
  ];
}

async function generateCaptionWithOpenAI(input, config) {
  const cfg = config || (await getAiConfig());
  const apiKey = (cfg.openaiApiKey || "").trim();
  if (!apiKey) return null;

  const model = cfg.openaiModel || "gpt-4o-mini";
  const prompt = buildCaptionPrompt(input);
  const text = await callOpenAI(apiKey, model, buildMessages(prompt, input.image));
  const draft = parseCaptionJson(text);
  const result = finalizeCaption(draft, input.topic);
  return { ...result, source: "openai", model };
}

module.exports = { generateCaptionWithOpenAI };
