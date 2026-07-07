const env = require("../env");
const { generateCaptionPreview } = require("../lib/geminiCaptionService");

const key = env.GEMINI_API_KEY;
const model = env.GEMINI_MODEL || "gemini-2.5-flash-lite";

async function testRaw(label, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  console.log(`\n--- ${label} (${res.status}) ---`);
  console.log(raw.slice(0, 400));
}

(async () => {
  console.log("Key loaded:", key ? `yes (${key.length} chars)` : "NO");
  console.log("Model:", model);

  await testRaw("plain text", {
    contents: [{ role: "user", parts: [{ text: "Say hi in one word" }] }],
  });

  await testRaw("json mode", {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: 'Return JSON only: {"finalPostText":"Hello teachers","suggestedHashtags":"#test","suggestedCta":"Question?"}',
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  try {
    const result = await generateCaptionPreview({
      topic: "Weather icons for classroom",
      prompt: "Write about using weather visuals in primary science lessons",
      fallbackToRules: false,
    });
    console.log("\n--- generateCaptionPreview ---");
    console.log("source:", result.source, "model:", result.model);
    console.log("preview:", result.finalPostText?.slice(0, 200));
  } catch (err) {
    console.error("\n--- generateCaptionPreview FAILED ---");
    console.error(err.message);
  }
})();
