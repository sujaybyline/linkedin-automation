require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { query } = require("../db");
const { verifyPassword, signAccessToken } = require("../jwtUtil");

const EMAIL = process.argv[2] || "admin@apex.local";
const PASSWORD = process.argv[3] || "Admin@123";

(async () => {
  console.log("DB:", process.env.DB_NAME, "@", process.env.DB_HOST);

  const rows = await query(
    "SELECT id, email, role, password_hash FROM users WHERE email = ? LIMIT 1",
    [EMAIL]
  );
  const user = rows[0];
  if (!user) {
    console.error("FAIL: user not found:", EMAIL);
    console.error("Run: import dashboard/mysql/import_tables_only.sql in phpMyAdmin");
    process.exit(1);
  }

  console.log("User found:", user.email, "role:", user.role);
  if (!user.password_hash) {
    console.error("FAIL: password_hash is empty — run: node scripts/seed-users.js");
    process.exit(1);
  }

  const ok = await verifyPassword(PASSWORD, user.password_hash);
  console.log("Password check:", ok ? "OK" : "WRONG PASSWORD");
  if (!ok) {
    console.error("Try Admin@123 or run: node scripts/seed-users.js");
    process.exit(1);
  }

  const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
  console.log("JWT created:", token ? "OK" : "FAIL");
  console.log("Login should work. If browser still shows 500, check Node app logs after restart.");
})().catch((err) => {
  console.error("ERROR:", err.message);
  if (err.message.includes("password_hash")) {
    console.error("users table may be wrong — re-import import_tables_only.sql");
  }
  process.exit(1);
});
