const BLOCKED_WORDS = [
  "revolutionary",
  "game-changing",
  "magic",
  "magical",
  "superpower",
  "adventure",
  "dive",
  "embark",
  "unleash",
  "disruptive",
  "cutting-edge",
  "10x",
  "guru",
  "ninja",
  "wizard",
];

const SAFE_CLAIMS = [
  "APEX helps teachers build confidence in teaching AI.",
  "APEX supports structured AI learning for schools.",
  "APEX includes teacher support resources.",
  "APEX uses a teacher-first approach.",
  "APEX supports responsible AI learning.",
];

const DEFAULT_HASHTAGS = "#TeacherTraining #TeacherConfidence #AIeducation #EdTech";
const DEFAULT_CTA = "What would make the next practical step clearer for your team?";

const FILENAME_TOPIC_MAP = {
  p01: { topic: "Teacher confidence before content", pillar: "Teacher Confidence", audience: "Classroom teachers" },
  p02: { topic: "The four phases of an APEX lesson", pillar: "How It Works", audience: "Classroom teachers" },
  p11: { topic: "Facilitating ethics questions", pillar: "Teacher Confidence", audience: "Classroom teachers" },
};

function inferTopicFromFilename(filename) {
  const match = filename.match(/p(\d+)/i);
  if (match && FILENAME_TOPIC_MAP[`p${match[1]}`]) {
    return FILENAME_TOPIC_MAP[`p${match[1]}`];
  }
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  return {
    topic: base || "APEX AI curriculum insight",
    pillar: "Teacher Confidence",
    audience: "Classroom teachers",
  };
}

function detectBlockedWords(text) {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.filter((w) => lower.includes(w));
}

function assessRisk(topic, cardClaim) {
  const combined = `${topic} ${cardClaim ?? ""}`.toLowerCase();
  const numericPattern = /\b(116|126|13|14|8)\b|grade|unit|session|framework|certification|badge/;
  const highRiskPattern = /ministry|testimonial|pilot|outcome|launch date|uae|government|school name/;
  const claimUsed = SAFE_CLAIMS[0];

  if (highRiskPattern.test(combined)) {
    return { riskLevel: "high", recommendation: "Reject or legal review", claimUsed };
  }
  if (numericPattern.test(combined)) {
    return { riskLevel: "medium", recommendation: "Needs Review", claimUsed: SAFE_CLAIMS[1] };
  }
  return { riskLevel: "low", recommendation: "Approve", claimUsed };
}

function generateCaption(input) {
  const { topic, cardClaim } = input;
  const risk = assessRisk(topic, cardClaim);
  const hook = topic.trim();
  const body = risk.claimUsed;
  const reflection =
    "The practical question is how a new subject can feel teachable before it feels familiar.";
  const finalPostText = [hook, "", body, "", reflection, "", DEFAULT_CTA].join("\n");
  const blockedWords = detectBlockedWords(finalPostText);

  return {
    finalPostText,
    suggestedHashtags: DEFAULT_HASHTAGS,
    suggestedCta: DEFAULT_CTA,
    blockedWords,
    claimsUsed: [risk.claimUsed],
    riskLevel: risk.riskLevel,
    recommendation: blockedWords.length ? "Needs Review" : risk.recommendation,
  };
}

module.exports = { inferTopicFromFilename, generateCaption, detectBlockedWords, assessRisk };
