require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { query } = require("../db");

async function tableExists(table) {
  const rows = await query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function columnExists(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function migrate() {
  if (!(await tableExists("company_profiles"))) {
    await query(`
      CREATE TABLE company_profiles (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        website_url VARCHAR(512) NOT NULL DEFAULT '',
        intel_json JSON NOT NULL,
        sources_json JSON NULL,
        ai_source VARCHAR(32) NOT NULL DEFAULT '',
        ai_model VARCHAR(64) NOT NULL DEFAULT '',
        created_by INT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_company_profiles_slug (slug),
        KEY idx_company_profiles_name (company_name)
      )
    `);
    console.log("Created company_profiles table");
  }

  if (!(await columnExists("posts", "company_profile_id"))) {
    await query("ALTER TABLE posts ADD COLUMN company_profile_id INT UNSIGNED NULL AFTER campaign");
    console.log("Added posts.company_profile_id");
  }

  const count = await query("SELECT COUNT(*) AS c FROM company_profiles");
  console.log("Company profiles:", count[0]?.c ?? 0);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
