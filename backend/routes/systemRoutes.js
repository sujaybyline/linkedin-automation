const express = require("express");
const asyncHandler = require("express-async-handler");
const { query } = require("../db");
const { apiSuccess } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const { writeAuditLog } = require("../lib/audit");

const router = express.Router();

router.get(
  "/emergency-stop",
  authRequired,
  requirePerm("dashboard:view"),
  asyncHandler(async (_req, res) => {
    const rows = await query("SELECT * FROM system_settings WHERE id = 1 LIMIT 1");
    const s = rows[0];
    return apiSuccess(res, {
      ...s,
      dry_run_mode: Boolean(Number(s?.dry_run_mode ?? 1)),
      auto_publish: Boolean(Number(s?.auto_publish ?? 0)),
      emergency_stop: Boolean(Number(s?.emergency_stop ?? 1)),
      auto_image_posting: Boolean(Number(s?.auto_image_posting ?? 0)),
    });
  })
);

router.put(
  "/emergency-stop",
  authRequired,
  requirePerm("emergency:manage"),
  asyncHandler(async (req, res) => {
    const { emergency_stop } = req.body;
    if (typeof emergency_stop !== "boolean") {
      return res.status(400).json({ data: null, error: { message: "emergency_stop must be true or false" } });
    }

    await query(
      `INSERT INTO system_settings (id, emergency_stop, updated_by)
       VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE emergency_stop = VALUES(emergency_stop), updated_by = VALUES(updated_by)`,
      [emergency_stop ? 1 : 0, req.user.id]
    );

    await writeAuditLog({
      actorId: req.user.id,
      action: "emergency_stop.toggled",
      entityType: "system_settings",
      entityId: "1",
      metadata: { emergency_stop: Boolean(emergency_stop) },
    });

    return apiSuccess(res, { emergency_stop: Boolean(emergency_stop) });
  })
);

module.exports = router;
