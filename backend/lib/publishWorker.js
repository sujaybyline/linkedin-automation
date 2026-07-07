const { query } = require("../db");
const { isPostDue } = require("./scheduleUtils");

const MAX_RETRY = 1;

function mapSettings(row) {
  return {
    dry_run_mode: Boolean(row.dry_run_mode),
    auto_publish: Boolean(row.auto_publish),
    emergency_stop: Boolean(row.emergency_stop),
    auto_image_posting: Boolean(row.auto_image_posting),
    max_posts_per_run: row.max_posts_per_run,
    posting_timezone: row.posting_timezone,
    posting_window_minutes: row.posting_window_minutes,
  };
}

function liveBlocks(settings) {
  const blocks = [];
  if (settings.dry_run_mode) blocks.push("DRY_RUN_MODE is true");
  if (!settings.auto_publish) blocks.push("AUTO_PUBLISH is false");
  if (settings.emergency_stop) blocks.push("EMERGENCY_STOP is true");
  if (!settings.auto_image_posting) blocks.push("AUTO_IMAGE_POSTING is false");
  if (settings.max_posts_per_run !== 1) blocks.push("MAX_POSTS_PER_RUN must be 1");
  return blocks;
}

async function logAttempt(postId, settings, status, reason, schedule) {
  await query(
    `INSERT INTO publishing_logs
     (post_id, status, reason, scheduled_date, scheduled_time, timezone,
      dry_run_mode, auto_publish, emergency_stop, auto_image_posting)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      postId ?? "N/A",
      status,
      reason,
      schedule?.scheduled_date ?? null,
      schedule?.scheduled_time ?? null,
      schedule?.timezone ?? null,
      settings.dry_run_mode,
      settings.auto_publish,
      settings.emergency_stop,
      settings.auto_image_posting,
    ]
  );
}

async function runPublishWorker() {
  const settingsRows = await query("SELECT * FROM system_settings WHERE id = 1 LIMIT 1");
  const settings = settingsRows[0];
  if (!settings) return { status: "failed", reason: "System settings not found" };

  const s = mapSettings(settings);

  if (s.emergency_stop) {
    await logAttempt(null, settings, "blocked", "EMERGENCY_STOP is true");
    return { status: "blocked", reason: "Emergency stop is active" };
  }

  const blocks = liveBlocks(s);
  const isDryRun = blocks.length > 0;

  const rows = await query(
    `SELECT p.post_id, p.approval_status, p.quality_status, p.posting_channel,
            s.scheduled_date, s.scheduled_time, s.timezone, s.auto_post_status, s.retry_count,
            c.final_post_text, cr.approval_status AS cr_status, cr.risk_level
     FROM posts p
     JOIN schedules s ON s.post_id = p.id
     LEFT JOIN captions c ON c.post_id = p.id
     LEFT JOIN claims_reviews cr ON cr.post_id = p.id
     WHERE p.approval_status = 'approved' AND p.scheduling_status = 'scheduled'`
  );

  if (!rows.length) return { status: "skipped", reason: "No approved scheduled posts" };

  const publishedRows = await query("SELECT post_id FROM publishing_logs WHERE status = 'published'");
  const publishedIds = new Set(publishedRows.map((r) => r.post_id));

  for (const row of rows) {
    if (row.auto_post_status !== "scheduled") continue;
    if (publishedIds.has(row.post_id)) continue;
    if ((row.retry_count ?? 0) > MAX_RETRY) continue;

    const dateStr =
      row.scheduled_date instanceof Date
        ? row.scheduled_date.toISOString().slice(0, 10)
        : String(row.scheduled_date);
    const timeStr = String(row.scheduled_time).slice(0, 8);

    if (!isPostDue(dateStr, timeStr, s.posting_window_minutes)) continue;

    const validationErrors = [];
    if (row.quality_status !== "pass") validationErrors.push("quality_status is not pass");
    if (!String(row.final_post_text ?? "").trim()) validationErrors.push("final_post_text is empty");
    if (row.risk_level === "high") validationErrors.push("claims risk is high");
    if (row.cr_status && !["Auto Approved", "approved", "Approved"].includes(String(row.cr_status))) {
      validationErrors.push("claims not approved");
    }
    if (row.posting_channel !== "Founder Profile") {
      validationErrors.push("posting_channel must be Founder Profile");
    }

    if (validationErrors.length) {
      await logAttempt(row.post_id, settings, "skipped", validationErrors.join("; "), {
        scheduled_date: dateStr,
        scheduled_time: timeStr,
        timezone: row.timezone,
      });
      return { status: "skipped", postId: row.post_id, reason: validationErrors.join("; ") };
    }

    if (isDryRun) {
      await logAttempt(row.post_id, settings, "dry_run", `Dry run only. Blocks: ${blocks.join("; ")}`, {
        scheduled_date: dateStr,
        scheduled_time: timeStr,
        timezone: row.timezone,
      });
      return { status: "dry_run", postId: row.post_id, reason: `Would publish (blocked: ${blocks.join(", ")})` };
    }

    await logAttempt(row.post_id, settings, "blocked", "Live posting not enabled in MVP build", {
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      timezone: row.timezone,
    });
    return { status: "blocked", postId: row.post_id, reason: "Live LinkedIn API posting requires Phase 2 enablement" };
  }

  return { status: "skipped", reason: "No due posts in window" };
}

module.exports = { runPublishWorker };
