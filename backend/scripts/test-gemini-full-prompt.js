const env = require("../env");
const { query } = require("../db");

const key = env.GEMINI_API_KEY;
const model = "gemini-2.5-flash-lite";

async function loadKnowledgeBank() {
  const rows = await query(
    "SELECT slug, title, content_md FROM knowledge_bank_sections ORDER BY slug"
  );
  if (!rows.length) return "";
  return rows.map((r) => `## ${r.title}\n${r.content_md}`).join("\n\n");
}

function buildPrompt(knowledgeBank) {
  return `You write LinkedIn posts for APEX AI Curriculum.

Card topic: Weather icons for classroom
Content pillar: Teacher Confidence
Audience: Classroom teachers

User brief:
Write about using weather visuals in primary science lessons

Knowledge bank:
${knowledgeBank || "(use only approved APEX teacher-first messaging)"}

Rules:
- Use ONLY approved, conservative claims about APEX helping teachers teach AI responsibly.
- Return JSON only:
{
  "finalPostText": "full caption",
  "suggestedHashtags": "#TeacherTraining",
  "suggestedCta": "one question"
}`;
}

async function call(modelName, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`;
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
  return { status: res.status, raw };
}

(async () => {
  const kb = await loadKnowledgeBank();
  console.log("Knowledge bank chars:", kb.length);
  const prompt = buildPrompt(kb);
  console.log("Prompt chars:", prompt.length);

  const r = await call(model, [{ text: prompt }]);
  console.log("Status:", r.status);
  console.log(r.raw.slice(0, 600));
})();
