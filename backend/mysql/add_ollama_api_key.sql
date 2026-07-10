-- Add Ollama API Key configuration
-- This allows hosted Ollama instances to use Bearer token authentication

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('ollama_api_key', 'gw_74ccb4c29c17c020502ee48f535e72e9d7fa737973f975f0f9')
ON DUPLICATE KEY UPDATE 
  setting_value = VALUES(setting_value);

-- Also update the Ollama base URL to the hosted version
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('ollama_base_url', 'https://ai.aimlworld-portal.cloud')
ON DUPLICATE KEY UPDATE 
  setting_value = VALUES(setting_value);

-- Update the Ollama model to match the hosted configuration
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('ollama_model', 'qwen2.5:14b-instruct')
ON DUPLICATE KEY UPDATE 
  setting_value = VALUES(setting_value);
