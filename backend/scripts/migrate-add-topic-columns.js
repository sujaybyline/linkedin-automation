#!/usr/bin/env node
/**
 * Migration script to add topic and post_type columns to posts table
 * Fixes: 502 error on api/ai/batch-text-posts endpoint
 */

const { query } = require("../db");

async function migrate() {
  console.log("[migrate] Adding topic and post_type columns to posts table...");

  try {
    // Check if columns already exist
    const columns = await query("DESCRIBE posts");
    const hasTopicColumn = columns.some((r) => r.Field === "topic");
    const hasPostTypeColumn = columns.some((r) => r.Field === "post_type");

    // Add topic column if it doesn't exist
    if (!hasTopicColumn) {
      console.log("[migrate] Adding topic column...");
      await query(
        "ALTER TABLE posts ADD COLUMN topic VARCHAR(255) DEFAULT NULL AFTER campaign"
      );
      console.log("[migrate] ✓ Added topic column");
    } else {
      console.log("[migrate] ℹ topic column already exists");
    }

    // Add post_type column if it doesn't exist
    if (!hasPostTypeColumn) {
      console.log("[migrate] Adding post_type column...");
      await query(
        "ALTER TABLE posts ADD COLUMN post_type ENUM('text_only', 'image', 'carousel') DEFAULT NULL AFTER topic"
      );
      console.log("[migrate] ✓ Added post_type column");
    } else {
      console.log("[migrate] ℹ post_type column already exists");
    }

    // Backfill topic from visual_cards
    console.log("[migrate] Backfilling topic data from visual_cards...");
    const topicResult = await query(
      `UPDATE posts p
       INNER JOIN visual_cards vc ON vc.id = p.visual_card_id
       SET p.topic = vc.topic
       WHERE p.topic IS NULL AND vc.topic IS NOT NULL`
    );
    console.log(`[migrate] ✓ Updated ${topicResult.affectedRows} rows with topic data`);

    // Backfill post_type
    console.log("[migrate] Backfilling post_type data...");
    const typeResult = await query(
      `UPDATE posts p
       LEFT JOIN visual_cards vc ON vc.id = p.visual_card_id
       SET p.post_type = CASE
           WHEN vc.storage_path = '_text_' THEN 'text_only'
           WHEN p.media_type = 'carousel' THEN 'carousel'
           ELSE 'image'
       END
       WHERE p.post_type IS NULL`
    );
    console.log(`[migrate] ✓ Updated ${typeResult.affectedRows} rows with post_type data`);

    console.log("[migrate] ✓ Migration completed successfully");
    console.log("[migrate] The posts table now has topic and post_type columns");

    // Verify the changes
    const verifyColumns = await query("DESCRIBE posts");
    const verifyTopic = verifyColumns.some((r) => r.Field === "topic");
    const verifyPostType = verifyColumns.some((r) => r.Field === "post_type");

    if (verifyTopic && verifyPostType) {
      console.log("[migrate] ✓ Verified: Both columns exist and are populated");
    } else {
      console.warn("[migrate] ⚠ Warning: Columns may not have been added correctly");
      if (!verifyTopic) console.warn("[migrate] - Missing: topic column");
      if (!verifyPostType) console.warn("[migrate] - Missing: post_type column");
    }

    process.exit(0);
  } catch (err) {
    console.error("[migrate] ✗ Migration failed:", err.message);
    console.error("[migrate] Stack:", err.stack);
    process.exit(1);
  }
}

migrate();
