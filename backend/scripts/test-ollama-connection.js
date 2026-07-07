#!/usr/bin/env node
/**
 * Test Ollama connection and list available models
 */

async function testOllamaConnection() {
  const baseUrl = "http://127.0.0.1:11434";
  
  console.log("=".repeat(60));
  console.log("OLLAMA CONNECTION TEST");
  console.log("=".repeat(60));
  console.log();
  console.log(`Testing connection to: ${baseUrl}`);
  console.log();

  try {
    // Test 1: Check if Ollama is running
    console.log("1. Checking if Ollama is running...");
    const healthRes = await fetch(baseUrl);
    if (healthRes.ok) {
      console.log("   ✓ Ollama server is running");
    }
    console.log();

    // Test 2: List available models
    console.log("2. Listing available models...");
    const tagsRes = await fetch(`${baseUrl}/api/tags`);
    if (!tagsRes.ok) {
      throw new Error(`Failed to list models: ${tagsRes.status}`);
    }
    
    const tagsData = await tagsRes.json();
    const models = tagsData.models || [];
    
    if (models.length === 0) {
      console.log("   ⚠ No models found on Ollama server");
      console.log();
      console.log("   To download a model, run on the Ollama server:");
      console.log("   → ollama pull llama3.1:8b");
      console.log("   → ollama pull llama3.2:3b");
      console.log("   → ollama pull qwen2.5:7b");
    } else {
      console.log(`   ✓ Found ${models.length} model(s):`);
      models.forEach((model) => {
        console.log(`     • ${model.name} (size: ${(model.size / 1024 / 1024 / 1024).toFixed(2)} GB)`);
      });
    }
    console.log();

    // Test 3: Try a simple chat request with the configured model
    const testModel = "llama3.1:8b";
    console.log(`3. Testing chat request with model: ${testModel}...`);
    
    const chatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: testModel,
        stream: false,
        messages: [{ role: "user", content: "Say hello in 3 words" }],
      }),
    });

    if (!chatRes.ok) {
      const errorText = await chatRes.text();
      let errorDetail = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error || errorText;
      } catch {}
      
      if (chatRes.status === 404) {
        console.log(`   ✗ Model '${testModel}' not found on server`);
        console.log();
        console.log("   SOLUTION: Download the model on the Ollama server:");
        console.log(`   → ollama pull ${testModel}`);
        console.log();
        console.log("   Alternative: Use a different model that's already installed");
        console.log("   Update OLLAMA_MODEL in backend/.env to match an installed model");
      } else {
        console.log(`   ✗ Chat request failed: ${errorDetail}`);
      }
    } else {
      const chatData = await chatRes.json();
      const response = chatData.message?.content || chatData.response || "";
      console.log(`   ✓ Chat successful!`);
      console.log(`   Response: "${response}"`);
    }
    
    console.log();
    console.log("=".repeat(60));
    console.log("TEST COMPLETE");
    console.log("=".repeat(60));

  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error();
    console.error("Troubleshooting:");
    console.error("1. Verify Ollama is running: visit http://127.0.0.1:11434 in browser");
    console.error("2. Check if port 11434 is accessible");
    console.error("3. Ensure no firewall is blocking the connection");
    process.exit(1);
  }
}

testOllamaConnection();
