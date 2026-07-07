const { verifyAccessToken } = require("../jwtUtil");
const env = require("../env");
const { query } = require("../db");
const { requirePermission } = require("../lib/rbac");
const { unauthorized, forbidden } = require("../errors");

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  return req.cookies?.[env.COOKIE_NAME] ?? null;
}

async function authRequired(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized();

    const claims = verifyAccessToken(token);
    const rows = await query(
      "SELECT id, email, full_name, role FROM users WHERE id = ? LIMIT 1",
      [claims.userId]
    );
    const user = rows[0];
    if (!user) throw unauthorized();

    req.user = {
      id: String(user.id),
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    };
    next();
  } catch (err) {
    if (err.status) return next(err);
    next(unauthorized());
  }
}

function requirePerm(permission) {
  return (req, res, next) => {
    try {
      requirePermission(req.user.role, permission);
      next();
    } catch {
      next(forbidden());
    }
  };
}

module.exports = { authRequired, requirePerm, extractToken };
