const env = require("../env");
const fs = require("fs");
const path = require("path");

const key = env.GEMINI_API_KEY;
const model = "gemini-2.5-flash-lite";

// 1x1 red PNG
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function test(label, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
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
  console.log(`\n--- ${label} (${res.status}) ---`);
  console.log(raw.slice(0, 500));
}

(async () => {
  const prompt = `Describe this image for a LinkedIn post for teachers. Return JSON: {"finalPostText":"...","suggestedHashtags":"#test","suggestedCta":"?"}`;
  await test("text only", [{ text: prompt }]);
  await test("text + image", [
    { text: prompt },
    { inlineData: { mimeType: "image/png", data: PNG_B64 } },
  ]);
})();
