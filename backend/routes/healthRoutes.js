const express = require("express");
const asyncHandler = require("express-async-handler");
const env = require("../env");
const { testConnection, query } = require("../db");
const { apiSuccess } = require("../lib/apiResponse");
const { writeAuditLog } = require("../lib/audit");
const { runPublishWorker } = require("../lib/publishWorker");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const configured = Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER);
    if (!configured) {
      return apiSuccess(res, { configured: false, connected: false, tables: 0 });
    }
    try {
      const connected = await testConnection();
      let tables = 0;
      if (connected) {
        const rows = await query("SHOW TABLES");
        tables = rows.length;
      }
      return apiSuccess(res, { configured: true, connected, tables });
    } catch {
      return apiSuccess(res, { configured: true, connected: false, tables: 0 });
    }
  })
);

router.post(
  "/publish",
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await runPublishWorker();
    await writeAuditLog({
      actorId: null,
      action: "worker.run",
      entityType: "worker",
      entityId: result.postId ?? "none",
      metadata: { ...result },
    });

    return res.json({ data: result, error: null });
  })
);

module.exports = router;
