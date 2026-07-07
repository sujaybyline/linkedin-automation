#!/usr/bin/env node
/**
 * Test Ollama with qwen3:8b model
 */

async function testQwenModel() {
  const baseUrl = "http://127.0.0.1:11434";
  const model = "qwen3:8b";
  
  console.log("=".repeat(60));
  console.log("OLLAMA QWEN3:8B TEST");
  console.log("=".repeat(60));
  console.log();

  try {
    console.log(`Testing model: ${model}`);
    console.log("Prompt: Write a LinkedIn post about AI in education (max 100 words)");
    console.log();
    console.log("Sending request...");
    
    const startTime = Date.now();
    
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 200,
        },
        messages: [
          {
            role: "user",
            content: "Write a short LinkedIn post about AI in education. Max 100 words. Return valid JSON only with this structure: {\"finalPostText\": \"your post here\", \"suggestedHashtags\": \"#AI #Education\", \"suggestedCta\": \"Learn more\"}",
          },
        ],
      }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`✗ Request failed (${res.status}): ${errorText}`);
      process.exit(1);
    }

    const data = await res.json();
    const response = data.message?.content || data.response || "";
    
    console.log(`✓ Response received in ${elapsed}s`);
    console.log();
    console.log("─".repeat(60));
    console.log(response);
    console.log("─".repeat(60));
    console.log();
    console.log("✅ SUCCESS! Ollama is working with qwen3:8b model");
    console.log();
    console.log("Your app is now configured to use this model.");
    console.log("Restart your backend server to apply the changes.");
    console.log();
    console.log("=".repeat(60));

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

testQwenModel();
