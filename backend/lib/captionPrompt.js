const {
  detectBlockedWords,
  assessRisk,
} = require("./captionGenerator");

function buildCaptionPrompt({ topic, contentPillar, audience, knowledgeBank, extraPrompt }) {
  const variationSeed = new Date().toISOString();
  return `You write LinkedIn posts for APEX AI Curriculum.

Card topic: ${topic}
Content pillar: ${contentPillar || "Teacher Confidence"}
Audience: ${audience || "Classroom teachers"}
Variation seed: ${variationSeed}
${extraPrompt ? `\nUser brief:\n${extraPrompt}\n` : ""}

Knowledge bank:
${knowledgeBank || "(use only approved APEX teacher-first messaging)"}

Rules:
- Use ONLY approved, conservative claims about APEX helping teachers teach AI responsibly.
- Do NOT invent statistics, school names, pilots, government endorsements, or product features not in the knowledge bank.
- Avoid hype words: revolutionary, game-changing, magic, unleash, disruptive, cutting-edge, guru, ninja.
- Write for LinkedIn: short hook, 2-4 short paragraphs, professional warm tone.
- Make each post feel fresh and distinctive — change the hook, structure, and phrasing every time.
- Do not reuse a previous angle, opening line, or CTA. Create a new perspective for this request even if the topic is similar.
- Favor thoughtful leadership, leadership development, lead generation, and practical insight over generic promotion.
- When the brief mentions thought leadership, lead generation, or leadership development, lean into those angles with concrete takeaways for teachers and leaders.
- End with a thoughtful question CTA for teachers.
- If a card image is attached, align the caption with what is visible on the card.

Return JSON only:
{
  "finalPostText": "full caption with line breaks as \\n",
  "suggestedHashtags": "#TeacherTraining #AIeducation",
  "suggestedCta": "one question sentence"
}`;
}

function parseCaptionJson(text) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed.finalPostText || typeof parsed.finalPostText !== "string") {
    throw new Error("AI JSON missing finalPostText");
  }
  return {
    finalPostText: parsed.finalPostText.trim(),
    suggestedHashtags: String(parsed.suggestedHashtags || "#TeacherTraining #AIeducation #EdTech"),
    suggestedCta: String(
      parsed.suggestedCta || "What would make the next practical step clearer for your team?"
    ),
  };
}

function finalizeCaption(draft, topic) {
  const blockedWords = detectBlockedWords(draft.finalPostText);
  const risk = assessRisk(topic, draft.finalPostText);
  return {
    finalPostText: draft.finalPostText,
    suggestedHashtags: draft.suggestedHashtags,
    suggestedCta: draft.suggestedCta,
    blockedWords,
    claimsUsed: [risk.claimUsed],
    riskLevel: risk.riskLevel,
    recommendation: blockedWords.length ? "Needs Review" : risk.recommendation,
  };
}

module.exports = { buildCaptionPrompt, parseCaptionJson, finalizeCaption };
