const { query } = require("../db");

const SETTING_KEYS = [
  "ai_enabled",
  "gemini_api_key",
  "openai_api_key",
  "gemini_model",
  "openai_model",
  "ollama_base_url",
  "ollama_model",
  "ai_provider",
  "ai_extra_providers",
];

async function getSettingsMap() {
  const placeholders = SETTING_KEYS.map(() => "?").join(", ");
  const rows = await query(
    `SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (${placeholders})`,
    SETTING_KEYS
  );
  const map = {};
  for (const row of rows) {
    map[row.setting_key] = row.setting_value ?? "";
  }
  return map;
}

async function upsertSettings(updates, updatedBy) {
  for (const [key, value] of Object.entries(updates)) {
    if (!SETTING_KEYS.includes(key)) continue;
    await query(
      `INSERT INTO app_settings (setting_key, setting_value, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         setting_value = VALUES(setting_value),
         updated_by = VALUES(updated_by)`,
      [key, String(value ?? ""), updatedBy ?? null]
    );
  }
}

async function deleteSetting(key) {
  if (!SETTING_KEYS.includes(key)) return;
  await query("DELETE FROM app_settings WHERE setting_key = ?", [key]);
}

module.exports = { SETTING_KEYS, getSettingsMap, upsertSettings, deleteSetting };
