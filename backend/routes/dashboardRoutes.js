const express = require("express");
const asyncHandler = require("express-async-handler");
const { query } = require("../db");
const { apiSuccess } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const { isPostDue } = require("../lib/scheduleUtils");

const { fetchPostsWithRelations } = require("../lib/repository");

const router = express.Router();

router.get(
  "/stats",
  authRequired,
  requirePerm("dashboard:view"),
  asyncHandler(async (_req, res) => {
    const [scheduledRow] = await query(
      "SELECT COUNT(*) AS c FROM schedules WHERE auto_post_status = 'scheduled'"
    );
    const [publishedRow] = await query(
      "SELECT COUNT(*) AS c FROM publishing_logs WHERE status = 'published'"
    );
    const [failedRow] = await query("SELECT COUNT(*) AS c FROM publishing_logs WHERE status = 'failed'");
    const [pendingRow] = await query(
      "SELECT COUNT(*) AS c FROM posts WHERE approval_status IN ('pending_review','draft')"
    );
    const [settingsRow] = await query("SELECT * FROM system_settings WHERE id = 1");
    const [linkedin] = await query(
      "SELECT COUNT(*) AS c FROM linkedin_accounts WHERE connected = 1"
    );
    const scheduleRows = await query(
      "SELECT scheduled_date, scheduled_time FROM schedules WHERE auto_post_status = 'scheduled'"
    );

    const windowMinutes = settingsRow?.posting_window_minutes ?? 15;
    const due = scheduleRows.filter((s) => {
      const dateStr =
        s.scheduled_date instanceof Date
          ? s.scheduled_date.toISOString().slice(0, 10)
          : String(s.scheduled_date);
      const timeStr = String(s.scheduled_time).slice(0, 8);
      return dateStr && timeStr && isPostDue(dateStr, timeStr, windowMinutes);
    }).length;

    return apiSuccess(res, {
      scheduled: scheduledRow?.c ?? 0,
      due,
      published: publishedRow?.c ?? 0,
      failed: failedRow?.c ?? 0,
      pendingReview: pendingRow?.c ?? 0,
      emergencyStop: Boolean(Number(settingsRow?.emergency_stop ?? 1)),
      linkedinConnected: Number(linkedin[0]?.c ?? 0) > 0,
      dryRunMode: Boolean(Number(settingsRow?.dry_run_mode ?? 1)),
      autoPublish: Boolean(Number(settingsRow?.auto_publish ?? 0)),
    });
  })
);

router.get(
  "/posts",
  authRequired,
  requirePerm("dashboard:view"),
  asyncHandler(async (_req, res) => {
    const rows = await fetchPostsWithRelations("1=1", [], "p.created_at DESC");
    const posts = rows.map((row) => ({
      post_id: row.post_id,
      topic: row.visual_cards?.topic ?? "",
      filename: row.visual_cards?.filename ?? "",
      approval_status: row.approval_status,
      quality_status: row.quality_status,
      scheduling_status: row.scheduling_status,
      card_status: row.visual_cards?.card_status ?? "",
      scheduled_date: row.schedules?.scheduled_date ?? null,
      scheduled_time: row.schedules?.scheduled_time ?? null,
      auto_post_status: row.schedules?.auto_post_status ?? "",
      created_at: row.created_at,
    }));
    return apiSuccess(res, posts);
  })
);

module.exports = router;
