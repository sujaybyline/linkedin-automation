const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

function resolvedUploadDir() {
  const raw = (process.env.UPLOAD_DIR || "./uploads/cards").trim();
  if (path.isAbsolute(raw)) return path.normalize(raw);
  return path.resolve(__dirname, raw);
}

const webOrigin =
  process.env.CLIENT_URL || process.env.WEB_ORIGIN || "http://localhost:5173";

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  const allowed = webOrigin.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) return callback(null, true);
  // Vite may use 5173, 5174, etc.
  if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin)) {
    return callback(null, true);
  }
  callback(new Error("Not allowed by CORS"));
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 4010),
  corsOrigin,
  getDbConfig() {
    return {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME || "apex_linkedin_ops",
      waitForConnections: true,
      connectionLimit: 10,
    };
  },
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev-secret-change-me",
  JWT_ACCESS_TTL_SECONDS: Number(process.env.JWT_ACCESS_TTL_SECONDS || 86400),
  CORS_ORIGINS: webOrigin.split(",").map((s) => s.trim()).filter(Boolean),
  CLIENT_URL: webOrigin.split(",")[0].trim(),
  UPLOAD_DIR: resolvedUploadDir(),
  COOKIE_NAME: "apex_access_token",
  CRON_SECRET: process.env.CRON_SECRET || "",
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || "",
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || "",
  LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || "",
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || process.env.AI_API_KEY || "").trim(),
  GEMINI_MODEL: (process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").trim(),
  OPENAI_API_KEY: (process.env.OPENAI_API_KEY || "").trim(),
  OPENAI_MODEL: (process.env.OPENAI_MODEL || "gpt-4o-mini").trim(),
  OLLAMA_BASE_URL: (process.env.OLLAMA_BASE_URL || "").trim(),
  OLLAMA_API_KEY: (process.env.OLLAMA_API_KEY || "").trim(),
  OLLAMA_MODEL: (process.env.OLLAMA_MODEL || "llama3.1:8b").trim(),
  AI_PROVIDER: (process.env.AI_PROVIDER || "auto").trim().toLowerCase(),
};
