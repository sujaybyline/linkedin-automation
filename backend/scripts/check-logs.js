require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { query } = require("../db");

(async () => {
  try {
    const tables = await query("SHOW TABLES LIKE 'publishing_logs'");
    console.log("publishing_logs exists:", tables.length > 0);
    if (tables.length) {
      const cols = await query("DESCRIBE publishing_logs");
      console.log("columns:", cols.map((c) => c.Field).join(", "));
      const rows = await query("SELECT COUNT(*) AS c FROM publishing_logs");
      console.log("row count:", rows[0]?.c);
      const audit = await query("SELECT COUNT(*) AS c FROM audit_logs");
      console.log("audit count:", audit[0]?.c);
    }
    const users = await query("SELECT email, role FROM users");
    console.log("users:", users);
  } catch (e) {
    console.error("ERR:", e.message);
  }
  process.exit(0);
})();
