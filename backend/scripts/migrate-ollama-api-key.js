#!/usr/bin/env node
const db = require("../db");

async function migrate() {
  try {
    console.log("Starting Ollama API Key migration...");

    // Add ollama_api_key setting
    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      ['ollama_api_key', 'gw_74ccb4c29c17c020502ee48f535e72e9d7fa737973f975f0f9']
    );
    console.log("✓ Added/Updated ollama_api_key");

    // Update ollama_base_url to hosted version
    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      ['ollama_base_url', 'https://ai.aimlworld-portal.cloud']
    );
    console.log("✓ Updated ollama_base_url");

    // Update ollama_model to match hosted configuration
    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      ['ollama_model', 'qwen2.5:14b-instruct']
    );
    console.log("✓ Updated ollama_model");

    console.log("\n✅ Ollama API Key migration completed successfully!");
    console.log("\nConfigured settings:");
    console.log("  - Ollama Base URL: https://ai.aimlworld-portal.cloud");
    console.log("  - Ollama Model: qwen2.5:14b-instruct");
    console.log("  - Ollama API Key: Set (masked)");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

migrate();
