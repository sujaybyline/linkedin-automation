const PROVIDER_CATALOG = {
  gemini: {
    label: "Google Gemini",
    description: "Google AI Studio — fast and cost-effective",
    models: [
      { value: "gemini-2.5-flash-lite", label: "2.5 Flash Lite · Fast" },
      { value: "gemini-2.0-flash", label: "2.0 Flash" },
      { value: "gemini-1.5-flash", label: "1.5 Flash" },
    ],
    defaultModel: "gemini-2.5-flash-lite",
  },
  openai: {
    label: "OpenAI",
    description: "GPT models via platform.openai.com",
    models: [
      { value: "gpt-4o-mini", label: "GPT-4o mini · Efficient" },
      { value: "gpt-4o", label: "GPT-4o · Higher quality" },
    ],
    defaultModel: "gpt-4o-mini",
  },
  ollama: {
    label: "Ollama",
    description: "Self-hosted local models via your Ollama server",
    models: [
      { value: "qwen3:8b", label: "Qwen 3 8B" },
      { value: "llama3.1:8b", label: "Llama 3.1 8B" },
      { value: "llama3.2:3b", label: "Llama 3.2 3B" },
      { value: "qwen2.5:7b", label: "Qwen 2.5 7B" },
    ],
    defaultModel: "qwen3:8b",
  },
  anthropic: {
    label: "Anthropic Claude",
    description: "Claude models via console.anthropic.com",
    models: [
      { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku · Fast" },
      { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    ],
    defaultModel: "claude-3-5-haiku-latest",
  },
  groq: {
    label: "Groq",
    description: "Ultra-fast inference — console.groq.com",
    models: [
      { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    ],
    defaultModel: "llama-3.3-70b-versatile",
  },
};

const BUILTIN_TYPES = ["gemini", "openai", "ollama"];

function isValidProviderType(type) {
  return Boolean(PROVIDER_CATALOG[type]);
}

function defaultModelForType(type) {
  return PROVIDER_CATALOG[type]?.defaultModel || "";
}

module.exports = {
  PROVIDER_CATALOG,
  BUILTIN_TYPES,
  isValidProviderType,
  defaultModelForType,
};
