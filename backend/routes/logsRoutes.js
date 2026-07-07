const express = require("express");
const asyncHandler = require("express-async-handler");
const { query } = require("../db");
const { apiSuccess } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/publishing",
  authRequired,
  requirePerm("logs:view"),
  asyncHandler(async (_req, res) => {
    const rows = await query("SELECT * FROM publishing_logs ORDER BY attempted_at_utc DESC LIMIT 100");
    return apiSuccess(res, rows);
  })
);

router.get(
  "/audit",
  authRequired,
  requirePerm("audit:view"),
  asyncHandler(async (_req, res) => {
    const rows = await query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100");
    return apiSuccess(res, rows);
  })
);

module.exports = router;
