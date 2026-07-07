const mysql = require("mysql2/promise");
const env = require("./env");

const pool = mysql.createPool(env.getDbConfig());

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    conn.release();
    return true;
  } catch (err) {
    console.error("[db] Connection failed:", err.code || err.message);
    return false;
  }
}

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { pool, testConnection, query };
