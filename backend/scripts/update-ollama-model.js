#!/usr/bin/env node
/**
 * Update Ollama model in database to qwen3:8b
 */

const { query } = require("../db");
const { invalidateAiConfigCache } = require("../lib/aiConfig");

async function updateOllamaModel() {
  console.log("=".repeat(60));
  console.log("UPDATE OLLAMA MODEL IN DATABASE");
  console.log("=".repeat(60));
  console.log();

  try {
    // Check current value
    const current = await query(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'ollama_model'"
    );
    
    if (current.length > 0) {
      console.log(`Current model in DB: ${current[0].setting_value}`);
    } else {
      console.log("No Ollama model configured in DB (using .env default)");
    }
    
    // Update to qwen3:8b
    await query(
      `INSERT INTO app_settings (setting_key, setting_value, updated_by)
       VALUES ('ollama_model', 'qwen3:8b', NULL)
       ON DUPLICATE KEY UPDATE setting_value = 'qwen3:8b'`
    );
    
    console.log("✓ Updated Ollama model to: qwen3:8b");
    
    // Invalidate cache
    invalidateAiConfigCache();
    console.log("✓ Config cache invalidated");
    
    console.log();
    console.log("✅ SUCCESS! Database updated");
    console.log();
    console.log("Next steps:");
    console.log("1. Restart your backend server");
    console.log("2. Test Ollama in your application");
    console.log();
    console.log("=".repeat(60));

  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

updateOllamaModel();
