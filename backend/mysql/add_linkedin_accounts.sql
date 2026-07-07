-- Run once on apex_linkedin_ops (phpMyAdmin or mysql CLI)

USE apex_linkedin_ops;

CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(128) NOT NULL DEFAULT '',
  member_name VARCHAR(255) NOT NULL DEFAULT '',
  author_urn VARCHAR(255) NOT NULL DEFAULT '',
  connected TINYINT(1) NOT NULL DEFAULT 0,
  access_token_encrypted TEXT NULL,
  refresh_token_encrypted TEXT NULL,
  token_expires_at TIMESTAMP NULL,
  scopes VARCHAR(255) NOT NULL DEFAULT 'openid profile email w_member_social',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Migrate singleton row if present
INSERT INTO linkedin_accounts (label, member_name, author_urn, connected, scopes, is_default)
SELECT
  COALESCE(NULLIF(member_name, ''), 'Primary account'),
  COALESCE(member_name, ''),
  COALESCE(author_urn, ''),
  connected,
  scopes,
  1
FROM linkedin_integration
WHERE id = 1
  AND NOT EXISTS (SELECT 1 FROM linkedin_accounts LIMIT 1);

-- Add account column to schedules (ignore error if already exists)
ALTER TABLE schedules
  ADD COLUMN linkedin_account_id INT UNSIGNED NULL AFTER sort_order;

ALTER TABLE schedules
  ADD CONSTRAINT fk_schedules_linkedin_account
  FOREIGN KEY (linkedin_account_id) REFERENCES linkedin_accounts(id) ON DELETE SET NULL;
