const mysql = require("mysql2/promise");

async function testHost(host) {
  try {
    const conn = await mysql.createConnection({
      host,
      port: 3306,
      user: "root",
      password: "",
      connectTimeout: 5000,
    });
    console.log(`OK ${host}`);
    const [dbs] = await conn.query("SHOW DATABASES LIKE 'apex_linkedin_ops'");
    console.log("  apex_linkedin_ops:", dbs.length ? "exists" : "MISSING");
    if (dbs.length) {
      await conn.query("USE apex_linkedin_ops");
      const [users] = await conn.query("SELECT email, role FROM users LIMIT 5");
      console.log("  users:", users.length ? users : "none");
    }
    await conn.end();
    return true;
  } catch (err) {
    console.log(`FAIL ${host}:`, err.code, err.message);
    return false;
  }
}

(async () => {
  await testHost("localhost");
  await testHost("127.0.0.1");
})();
