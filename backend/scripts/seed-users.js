require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { query } = require("../db");
const { hashPassword } = require("../jwtUtil");

const TEAM_EMAIL = "team@apex.local";
const TEAM_PASSWORD = "Team@123";

async function seedUsers() {
  await query(`
    ALTER TABLE users
    MODIFY role ENUM('admin','team','content_manager','reviewer','publisher','viewer')
    NOT NULL DEFAULT 'viewer'
  `);

  const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [TEAM_EMAIL]);
  const passwordHash = await hashPassword(TEAM_PASSWORD);
  if (!existing.length) {
    await query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'team')`,
      [TEAM_EMAIL, passwordHash, "APEX Team"]
    );
    console.log(`Created team user: ${TEAM_EMAIL} / ${TEAM_PASSWORD}`);
  } else {
    await query(
      `UPDATE users SET role = 'team', full_name = 'APEX Team', password_hash = ? WHERE email = ?`,
      [passwordHash, TEAM_EMAIL]
    );
    console.log(`Team user ready: ${TEAM_EMAIL} / ${TEAM_PASSWORD}`);
  }

  const users = await query("SELECT email, role FROM users ORDER BY id");
  console.log("Users:", users);
}

seedUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
  });
