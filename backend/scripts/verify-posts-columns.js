#!/usr/bin/env node
/**
 * Verify posts table has topic and post_type columns
 */

const { query } = require("../db");

async function verify() {
  try {
    const columns = await query("DESCRIBE posts");
    
    console.log("\n=== Posts Table Structure ===\n");
    columns.forEach((col) => {
      const nullable = col.Null === "YES" ? "NULL" : "NOT NULL";
      const defaultVal = col.Default !== null ? `DEFAULT ${col.Default}` : "";
      console.log(`${col.Field.padEnd(25)} ${col.Type.padEnd(30)} ${nullable.padEnd(10)} ${defaultVal}`);
    });
    
    const hasTopic = columns.some((r) => r.Field === "topic");
    const hasPostType = columns.some((r) => r.Field === "post_type");
    
    console.log("\n=== Migration Status ===\n");
    console.log(`topic column: ${hasTopic ? "✓ EXISTS" : "✗ MISSING"}`);
    console.log(`post_type column: ${hasPostType ? "✓ EXISTS" : "✗ MISSING"}`);
    
    if (hasTopic && hasPostType) {
      console.log("\n✓ Database is ready for batch text posts!\n");
    } else {
      console.log("\n✗ Run: node scripts/migrate-add-topic-columns.js\n");
    }
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

verify();
