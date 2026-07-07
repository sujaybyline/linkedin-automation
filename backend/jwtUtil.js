const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const env = require("./env");

function signAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL_SECONDS }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    // Session cookie — cleared when the browser is fully closed (no persistent maxAge)
    path: "/",
  };
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  hashPassword,
  verifyPassword,
  cookieOptions,
};
