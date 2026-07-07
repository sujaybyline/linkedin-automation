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

async function migrate() {
  if (!(await tableExists("app_settings"))) {
    await query(`
      CREATE TABLE app_settings (
        setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_by INT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("Created app_settings table");
  } else {
    console.log("app_settings table already exists");
  }

  const count = await query("SELECT COUNT(*) AS c FROM app_settings");
  console.log("App settings rows:", count[0]?.c ?? 0);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
