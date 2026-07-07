const express = require("express");
const asyncHandler = require("express-async-handler");
const { query } = require("../db");
const { apiSuccess, apiError } = require("../lib/apiResponse");
const {
  signAccessToken,
  hashPassword,
  verifyPassword,
  cookieOptions,
} = require("../jwtUtil");
const env = require("../env");
const { authRequired, requirePerm } = require("../middleware/auth");
const { writeAuditLog } = require("../lib/audit");

const router = express.Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return apiError(res, "Email and password required");

    const rows = await query(
      "SELECT id, email, full_name, role, password_hash FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    const user = rows[0];
    if (!user) return apiError(res, "Invalid email or password", 401);
    if (!user.password_hash) {
      console.error("[auth/login] user has no password_hash:", email);
      return apiError(res, "Account not configured. Run seed-users.js on the server.", 500);
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return apiError(res, "Invalid email or password", 401);

    const token = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.cookie(env.COOKIE_NAME, token, cookieOptions());
    return apiSuccess(res, {
      id: String(user.id),
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      token,
    });
  })
);

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, full_name } = req.body;
    if (!email || !password) return apiError(res, "Email and password required");
    if (password.length < 6) return apiError(res, "Password must be at least 6 characters");

    const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing.length) return apiError(res, "Email already registered", 409);

    const passwordHash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'viewer')`,
      [email, passwordHash, full_name ?? ""]
    );

    const token = signAccessToken({
      id: result.insertId,
      email,
      role: "viewer",
    });

    res.cookie(env.COOKIE_NAME, token, cookieOptions());
    return apiSuccess(res, {
      id: String(result.insertId),
      email,
      full_name: full_name ?? "",
      role: "viewer",
      token,
    });
  })
);

router.post("/logout", (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, { path: "/" });
  return apiSuccess(res, { ok: true });
});

router.get(
  "/me",
  authRequired,
  asyncHandler(async (req, res) => {
    return apiSuccess(res, req.user);
  })
);

router.patch(
  "/profile",
  authRequired,
  asyncHandler(async (req, res) => {
    const { full_name, current_password, new_password } = req.body;
    const rows = await query("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    const row = rows[0];
    if (!row) return apiError(res, "User not found", 404);

    if (new_password) {
      if (!current_password) return apiError(res, "Current password is required");
      if (String(new_password).length < 6) return apiError(res, "New password must be at least 6 characters");
      const ok = await verifyPassword(current_password, row.password_hash);
      if (!ok) return apiError(res, "Current password is incorrect", 401);
      const passwordHash = await hashPassword(new_password);
      await query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, req.user.id]);
    }

    if (full_name !== undefined) {
      await query("UPDATE users SET full_name = ? WHERE id = ?", [String(full_name).trim(), req.user.id]);
    }

    const updated = await query(
      "SELECT id, email, full_name, role FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    const user = updated[0];

    await writeAuditLog({
      actorId: req.user.id,
      action: "profile.updated",
      entityType: "user",
      entityId: req.user.id,
      metadata: { password_changed: Boolean(new_password) },
    });

    return apiSuccess(res, {
      id: String(user.id),
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    });
  })
);

router.get(
  "/team-login",
  authRequired,
  requirePerm("users:manage"),
  asyncHandler(async (_req, res) => {
    const rows = await query(
      "SELECT id, email, full_name, role FROM users WHERE role = 'team' ORDER BY id ASC LIMIT 1"
    );
    if (!rows.length) return apiSuccess(res, null);
    const user = rows[0];
    return apiSuccess(res, {
      id: String(user.id),
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    });
  })
);

router.patch(
  "/team-login",
  authRequired,
  requirePerm("users:manage"),
  asyncHandler(async (req, res) => {
    const { email, full_name, new_password } = req.body;
    const rows = await query("SELECT id, email FROM users WHERE role = 'team' ORDER BY id ASC LIMIT 1");
    if (!rows.length) return apiError(res, "Team user not found. Run seed-users.js first.", 404);

    const teamUser = rows[0];

    if (email && email !== teamUser.email) {
      const clash = await query("SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1", [
        email,
        teamUser.id,
      ]);
      if (clash.length) return apiError(res, "Email already in use", 409);
      await query("UPDATE users SET email = ? WHERE id = ?", [String(email).trim(), teamUser.id]);
    }

    if (full_name !== undefined) {
      await query("UPDATE users SET full_name = ? WHERE id = ?", [String(full_name).trim(), teamUser.id]);
    }

    if (new_password) {
      if (String(new_password).length < 6) return apiError(res, "Password must be at least 6 characters");
      const passwordHash = await hashPassword(new_password);
      await query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, teamUser.id]);
    }

    const updated = await query(
      "SELECT id, email, full_name, role FROM users WHERE id = ? LIMIT 1",
      [teamUser.id]
    );
    const user = updated[0];

    await writeAuditLog({
      actorId: req.user.id,
      action: "team_login.updated",
      entityType: "user",
      entityId: String(teamUser.id),
      metadata: { email: user.email, password_changed: Boolean(new_password) },
    });

    return apiSuccess(res, {
      id: String(user.id),
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    });
  })
);

module.exports = router;
