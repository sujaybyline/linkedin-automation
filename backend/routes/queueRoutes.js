const express = require("express");
const asyncHandler = require("express-async-handler");
const { query } = require("../db");
const { apiSuccess } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const { fetchPostsWithRelations } = require("../lib/repository");
const { isPostDue } = require("../lib/scheduleUtils");

const router = express.Router();

router.get(
  "/",
  authRequired,
  requirePerm("dashboard:view"),
  asyncHandler(async (_req, res) => {
    const settingsRows = await query("SELECT posting_window_minutes FROM system_settings WHERE id = 1");
    const windowMinutes = settingsRows[0]?.posting_window_minutes ?? 15;

    const rows = await fetchPostsWithRelations(
      `p.approval_status = 'approved' AND p.scheduling_status IN ('scheduled','paused','published')`,
      [],
      "s.scheduled_date ASC, s.scheduled_time ASC, p.created_at ASC"
    );

    const enriched = rows.map((row) => {
      const schedule = row.schedules;
      const dateStr =
        schedule?.scheduled_date instanceof Date
          ? schedule.scheduled_date.toISOString().slice(0, 10)
          : String(schedule?.scheduled_date ?? "");
      const timeStr = String(schedule?.scheduled_time ?? "").slice(0, 8);
      const due = dateStr && timeStr ? isPostDue(dateStr, timeStr, windowMinutes) : false;
      const autoStatus = schedule?.auto_post_status ?? row.scheduling_status ?? "";
      const isPosted = autoStatus === "published" || row.scheduling_status === "published";
      return {
        ...row,
        due,
        readyToPublish: due && row.quality_status === "pass",
        publish_state: isPosted ? "posted" : "pending",
      };
    });

    return apiSuccess(res, enriched);
  })
);

module.exports = router;
