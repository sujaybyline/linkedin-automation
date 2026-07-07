const { generateCaptionPreview } = require("../lib/geminiCaptionService");

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

(async () => {
  try {
    const result = await generateCaptionPreview({
      topic: "",
      prompt: "",
      filename: "weather-icons.png",
      image: { mimeType: "image/png", base64: PNG_B64 },
      fallbackToRules: false,
    });
    console.log("source:", result.source);
    console.log("model:", result.model);
    console.log("text:", result.finalPostText?.slice(0, 300));
  } catch (e) {
    console.error("FAILED:", e.message);
  }
})();
