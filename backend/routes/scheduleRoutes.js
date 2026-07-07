const express = require("express");
const asyncHandler = require("express-async-handler");
const { query } = require("../db");
const { apiSuccess, apiError } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const { writeAuditLog } = require("../lib/audit");
const { fetchPostsWithRelations, getPostInternalId } = require("../lib/repository");
const { nextWeekdaySlots } = require("../lib/scheduleUtils");

const router = express.Router();

router.get(
  "/",
  authRequired,
  requirePerm("schedule:manage"),
  asyncHandler(async (_req, res) => {
    const data = await fetchPostsWithRelations("1=1", [], "p.created_at ASC");
    return apiSuccess(res, data);
  })
);

router.post(
  "/",
  authRequired,
  requirePerm("schedule:manage"),
  asyncHandler(async (req, res) => {
    if (req.body.action !== "auto-fill") return apiError(res, "Unknown action");

    const approved = await query(
      `SELECT p.id, p.post_id, s.auto_post_status, s.scheduled_date
       FROM posts p
       LEFT JOIN schedules s ON s.post_id = p.id
       WHERE p.approval_status = 'approved'`
    );

    const needsSlot = approved.filter((p) => {
      const status = p.auto_post_status;
      return (
        !status ||
        status === "unscheduled" ||
        status === "paused" ||
        (status === "scheduled" && !p.scheduled_date)
      );
    });

    const slots = nextWeekdaySlots(needsSlot.length);
    const defaultAcct = await query("SELECT id FROM linkedin_accounts WHERE is_default = 1 LIMIT 1");
    const defaultAccountId = defaultAcct[0]?.id ?? null;

    for (let i = 0; i < needsSlot.length; i++) {
      const slot = slots[i];
      await query(
        `INSERT INTO schedules (post_id, scheduled_date, scheduled_time, timezone, auto_post_status, sort_order, linkedin_account_id)
         VALUES (?, ?, ?, ?, 'scheduled', ?, ?)
         ON DUPLICATE KEY UPDATE
           scheduled_date = VALUES(scheduled_date),
           scheduled_time = VALUES(scheduled_time),
           timezone = VALUES(timezone),
           auto_post_status = 'scheduled',
           sort_order = VALUES(sort_order),
           linkedin_account_id = COALESCE(schedules.linkedin_account_id, VALUES(linkedin_account_id))`,
        [needsSlot[i].id, slot.date, slot.time, slot.timezone, i, defaultAccountId]
      );
      await query("UPDATE posts SET scheduling_status = 'scheduled' WHERE id = ?", [needsSlot[i].id]);
    }

    await writeAuditLog({
      actorId: req.user.id,
      action: "schedule.auto_fill",
      entityType: "schedule",
      entityId: "batch",
      metadata: { count: needsSlot.length },
    });

    return apiSuccess(res, { scheduled: needsSlot.length });
  })
);

router.patch(
  "/",
  authRequired,
  requirePerm("schedule:manage"),
  asyncHandler(async (req, res) => {
    const { postId, scheduled_date, scheduled_time, timezone, auto_post_status, linkedin_account_id } =
      req.body;
    const internalId = await getPostInternalId(postId);
    if (!internalId) return apiError(res, "Post not found", 404);

    const existing = await query(
      "SELECT scheduled_date, scheduled_time, timezone, auto_post_status, linkedin_account_id FROM schedules WHERE post_id = ?",
      [internalId]
    );
    const row = existing[0];

    const newDate = scheduled_date !== undefined ? scheduled_date : row?.scheduled_date ?? null;
    const newTime = scheduled_time !== undefined ? scheduled_time : row?.scheduled_time ?? null;
    const newTz = timezone !== undefined ? timezone : row?.timezone ?? "America/New_York";
    const newStatus =
      auto_post_status !== undefined ? auto_post_status : row?.auto_post_status ?? "scheduled";

    let newAccountId =
      linkedin_account_id !== undefined
        ? linkedin_account_id === null || linkedin_account_id === ""
          ? null
          : Number(linkedin_account_id)
        : row?.linkedin_account_id ?? null;

    if (newAccountId) {
      const acct = await query("SELECT id FROM linkedin_accounts WHERE id = ? LIMIT 1", [newAccountId]);
      if (!acct.length) return apiError(res, "LinkedIn account not found", 404);
    }

    const timeValue = newTime && String(newTime).length <= 5 ? `${newTime}:00` : newTime;

    await query(
      `INSERT INTO schedules (post_id, scheduled_date, scheduled_time, timezone, auto_post_status, linkedin_account_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         scheduled_date = VALUES(scheduled_date),
         scheduled_time = VALUES(scheduled_time),
         timezone = VALUES(timezone),
         auto_post_status = VALUES(auto_post_status),
         linkedin_account_id = VALUES(linkedin_account_id)`,
      [internalId, newDate, timeValue, newTz, newStatus, newAccountId]
    );

    await query("UPDATE posts SET scheduling_status = ? WHERE id = ?", [newStatus, internalId]);

    await writeAuditLog({
      actorId: req.user.id,
      action: "schedule.updated",
      entityType: "post",
      entityId: postId,
      metadata: {
        scheduled_date: newDate,
        scheduled_time: newTime,
        auto_post_status: newStatus,
        linkedin_account_id: newAccountId,
      },
    });

    return apiSuccess(res, { ok: true });
  })
);

module.exports = router;
