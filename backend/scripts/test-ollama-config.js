#!/usr/bin/env node
/**
 * Test script to verify Ollama configuration and availability
 */

const { getAiConfig, getAiConfigForAdmin } = require("../lib/aiConfig");
const { listAvailableProviders } = require("../lib/aiProvider");

async function main() {
  console.log("=".repeat(60));
  console.log("OLLAMA CONFIGURATION TEST");
  console.log("=".repeat(60));
  console.log();

  try {
    console.log("1. Loading AI configuration...");
    const config = await getAiConfig();
    console.log("   ✓ Configuration loaded");
    console.log();

    console.log("2. AI Settings:");
    console.log(`   - AI Enabled: ${config.aiEnabled}`);
    console.log(`   - Default Provider: ${config.aiProvider}`);
    console.log(`   - Gemini API Key: ${config.geminiApiKey ? "Set (***)" : "Not set"}`);
    console.log(`   - OpenAI API Key: ${config.openaiApiKey ? "Set (***)" : "Not set"}`);
    console.log(`   - Ollama Base URL: ${config.ollamaBaseUrl || "Not set"}`);
    console.log(`   - Ollama Model: ${config.ollamaModel}`);
    console.log();

    console.log("3. Admin configuration view:");
    const adminConfig = await getAiConfigForAdmin();
    console.log(`   - Ollama Base URL Set: ${adminConfig.ollama_base_url_set}`);
    console.log(`   - Ollama from DB: ${adminConfig.ollama_base_url_from_db}`);
    console.log(`   - Active Provider Count: ${adminConfig.active_provider_count}`);
    console.log();

    console.log("4. Available providers from API:");
    const providersData = await listAvailableProviders();
    console.log(`   - Total providers: ${providersData.providers.length}`);
    console.log(`   - Default provider: ${providersData.defaultProvider}`);
    console.log("   - Provider list:");
    for (const provider of providersData.providers) {
      console.log(`     • ${provider.id} (${provider.label}) - type: ${provider.type}`);
    }
    console.log();

    const hasOllama = providersData.providers.some((p) => p.id === "ollama");
    if (hasOllama) {
      console.log("✅ SUCCESS: Ollama is configured and available!");
    } else {
      console.log("❌ ISSUE: Ollama is NOT in the available providers list");
      console.log();
      console.log("Troubleshooting:");
      if (!config.ollamaBaseUrl) {
        console.log("   → Ollama Base URL is not configured");
        console.log("   → Set it in the AI Config page or in .env file");
        console.log("   → Example: OLLAMA_BASE_URL=http://127.0.0.1:11434");
      }
    }
    console.log();
    console.log("=".repeat(60));
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
