const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const asyncHandler = require("express-async-handler");
const { query } = require("../db");
const { apiSuccess, apiError } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const { writeAuditLog } = require("../lib/audit");
const { inferTopicFromFilename } = require("../lib/captionGenerator");
const {
  nextPostId,
  saveUploadedFile,
  insertPostBundle,
  getUploadDir,
  fetchPostsWithRelations,
  getPostInternalId,
} = require("../lib/repository");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = express.Router();

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

router.get(
  "/",
  authRequired,
  requirePerm("dashboard:view"),
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT p.post_id, p.approval_status, p.quality_status, p.scheduling_status, p.campaign,
              p.created_at,
              COALESCE(vc.topic, LEFT(c.final_post_text, 200), '') AS topic,
              COALESCE(vc.filename, 'text-post') AS filename,
              COALESCE(vc.card_status, 'needs_review') AS card_status,
              COALESCE(vc.storage_path, '') AS storage_path,
              vc.id
       FROM posts p
       LEFT JOIN visual_cards vc ON vc.post_id = p.post_id
       LEFT JOIN captions c ON c.post_id = p.id
       ORDER BY p.created_at DESC`
    );
    return apiSuccess(res, rows);
  })
);

router.post(
  "/",
  authRequired,
  requirePerm("cards:upload"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    const topicOverride = req.body.topic || "";
    const postType = req.body.post_type === "ai" ? "ai" : "manual";
    const finalPostText = String(req.body.final_post_text || "").trim();
    const suggestedHashtags = String(req.body.suggested_hashtags || "").trim();
    const suggestedCta = String(req.body.suggested_cta || "").trim();
    const campaign = postType === "ai" ? "AI Generated" : "Manual Post";

    if (!file) return apiError(res, "file is required");

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return apiError(res, "Only PNG, JPEG, and WebP images are allowed");
    }

    const postId = await nextPostId();
    const inferred = inferTopicFromFilename(file.originalname);
    const topic = topicOverride || inferred.topic;
    const storagePath = await saveUploadedFile(postId, file.originalname, file.buffer);

    const cardResult = await query(
      `INSERT INTO visual_cards
       (post_id, storage_path, filename, topic, content_pillar, audience, card_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'needs_review', ?)`,
      [postId, storagePath, file.originalname, topic, inferred.pillar, inferred.audience, req.user.id]
    );

    const internalPostId = await insertPostBundle({
      postId,
      visualCardId: cardResult.insertId,
      contentPillar: inferred.pillar,
      audience: inferred.audience,
      createdBy: req.user.id,
      campaign,
    });

    if (finalPostText || suggestedHashtags || suggestedCta) {
      await query(
        `UPDATE captions
         SET final_post_text = ?, suggested_hashtags = ?, suggested_cta = ?
         WHERE post_id = ?`,
        [finalPostText, suggestedHashtags, suggestedCta, internalPostId]
      );
      await query(
        `UPDATE posts SET approval_status = 'pending_review' WHERE id = ?`,
        [internalPostId]
      );
    }

    await writeAuditLog({
      actorId: req.user.id,
      action: "card.uploaded",
      entityType: "post",
      entityId: postId,
      metadata: { filename: file.originalname, post_type: postType, campaign },
    });

    const card = (await query("SELECT * FROM visual_cards WHERE post_id = ? LIMIT 1", [postId]))[0];
    return apiSuccess(res, { postId, card }, 201);
  })
);

router.get(
  "/:postId/image",
  authRequired,
  requirePerm("dashboard:view"),
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const rows = await query(
      "SELECT storage_path, filename FROM visual_cards WHERE post_id = ? LIMIT 1",
      [postId]
    );
    const card = rows[0];
    if (!card?.storage_path || card.storage_path === "_text_") {
      return apiError(res, "Image not found", 404);
    }

    const filePath = path.join(getUploadDir(), String(card.storage_path));
    const ext = path.extname(String(card.filename)).toLowerCase();

    try {
      const buffer = await fs.readFile(filePath);
      res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.send(buffer);
    } catch {
      return apiError(res, "Image file missing on disk", 404);
    }
  })
);

router.get(
  "/:postId",
  authRequired,
  requirePerm("cards:edit"),
  asyncHandler(async (req, res) => {
    const rows = await fetchPostsWithRelations("p.post_id = ?", [req.params.postId]);
    if (!rows.length) return apiError(res, "Post not found", 404);
    return apiSuccess(res, rows[0]);
  })
);

router.patch(
  "/:postId",
  authRequired,
  requirePerm("cards:edit"),
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const internalId = await getPostInternalId(postId);
    if (!internalId) return apiError(res, "Post not found", 404);

    const { topic, content_pillar, audience, final_post_text, suggested_hashtags, suggested_cta, resubmit_for_approval } =
      req.body;

    if (topic !== undefined) {
      await query("UPDATE visual_cards SET topic = ? WHERE post_id = ?", [topic, postId]);
    }
    if (content_pillar !== undefined) {
      await query("UPDATE visual_cards SET content_pillar = ? WHERE post_id = ?", [content_pillar, postId]);
      await query("UPDATE posts SET content_pillar = ? WHERE id = ?", [content_pillar, internalId]);
    }
    if (audience !== undefined) {
      await query("UPDATE visual_cards SET audience = ? WHERE post_id = ?", [audience, postId]);
      await query("UPDATE posts SET audience = ? WHERE id = ?", [audience, internalId]);
    }

    if (final_post_text !== undefined || suggested_hashtags !== undefined || suggested_cta !== undefined) {
      const capRows = await query("SELECT final_post_text, suggested_hashtags, suggested_cta FROM captions WHERE post_id = ? LIMIT 1", [internalId]);
      const existing = capRows[0] || {};
      await query(
        `INSERT INTO captions (post_id, final_post_text, suggested_hashtags, suggested_cta)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           final_post_text = VALUES(final_post_text),
           suggested_hashtags = VALUES(suggested_hashtags),
           suggested_cta = VALUES(suggested_cta)`,
        [
          internalId,
          final_post_text !== undefined ? final_post_text : existing.final_post_text ?? "",
          suggested_hashtags !== undefined ? suggested_hashtags : existing.suggested_hashtags ?? "",
          suggested_cta !== undefined ? suggested_cta : existing.suggested_cta ?? "",
        ]
      );
    }

    if (resubmit_for_approval) {
      await query(
        `UPDATE posts SET approval_status = 'pending_review', quality_status = 'needs_review' WHERE id = ?`,
        [internalId]
      );
      await query("UPDATE visual_cards SET card_status = 'needs_review' WHERE post_id = ?", [postId]);
      await query(
        `UPDATE claims_reviews SET approval_status = 'Needs Review', approval_recommendation = 'Needs Review'
         WHERE post_id = ?`,
        [internalId]
      );
    }

    await writeAuditLog({
      actorId: req.user.id,
      action: resubmit_for_approval ? "card.resubmitted" : "card.updated",
      entityType: "post",
      entityId: postId,
      metadata: { resubmit_for_approval: Boolean(resubmit_for_approval) },
    });

    const updated = await fetchPostsWithRelations("p.post_id = ?", [postId]);
    return apiSuccess(res, updated[0]);
  })
);

router.delete(
  "/:postId",
  authRequired,
  requirePerm("cards:edit"),
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const cardRows = await query("SELECT storage_path FROM visual_cards WHERE post_id = ? LIMIT 1", [postId]);
    const card = cardRows[0];
    if (!card) return apiError(res, "Card not found", 404);

    const internalId = await getPostInternalId(postId);
    if (internalId) {
      await query("DELETE FROM posts WHERE id = ?", [internalId]);
    }
    await query("DELETE FROM visual_cards WHERE post_id = ?", [postId]);

    if (card.storage_path && card.storage_path !== "_text_") {
      const filePath = path.join(getUploadDir(), String(card.storage_path));
      const dirPath = path.dirname(filePath);
      try {
        await fs.rm(dirPath, { recursive: true, force: true });
      } catch {
        /* ignore missing folder */
      }
    }

    await writeAuditLog({
      actorId: req.user.id,
      action: "card.deleted",
      entityType: "post",
      entityId: postId,
    });

    return apiSuccess(res, { deleted: postId });
  })
);

module.exports = router;
