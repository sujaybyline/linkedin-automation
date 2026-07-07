const express = require("express");
const asyncHandler = require("express-async-handler");
const { query } = require("../db");
const { apiSuccess, apiError } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const { writeAuditLog } = require("../lib/audit");
const { fetchPostsWithRelations, getPostInternalId } = require("../lib/repository");

const router = express.Router();

router.get(
  "/",
  authRequired,
  requirePerm("approvals:manage"),
  asyncHandler(async (_req, res) => {
    const data = await fetchPostsWithRelations(
      "p.approval_status IN ('pending_review','draft','revision_needed','legal_review')",
      [],
      "p.created_at DESC"
    );
    return apiSuccess(res, data);
  })
);

router.post(
  "/:postId",
  authRequired,
  requirePerm("approvals:manage"),
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { action, note } = req.body;

    const statusMap = {
      approve: "approved",
      reject: "rejected",
      revision: "revision_needed",
      legal: "legal_review",
    };

    const newStatus = statusMap[action];
    if (!newStatus) return apiError(res, "Invalid action");

    const internalId = await getPostInternalId(postId);
    if (!internalId) return apiError(res, "Post not found", 404);

    await query(`UPDATE posts SET approval_status = ?, quality_status = ? WHERE id = ?`, [
      newStatus,
      action === "approve" ? "pass" : "needs_review",
      internalId,
    ]);

    if (action === "approve") {
      await query("UPDATE visual_cards SET card_status = 'approved' WHERE post_id = ?", [postId]);
    }
    if (action === "reject") {
      await query("UPDATE visual_cards SET card_status = 'rejected' WHERE post_id = ?", [postId]);
    }

    await writeAuditLog({
      actorId: req.user.id,
      action: `post.${action}`,
      entityType: "post",
      entityId: postId,
      metadata: { note },
    });

    return apiSuccess(res, { postId, approval_status: newStatus });
  })
);

module.exports = router;
