const fs = require("fs/promises");
const path = require("path");
const env = require("../env");
const { query } = require("../db");

function getUploadDir() {
  return env.UPLOAD_DIR;
}

async function saveUploadedFile(postId, filename, buffer) {
  const dir = path.join(getUploadDir(), postId);
  await fs.mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);
  return path.join(postId, filename).replace(/\\/g, "/");
}

async function nextPostId() {
  await query("UPDATE post_id_seq SET last_num = last_num + 1 WHERE id = 1");
  const rows = await query("SELECT last_num FROM post_id_seq WHERE id = 1");
  const num = rows[0]?.last_num ?? 1;
  return `POST-${String(num).padStart(3, "0")}`;
}

/** @deprecated use nextPostId */
const nextClaudeCardPostId = nextPostId;

async function getPostByPostId(postId) {
  const rows = await query("SELECT * FROM posts WHERE post_id = ? LIMIT 1", [postId]);
  return rows[0] ?? null;
}

async function getPostInternalId(postId) {
  const post = await getPostByPostId(postId);
  return post ? post.id : null;
}

async function ensurePostChildren(internalPostId) {
  await query("INSERT IGNORE INTO schedules (post_id, sort_order) VALUES (?, 0)", [internalPostId]);
  await query("INSERT IGNORE INTO captions (post_id, final_post_text) VALUES (?, '')", [internalPostId]);
  await query("INSERT IGNORE INTO claims_reviews (post_id) VALUES (?)", [internalPostId]);
}

function parseJson(value) {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return value;
}

function mapPostRow(row) {
  return {
    id: row.id,
    post_id: row.post_id,
    approval_status: row.approval_status,
    quality_status: row.quality_status,
    scheduling_status: row.scheduling_status,
    posting_channel: row.posting_channel,
    campaign: row.campaign,
    content_pillar: row.content_pillar,
    audience: row.audience,
    created_at: row.created_at,
    visual_cards: row.vc_id
      ? {
          id: row.vc_id,
          filename: row.vc_filename,
          topic: row.vc_topic,
          storage_path: row.vc_storage_path,
          card_status: row.vc_card_status,
        }
      : null,
    captions:
      row.final_post_text !== null
        ? {
            final_post_text: row.final_post_text,
            suggested_hashtags: row.suggested_hashtags,
            suggested_cta: row.suggested_cta,
            blocked_words: parseJson(row.blocked_words),
            claims_used: parseJson(row.claims_used),
          }
        : null,
    claims_reviews: row.risk_level
      ? {
          visible_card_claim: row.visible_card_claim,
          caption_claims_used: row.caption_claims_used,
          risk_level: row.risk_level,
          approval_recommendation: row.approval_recommendation,
          approval_status: row.cr_approval_status,
        }
      : null,
    schedules:
      row.scheduled_date || row.auto_post_status || row.linkedin_account_id
        ? {
            scheduled_date: row.scheduled_date,
            scheduled_time: row.scheduled_time,
            timezone: row.timezone,
            auto_post_status: row.auto_post_status,
            retry_count: row.retry_count,
            linkedin_post_id: row.linkedin_post_id,
            linkedin_account_id: row.linkedin_account_id ?? null,
            linkedin_account: row.linkedin_account_id
              ? {
                  id: row.linkedin_account_id,
                  label: row.la_label,
                  member_name: row.la_member_name,
                }
              : null,
          }
        : null,
  };
}

async function fetchPostsWithRelations(whereSql, params = [], orderBy = "p.created_at DESC") {
  const rows = await query(
    `SELECT p.*,
            vc.id AS vc_id, vc.filename AS vc_filename, vc.topic AS vc_topic,
            vc.storage_path AS vc_storage_path, vc.card_status AS vc_card_status,
            c.final_post_text, c.suggested_hashtags, c.suggested_cta,
            c.blocked_words, c.claims_used,
            cr.visible_card_claim, cr.caption_claims_used, cr.risk_level,
            cr.approval_recommendation, cr.approval_status AS cr_approval_status,
            s.scheduled_date, s.scheduled_time, s.timezone, s.auto_post_status,
            s.retry_count, s.linkedin_post_id, s.linkedin_account_id,
            la.label AS la_label, la.member_name AS la_member_name
     FROM posts p
     LEFT JOIN visual_cards vc ON vc.post_id = p.post_id
     LEFT JOIN captions c ON c.post_id = p.id
     LEFT JOIN claims_reviews cr ON cr.post_id = p.id
     LEFT JOIN schedules s ON s.post_id = p.id
     LEFT JOIN linkedin_accounts la ON la.id = s.linkedin_account_id
     WHERE ${whereSql}
     ORDER BY ${orderBy}`,
    params
  );
  return rows.map(mapPostRow);
}

async function insertPostBundle(params) {
  const campaign = params.campaign || "Claude Card-Led Batch";
  const result = await query(
    `INSERT INTO posts (post_id, visual_card_id, content_pillar, audience, campaign, company_profile_id, created_by, topic, post_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.postId,
      params.visualCardId ?? null,
      params.contentPillar,
      params.audience,
      campaign,
      params.companyProfileId ?? null,
      params.createdBy,
      params.topic ?? null,
      params.postType ?? null,
    ]
  );
  await ensurePostChildren(result.insertId);
  return result.insertId;
}

async function insertTextOnlyPost({
  postId,
  topic,
  contentPillar,
  audience,
  campaign,
  finalPostText,
  suggestedHashtags,
  suggestedCta,
  createdBy,
  companyProfileId,
}) {
  const cardResult = await query(
    `INSERT INTO visual_cards
     (post_id, storage_path, filename, topic, content_pillar, audience, card_status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'needs_review', ?)`,
    [
      postId,
      "_text_",
      "text-post",
      topic || "Text post",
      contentPillar || "Thought leadership",
      audience || "Professional audience",
      createdBy,
    ]
  );

  const internalId = await insertPostBundle({
    postId,
    visualCardId: cardResult.insertId,
    contentPillar: contentPillar || "Thought leadership",
    audience: audience || "Professional audience",
    campaign: campaign || "Text Post",
    companyProfileId,
    createdBy,
    topic: topic || "Text post",
    postType: "text_only",
  });

  await query(
    `UPDATE captions
     SET final_post_text = ?, suggested_hashtags = ?, suggested_cta = ?
     WHERE post_id = ?`,
    [finalPostText || "", suggestedHashtags || "", suggestedCta || "", internalId]
  );
  await query(
    `UPDATE posts
     SET approval_status = 'pending_review', quality_status = 'needs_review', media_type = 'text'
     WHERE id = ?`,
    [internalId]
  );
  await query(
    `UPDATE claims_reviews SET approval_status = 'Needs Review', approval_recommendation = 'Needs Review'
     WHERE post_id = ?`,
    [internalId]
  );

  return { internalId, postId, topic };
}

module.exports = {
  getUploadDir,
  saveUploadedFile,
  nextPostId,
  nextClaudeCardPostId,
  getPostByPostId,
  getPostInternalId,
  ensurePostChildren,
  fetchPostsWithRelations,
  insertPostBundle,
  insertTextOnlyPost,
};
