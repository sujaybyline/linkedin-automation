const { assertAiEnabled } = require("./aiConfig");
const { resolveProviderSlots } = require("./aiProvider");
const { generateTextWithSlot } = require("./aiTextClient");
const { parseAiJson } = require("./parseAiJson");
const { getCompanyProfileById, buildCompanyBrief } = require("./companyProfilesRepository");
const { nextPostId, insertTextOnlyPost } = require("./repository");

const BATCH_SCHEMA = `{
  "posts": [
    {
      "topic": "short post title",
      "contentPillar": "pillar name",
      "finalPostText": "full LinkedIn text post with line breaks as \\n",
      "suggestedHashtags": "#Tag1 #Tag2",
      "suggestedCta": "closing question"
    }
  ]
}`;

function buildBatchPrompt(profile, count) {
  const intel = profile.intel || {};
  const brief = buildCompanyBrief(profile);
  const ideas = (intel.postIdeas || [])
    .slice(0, 12)
    .map((p) => `- ${p.title}: ${p.hook || ""}`)
    .join("\n");
  const topics = (intel.hotTopics || [])
    .slice(0, 10)
    .map((t) => `- ${t.topic}: ${t.suggestedAngle || t.why || ""}`)
    .join("\n");

  return `You are a B2B LinkedIn content strategist. Write ${count} unique TEXT-ONLY LinkedIn posts for this company.

CRITICAL: Each post must be COMPLETELY DIFFERENT:
- Different topic (no repeating topics)
- Different angle (even if same subject, use different perspective)
- Different content pillar (spread across various themes)
- Different hook/opening (avoid similar starts)

Return ONLY valid JSON matching this schema (no markdown fences):
${BATCH_SCHEMA}

Rules:
- Generate exactly ${count} posts — each must have a UNIQUE, DISTINCT topic and angle
- NO DUPLICATE topics or similar topics allowed — each post must be about something different
- Text only — no image references, no "see carousel", no video scripts
- Professional LinkedIn tone matching the brand voice
- 2-4 short paragraphs per post, end with the suggested Cta question
- Use company-specific facts from the brief — do not invent statistics or clients not mentioned
- Spread posts across different content pillars and hot topics (use variety)
- Avoid hype: revolutionary, game-changing, magic, unleash, disruptive
- Use diverse perspectives: case studies, industry trends, how-to, thought leadership, data insights, customer stories

COMPANY BRIEF:
${brief}

POST IDEAS TO DRAW FROM (use different ones):
${ideas || "(use hot topics)"}

HOT TOPICS (vary your selection):
${topics || "(infer from brief)"}`;
}

function parseBatchJson(raw, recentTopics = []) {
  const data = parseAiJson(raw, { label: "batch posts" });
  if (!Array.isArray(data.posts)) throw new Error("AI response missing posts array");
  
  const posts = data.posts
    .map((p) => ({
      topic: String(p?.topic || "").trim(),
      contentPillar: String(p?.contentPillar || "").trim(),
      finalPostText: String(p?.finalPostText || "").trim(),
      suggestedHashtags: String(p?.suggestedHashtags || "").trim(),
      suggestedCta: String(p?.suggestedCta || "").trim(),
    }))
    .filter((p) => p.topic && p.finalPostText);

  // Deduplicate: Remove posts with very similar topics
  const unique = [];
  const seenTopics = new Set([...recentTopics]); // Include recent topics from database
  
  for (const post of posts) {
    const normalizedTopic = post.topic.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const topicWords = new Set(normalizedTopic.split(/\s+/).filter(w => w.length > 3));
    
    // Check if this topic is too similar to any existing topic
    let isDuplicate = false;
    for (const seenTopic of seenTopics) {
      const seenWords = new Set(seenTopic.split(/\s+/));
      const commonWords = [...topicWords].filter(w => seenWords.has(w));
      const similarity = commonWords.length / Math.min(topicWords.size, seenWords.size);
      
      // If more than 60% words match, consider it a duplicate
      if (similarity > 0.6) {
        isDuplicate = true;
        console.warn(`[batch] Skipping duplicate topic: "${post.topic}" (similar to existing topic)`);
        break;
      }
    }
    
    if (!isDuplicate) {
      unique.push(post);
      seenTopics.add(normalizedTopic);
    }
  }
  
  return unique;
}

