/**
 * Extract and parse a JSON object from AI text that may include markdown fences or prose.
 */
function parseAiJson(raw, { label = "AI response" } = {}) {
  let text = String(raw || "").trim();
  if (!text) {
    throw new Error(`${label}: empty response`);
  }

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/m, "").trim();
  }

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (innerErr) {
        throw new Error(
          `${label}: ${innerErr.message || "could not parse JSON object from response"}`
        );
      }
    }
    const preview = text.slice(0, 60).replace(/\s+/g, " ");
    throw new Error(`${label}: not valid JSON (starts with "${preview}...")`);
  }
}

module.exports = { parseAiJson };
