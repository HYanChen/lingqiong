CREATE TABLE IF NOT EXISTS api_account_links (
  id VARCHAR(191) PRIMARY KEY,
  principal_type VARCHAR(40) NOT NULL,
  principal_id VARCHAR(191) NOT NULL,
  oidc_subject VARCHAR(255) NOT NULL,
  new_api_user_id BIGINT,
  internal_token_id BIGINT,
  link_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  last_verified_at VARCHAR(40),
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  UNIQUE KEY uq_api_account_principal (principal_type, principal_id),
  UNIQUE KEY uq_api_account_subject (oidc_subject),
  UNIQUE KEY uq_api_account_user (new_api_user_id),
  UNIQUE KEY uq_api_account_token (internal_token_id),
  INDEX idx_api_account_status (link_status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS model_billing_audits (
  id VARCHAR(191) PRIMARY KEY,
  request_id VARCHAR(191) NOT NULL,
  principal_id VARCHAR(191) NOT NULL,
  new_api_user_id BIGINT NOT NULL,
  new_api_token_id BIGINT,
  project_id VARCHAR(191),
  generation_job_id VARCHAR(191),
  capability VARCHAR(80) NOT NULL,
  model VARCHAR(255),
  status VARCHAR(40) NOT NULL,
  quota_before BIGINT NOT NULL DEFAULT 0,
  quota_after BIGINT,
  quota_charged BIGINT,
  error_code VARCHAR(120),
  created_at VARCHAR(40) NOT NULL,
  completed_at VARCHAR(40),
  UNIQUE KEY uq_model_billing_request (request_id),
  INDEX idx_model_billing_principal_created (principal_id, created_at),
  INDEX idx_model_billing_user_created (new_api_user_id, created_at),
  INDEX idx_model_billing_project_created (project_id, created_at),
  INDEX idx_model_billing_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wechat_pay_orders (
  trade_no VARCHAR(32) PRIMARY KEY,
  principal_id VARCHAR(191) NOT NULL,
  new_api_user_id BIGINT NOT NULL,
  quota_amount BIGINT NOT NULL,
  amount_fen BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  code_url LONGTEXT,
  transaction_id VARCHAR(64),
  notify_id VARCHAR(64),
  paid_at VARCHAR(40),
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  INDEX idx_wechat_pay_principal_created (principal_id, created_at),
  INDEX idx_wechat_pay_user_created (new_api_user_id, created_at),
  INDEX idx_wechat_pay_status_updated (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
