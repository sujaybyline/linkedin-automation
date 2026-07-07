-- Migration: Add Ollama Hosted Configuration fields to app_settings
-- Description: Adds columns for Ollama Hosted specific configurations including embedding models, RAG settings, and GPU configuration

-- Add Ollama Hosted model configurations
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ollama_hosted_model VARCHAR(255) DEFAULT NULL COMMENT 'Default AI model for Ollama Hosted (e.g., qwen2.5:14b-instruct)';

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ollama_hosted_embedding_model VARCHAR(255) DEFAULT NULL COMMENT 'Embedding model for Ollama Hosted (e.g., nomic-embed-text)';

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ollama_hosted_embedding_dim VARCHAR(20) DEFAULT NULL COMMENT 'Embedding dimension size (e.g., 768)';

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ollama_hosted_question_model VARCHAR(255) DEFAULT NULL COMMENT 'Question generation model for Ollama Hosted';

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ollama_hosted_analysis_model VARCHAR(255) DEFAULT NULL COMMENT 'Analysis AI model for Ollama Hosted';

-- Add Ollama Hosted performance configurations
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ollama_hosted_num_gpu VARCHAR(10) DEFAULT NULL COMMENT 'Number of GPUs to use (e.g., 0 for CPU only)';

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ollama_hosted_num_ctx VARCHAR(20) DEFAULT NULL COMMENT 'Context window size (e.g., 8192)';

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ollama_hosted_chat_timeout_ms VARCHAR(20) DEFAULT NULL COMMENT 'Chat timeout in milliseconds (e.g., 900000 for 15 minutes)';

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ollama_hosted_rag_top_k VARCHAR(10) DEFAULT NULL COMMENT 'RAG top K results to retrieve (e.g., 5)';

-- Verify the columns were added
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_DEFAULT,
  IS_NULLABLE,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'app_settings'
  AND COLUMN_NAME LIKE 'ollama_hosted_%'
ORDER BY COLUMN_NAME;
