require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { query } = require("../db");

async function columnExists(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function tableExists(table) {
  const rows = await query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function migrate() {
  if (!(await tableExists("linkedin_accounts"))) {
    await query(`
      CREATE TABLE linkedin_accounts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        label VARCHAR(128) NOT NULL DEFAULT '',
        member_name VARCHAR(255) NOT NULL DEFAULT '',
        author_urn VARCHAR(255) NOT NULL DEFAULT '',
        connected TINYINT(1) NOT NULL DEFAULT 0,
        access_token_encrypted TEXT NULL,
        refresh_token_encrypted TEXT NULL,
        token_expires_at TIMESTAMP NULL,
        scopes VARCHAR(255) NOT NULL DEFAULT 'openid profile email w_member_social',
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("Created linkedin_accounts table");
  }

  const legacy = await query("SELECT * FROM linkedin_integration WHERE id = 1 LIMIT 1");
  const existing = await query("SELECT COUNT(*) AS c FROM linkedin_accounts");
  if (legacy[0] && Number(existing[0]?.c) === 0) {
    const row = legacy[0];
    await query(
      `INSERT INTO linkedin_accounts (label, member_name, author_urn, connected, scopes, is_default)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        row.member_name || "Primary account",
        row.member_name || "",
        row.author_urn || "",
        row.connected ? 1 : 0,
        row.scopes || "openid profile email w_member_social",
      ]
    );
    console.log("Migrated linkedin_integration → linkedin_accounts");
  }

  if (!(await columnExists("schedules", "linkedin_account_id"))) {
    await query("ALTER TABLE schedules ADD COLUMN linkedin_account_id INT UNSIGNED NULL AFTER sort_order");
    console.log("Added schedules.linkedin_account_id");
  }

  const accounts = await query("SELECT id, label, member_name, connected, is_default FROM linkedin_accounts");
  console.log("LinkedIn accounts:", accounts);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