async function generateBatchPosts({ companyProfileId, count, provider, createdBy }) {
  await assertAiEnabled();
  const profile = await getCompanyProfileById(companyProfileId);
  if (!profile) throw new Error("Company profile not found");

  const n = Math.min(Math.max(Number(count) || 1, 1), 15);
  
  // Get recent topics from this company to avoid duplicates
  const { query } = require("../db");
  let recentTopics = [];
  try {
    // Try to get topics from posts table (if column exists)
    const recentPosts = await query(
      `SELECT topic FROM posts 
       WHERE company_profile_id = ? AND topic IS NOT NULL
       ORDER BY created_at DESC LIMIT 50`,
      [companyProfileId]
    );
    recentTopics = recentPosts.map(p => p.topic.toLowerCase().replace(/[^\w\s]/g, '').trim());
  } catch (err) {
    // Fallback: get topics from visual_cards if posts.topic doesn't exist
    console.warn('[batch] posts.topic column not found, using visual_cards.topic as fallback');
    try {
      const recentPosts = await query(
        `SELECT vc.topic FROM visual_cards vc
         INNER JOIN posts p ON p.visual_card_id = vc.id
         WHERE p.company_profile_id = ? AND vc.topic IS NOT NULL
         ORDER BY p.created_at DESC LIMIT 50`,
        [companyProfileId]
      );
      recentTopics = recentPosts.map(p => p.topic.toLowerCase().replace(/[^\w\s]/g, '').trim());
    } catch (fallbackErr) {
      console.warn('[batch] Could not fetch recent topics:', fallbackErr.message);
    }
  }
  
  const prompt = buildBatchPrompt(profile, n);
  
  // Disable cross-fallback when user selects a specific provider
  const enableCrossFallback = !provider || provider === "auto";
  const slots = await resolveProviderSlots(provider, { enableCrossFallback });
  const errors = [];

  for (const slot of slots) {
    const label = slot.label || slot.key;
    try {
      const response = await generateTextWithSlot(slot, prompt, {
        maxTokens: 8192,
        temperature: 0.9, // Increased for more variety and uniqueness
        jsonMode: true,
      });
      if (!response) {
        errors.push(`${label}: no API key configured`);
        continue;
      }
      const posts = parseBatchJson(response.text, recentTopics);
      if (!posts.length) throw new Error("AI returned no usable posts");

      const saved = [];
      const audience = profile.intel?.targetAudience?.[0] || "Professional audience";
      const campaign = `Text — ${profile.companyName}`;

      for (const post of posts.slice(0, n)) {
        const postId = await nextPostId();
        await insertTextOnlyPost({
          postId,
          topic: post.topic,
          contentPillar: post.contentPillar || profile.intel?.contentPillars?.[0] || "Thought leadership",
          audience,
          campaign,
          finalPostText: post.finalPostText,
          suggestedHashtags: post.suggestedHashtags,
          suggestedCta: post.suggestedCta,
          createdBy,
          companyProfileId,
        });
        saved.push({
          postId,
          topic: post.topic,
          finalPostText: post.finalPostText,
          suggestedHashtags: post.suggestedHashtags,
          suggestedCta: post.suggestedCta,
        });
      }

      return {
        companyName: profile.companyName,
        count: saved.length,
        posts: saved,
        source: response.source,
        model: response.model,
        providerLabel: label,
      };
    } catch (err) {
      errors.push(`${label}: ${err.message || String(err)}`);
    }
  }

  throw new Error(errors.join(" | ") || "No AI provider available");
}

module.exports = { generateBatchPosts, buildCompanyBrief };
