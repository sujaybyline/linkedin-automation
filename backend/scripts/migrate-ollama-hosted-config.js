#!/usr/bin/env node
/**
 * Migration: Add Ollama Hosted Configuration
 * Adds database columns for Ollama Hosted specific settings
 */

const db = require("../db");

const migrations = [
  {
    name: "ollama_hosted_model",
    sql: "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ollama_hosted_model VARCHAR(255) DEFAULT NULL",
  },
  {
    name: "ollama_hosted_embedding_model",
    sql: "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ollama_hosted_embedding_model VARCHAR(255) DEFAULT NULL",
  },
  {
    name: "ollama_hosted_embedding_dim",
    sql: "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ollama_hosted_embedding_dim VARCHAR(20) DEFAULT NULL",
  },
  {
    name: "ollama_hosted_question_model",
    sql: "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ollama_hosted_question_model VARCHAR(255) DEFAULT NULL",
  },
  {
    name: "ollama_hosted_analysis_model",
    sql: "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ollama_hosted_analysis_model VARCHAR(255) DEFAULT NULL",
  },
  {
    name: "ollama_hosted_num_gpu",
    sql: "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ollama_hosted_num_gpu VARCHAR(10) DEFAULT NULL",
  },
  {
    name: "ollama_hosted_num_ctx",
    sql: "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ollama_hosted_num_ctx VARCHAR(20) DEFAULT NULL",
  },
  {
    name: "ollama_hosted_chat_timeout_ms",
    sql: "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ollama_hosted_chat_timeout_ms VARCHAR(20) DEFAULT NULL",
  },
  {
    name: "ollama_hosted_rag_top_k",
    sql: "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ollama_hosted_rag_top_k VARCHAR(10) DEFAULT NULL",
  },
];

async function migrate() {
  console.log("🚀 Starting Ollama Hosted configuration migration...\n");

  try {
    for (const migration of migrations) {
      console.log(`Adding column: ${migration.name}...`);
      await db.query(migration.sql);
      console.log(`✅ ${migration.name} added successfully`);
    }

    console.log("\n✨ Migration completed successfully!");
    console.log("\n📋 Verifying columns...");

    const [rows] = await db.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        COLUMN_DEFAULT,
        IS_NULLABLE,
        COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'app_settings'
        AND COLUMN_NAME LIKE 'ollama_hosted_%'
      ORDER BY COLUMN_NAME
    `);

    console.log("\n✅ Ollama Hosted configuration columns:");
    rows.forEach((row) => {
      console.log(`  - ${row.COLUMN_NAME} (${row.DATA_TYPE})`);
    });

    console.log("\n🎉 All done! You can now configure Ollama Hosted settings in Admin → AI Config");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrate();
