-- Remove legacy Ollama hosted API key from app_settings (use OLLAMA_API_KEY in .env only)
DELETE FROM app_settings WHERE setting_key = 'ollama_api_key';
