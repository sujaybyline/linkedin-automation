#!/usr/bin/env node
/**
 * Test script to verify the batch text posts endpoint works
 */

const { query } = require("../db");

async function test() {
  console.log("[test] Checking if posts table has required columns...");

  try {
    // Check table structure
    const columns = await query("DESCRIBE posts");
    const columnNames = columns.map((c) => c.Field);

    console.log("\n[test] Posts table columns:");
    console.log(columnNames.join(", "));

    const hasTopicColumn = columnNames.includes("topic");
    const hasPostTypeColumn = columnNames.includes("post_type");

    console.log("\n[test] Column Check:");
    console.log(`  ✓ topic: ${hasTopicColumn ? "EXISTS" : "MISSING ❌"}`);
    console.log(`  ✓ post_type: ${hasPostTypeColumn ? "EXISTS" : "MISSING ❌"}`);

    if (hasTopicColumn && hasPostTypeColumn) {
      console.log("\n[test] ✅ Database schema is correct!");
      console.log("[test] The api/ai/batch-text-posts endpoint should work now.");

      // Try the query that was failing
      console.log("\n[test] Testing the query that was causing 502 error...");
      const testQuery = await query(
        `SELECT topic FROM posts 
         WHERE topic IS NOT NULL
         LIMIT 5`
      );
      console.log(`[test] ✓ Query successful! Found ${testQuery.length} posts with topics.`);

      if (testQuery.length > 0) {
        console.log("\n[test] Sample topics:");
        testQuery.forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.topic}`);
        });
      }
    } else {
      console.log("\n[test] ❌ Database schema needs migration!");
      console.log("[test] Run: node scripts/migrate-add-topic-columns.js");
    }

    process.exit(hasTopicColumn && hasPostTypeColumn ? 0 : 1);
  } catch (err) {
    console.error("\n[test] ✗ Test failed:", err.message);
    console.error("[test] This might be the error you're seeing in production:");
    console.error(`[test] "${err.message}"`);

    if (err.message.includes("Unknown column 'topic'")) {
      console.log("\n[test] 💡 Solution: Run the migration script:");
      console.log("[test]    node scripts/migrate-add-topic-columns.js");
    }

    process.exit(1);
  }
}

test();
