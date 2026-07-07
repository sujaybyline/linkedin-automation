CREATE TABLE IF NOT EXISTS company_profiles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  website_url VARCHAR(512) NOT NULL DEFAULT '',
  intel_json JSON NOT NULL,
  sources_json JSON NULL,
  ai_source VARCHAR(32) NOT NULL DEFAULT '',
  ai_model VARCHAR(64) NOT NULL DEFAULT '',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_profiles_slug (slug),
  KEY idx_company_profiles_name (company_name)
);

ALTER TABLE posts ADD COLUMN company_profile_id INT UNSIGNED NULL AFTER campaign;
