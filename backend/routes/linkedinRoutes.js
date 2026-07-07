const express = require("express");
const asyncHandler = require("express-async-handler");
const env = require("../env");
const { query } = require("../db");
const { apiSuccess, apiError } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const { writeAuditLog } = require("../lib/audit");

const router = express.Router();

function mapAccount(row) {
  return {
    id: row.id,
    label: row.label,
    member_name: row.member_name,
    author_urn: row.author_urn,
    connected: Boolean(Number(row.connected)),
    is_default: Boolean(Number(row.is_default)),
    scopes: row.scopes || "",
  };
}

router.get(
  "/accounts",
  authRequired,
  requirePerm("linkedin:manage"),
  asyncHandler(async (_req, res) => {
    const rows = await query(
      "SELECT * FROM linkedin_accounts ORDER BY is_default DESC, label ASC"
    );
    return apiSuccess(res, rows.map(mapAccount));
  })
);

router.post(
  "/accounts",
  authRequired,
  requirePerm("linkedin:manage"),
  asyncHandler(async (req, res) => {
    const { label, member_name, connected, is_default } = req.body;
    if (!label || !String(label).trim()) return apiError(res, "label is required");

    if (is_default) {
      await query("UPDATE linkedin_accounts SET is_default = 0");
    }

    const countRows = await query("SELECT COUNT(*) AS c FROM linkedin_accounts");
    const makeDefault = Boolean(is_default) || Number(countRows[0]?.c) === 0;

    const result = await query(
      `INSERT INTO linkedin_accounts (label, member_name, connected, is_default)
       VALUES (?, ?, ?, ?)`,
      [String(label).trim(), String(member_name || "").trim(), connected ? 1 : 0, makeDefault ? 1 : 0]
    );

    if (makeDefault && !is_default) {
      await query("UPDATE linkedin_accounts SET is_default = 0 WHERE id != ?", [result.insertId]);
      await query("UPDATE linkedin_accounts SET is_default = 1 WHERE id = ?", [result.insertId]);
    }

    const rows = await query("SELECT * FROM linkedin_accounts WHERE id = ? LIMIT 1", [result.insertId]);
    await writeAuditLog({
      actorId: req.user.id,
      action: "linkedin.account_added",
      entityType: "linkedin_account",
      entityId: String(result.insertId),
      metadata: { label },
    });
    return apiSuccess(res, mapAccount(rows[0]), 201);
  })
);

router.patch(
  "/accounts/:id",
  authRequired,
  requirePerm("linkedin:manage"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { label, member_name, connected, is_default } = req.body;

    const existing = await query("SELECT * FROM linkedin_accounts WHERE id = ? LIMIT 1", [id]);
    if (!existing.length) return apiError(res, "Account not found", 404);

    if (is_default) {
      await query("UPDATE linkedin_accounts SET is_default = 0");
      await query("UPDATE linkedin_accounts SET is_default = 1 WHERE id = ?", [id]);
    }

    if (label !== undefined) {
      await query("UPDATE linkedin_accounts SET label = ? WHERE id = ?", [String(label).trim(), id]);
    }
    if (member_name !== undefined) {
      await query("UPDATE linkedin_accounts SET member_name = ? WHERE id = ?", [String(member_name).trim(), id]);
    }
    if (connected !== undefined) {
      await query("UPDATE linkedin_accounts SET connected = ? WHERE id = ?", [connected ? 1 : 0, id]);
    }

    const rows = await query("SELECT * FROM linkedin_accounts WHERE id = ? LIMIT 1", [id]);
    return apiSuccess(res, mapAccount(rows[0]));
  })
);

router.delete(
  "/accounts/:id",
  authRequired,
  requirePerm("linkedin:manage"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await query("SELECT * FROM linkedin_accounts WHERE id = ? LIMIT 1", [id]);
    if (!existing.length) return apiError(res, "Account not found", 404);

    await query("UPDATE schedules SET linkedin_account_id = NULL WHERE linkedin_account_id = ?", [id]);
    await query("DELETE FROM linkedin_accounts WHERE id = ?", [id]);

    const remaining = await query("SELECT id FROM linkedin_accounts ORDER BY id ASC LIMIT 1");
    if (remaining.length && existing[0].is_default) {
      await query("UPDATE linkedin_accounts SET is_default = 1 WHERE id = ?", [remaining[0].id]);
    }

    await writeAuditLog({
      actorId: req.user.id,
      action: "linkedin.account_removed",
      entityType: "linkedin_account",
      entityId: String(id),
    });
    return apiSuccess(res, { deleted: id });
  })
);

router.get(
  "/status",
  authRequired,
  requirePerm("linkedin:manage"),
  asyncHandler(async (_req, res) => {
    const rows = await query(
      "SELECT * FROM linkedin_accounts ORDER BY is_default DESC, label ASC"
    );
    const connected = rows.filter((r) => r.connected);
    const defaultAccount = rows.find((r) => r.is_default) || rows[0];
    return apiSuccess(res, {
      connected: connected.length > 0,
      account_count: rows.length,
      connected_count: connected.length,
      member_name: defaultAccount?.member_name || "",
      accounts: rows.map(mapAccount),
    });
  })
);

router.get(
  "/connect",
  authRequired,
  requirePerm("linkedin:manage"),
  asyncHandler(async (req, res) => {
    const accountId = req.query.account_id;
    if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_REDIRECT_URI) {
      return res.redirect(env.CLIENT_URL + "/linkedin?error=not_configured");
    }
    const scopes = encodeURIComponent("openid profile email w_member_social");
    const state = accountId ? encodeURIComponent(String(accountId)) : "";
    const url =
      `https://www.linkedin.com/oauth/v2/authorization?response_type=code` +
      `&client_id=${encodeURIComponent(env.LINKEDIN_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(env.LINKEDIN_REDIRECT_URI)}` +
      `&scope=${scopes}` +
      (state ? `&state=${state}` : "");
    return res.redirect(url);
  })
);

module.exports = router;
