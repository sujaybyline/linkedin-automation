const { assertAiEnabled } = require("./aiConfig");

const IMAGE_MODELS = [
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp-image-generation",
];

async function generateImageFromPrompt(prompt, topic) {
  const config = await assertAiEnabled();
  const apiKey = (config.geminiApiKey || "").trim();
  if (!apiKey) return null;

  const text = `Create a professional LinkedIn post image for educators and teachers.
Topic: ${topic || prompt}
Style: clean, modern, readable text on card, education/AI theme, no watermarks.
Brief: ${prompt}`;

  let lastErr = null;
  for (const model of IMAGE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });
      const raw = await res.text();
      if (!res.ok) {
        let detail = raw.slice(0, 400);
        try {
          detail = JSON.parse(raw)?.error?.message || detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      const data = JSON.parse(raw);
      const parts = data?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return {
            mimeType: part.inlineData.mimeType || "image/png",
            base64: part.inlineData.data,
            model,
          };
        }
      }
      throw new Error("No image in Gemini response");
    } catch (e) {
      lastErr = e;
      console.warn(`[ai-image] ${model} failed:`, e.message);
    }
  }
  throw lastErr || new Error("Image generation failed");
}

module.exports = { generateImageFromPrompt };
