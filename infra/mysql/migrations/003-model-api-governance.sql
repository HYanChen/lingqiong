-- Model API usage governance and traceability.
-- This migration is idempotent at the application layer: database.ts ignores
-- duplicate-column/index errors when upgrading an existing installation.

ALTER TABLE model_api_calls
  ADD COLUMN actor_id VARCHAR(191) AFTER config_id,
  ADD COLUMN actor_account VARCHAR(255) AFTER actor_id,
  ADD COLUMN actor_role VARCHAR(40) AFTER actor_account,
  ADD COLUMN project_id VARCHAR(191) AFTER actor_role,
  ADD COLUMN project_name VARCHAR(255) AFTER project_id,
  ADD COLUMN prompt_truncated TINYINT(1) NOT NULL DEFAULT 0 AFTER prompt,
  ADD COLUMN response_truncated TINYINT(1) NOT NULL DEFAULT 0 AFTER response_text;

ALTER TABLE model_api_calls
  ADD INDEX idx_model_api_calls_actor_created (actor_id, created_at),
  ADD INDEX idx_model_api_calls_project_created (project_id, created_at);

CREATE TABLE IF NOT EXISTS model_api_usage_buckets (
  config_id VARCHAR(191) NOT NULL,
  actor_key VARCHAR(255) NOT NULL,
  window_type VARCHAR(20) NOT NULL,
  window_start BIGINT NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (config_id, actor_key, window_type, window_start),
  INDEX idx_model_usage_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS model_api_concurrency_leases (
  id VARCHAR(191) PRIMARY KEY,
  config_id VARCHAR(191) NOT NULL,
  actor_key VARCHAR(255) NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  INDEX idx_model_leases_actor (config_id, actor_key, expires_at),
  INDEX idx_model_leases_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
