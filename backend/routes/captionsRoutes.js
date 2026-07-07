const express = require("express");
const asyncHandler = require("express-async-handler");
const { query } = require("../db");
const { apiSuccess, apiError } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const { writeAuditLog } = require("../lib/audit");
const { generateCaptionForPost } = require("../lib/aiCaptionService");
const { fetchPostsWithRelations, getPostInternalId } = require("../lib/repository");

const router = express.Router({ mergeParams: true });

router.get(
  "/:postId",
  authRequired,
  requirePerm("captions:edit"),
  asyncHandler(async (req, res) => {
    const rows = await fetchPostsWithRelations("p.post_id = ?", [req.params.postId], "p.created_at DESC");
    if (!rows.length) return apiError(res, "Post not found", 404);
    return apiSuccess(res, rows[0]);
  })
);

router.post(
  "/:postId",
  authRequired,
  requirePerm("captions:generate"),
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const internalId = await getPostInternalId(postId);
    if (!internalId) return apiError(res, "Post not found", 404);

    const rows = await fetchPostsWithRelations("p.post_id = ?", [postId]);
    const post = rows[0];
    const card = post.visual_cards;
    const generated = await generateCaptionForPost({ post, card });

    await query(
      `INSERT INTO captions (post_id, final_post_text, suggested_hashtags, suggested_cta, blocked_words, claims_used)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         final_post_text = VALUES(final_post_text),
         suggested_hashtags = VALUES(suggested_hashtags),
         suggested_cta = VALUES(suggested_cta),
         blocked_words = VALUES(blocked_words),
         claims_used = VALUES(claims_used)`,
      [
        internalId,
        generated.finalPostText,
        generated.suggestedHashtags,
        generated.suggestedCta,
        JSON.stringify(generated.blockedWords),
        JSON.stringify(generated.claimsUsed),
      ]
    );

    await query(
      `INSERT INTO claims_reviews (post_id, visible_card_claim, caption_claims_used, risk_level, approval_recommendation, approval_status)
       VALUES (?, ?, ?, ?, ?, 'Needs Review')
       ON DUPLICATE KEY UPDATE
         visible_card_claim = VALUES(visible_card_claim),
         caption_claims_used = VALUES(caption_claims_used),
         risk_level = VALUES(risk_level),
         approval_recommendation = VALUES(approval_recommendation)`,
      [internalId, card?.topic ?? "", generated.claimsUsed.join("; "), generated.riskLevel, generated.recommendation]
    );

    await query(`UPDATE posts SET approval_status = 'pending_review', quality_status = ? WHERE id = ?`, [
      generated.blockedWords.length ? "needs_review" : "pass",
      internalId,
    ]);

    await writeAuditLog({
      actorId: req.user.id,
      action: "caption.generated",
      entityType: "post",
      entityId: postId,
      metadata: { riskLevel: generated.riskLevel, source: generated.source ?? "rules" },
    });

    return apiSuccess(res, generated);
  })
);

router.put(
  "/:postId",
  authRequired,
  requirePerm("captions:edit"),
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const internalId = await getPostInternalId(postId);
    if (!internalId) return apiError(res, "Post not found", 404);

    const body = req.body;
    await query(
      `INSERT INTO captions (post_id, final_post_text, suggested_hashtags, suggested_cta)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         final_post_text = VALUES(final_post_text),
         suggested_hashtags = VALUES(suggested_hashtags),
         suggested_cta = VALUES(suggested_cta)`,
      [internalId, body.final_post_text ?? "", body.suggested_hashtags ?? "", body.suggested_cta ?? ""]
    );

    await writeAuditLog({
      actorId: req.user.id,
      action: "caption.updated",
      entityType: "post",
      entityId: postId,
    });

    return apiSuccess(res, { ok: true });
  })
);

module.exports = router;
