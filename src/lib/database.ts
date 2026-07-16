import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket
} from "mysql2/promise";

export type SqlValue = string | number | boolean | null | Date | Buffer;

type DatabaseConnection = Pool | PoolConnection;

export type Database = {
  execute: (sql: string, params?: SqlValue[]) => Promise<ResultSetHeader>;
  first: <T extends object>(
    sql: string,
    params?: SqlValue[]
  ) => Promise<T | null>;
  rows: <T extends object>(
    sql: string,
    params?: SqlValue[]
  ) => Promise<T[]>;
};

const DEFAULT_MYSQL_HOST = process.env.NODE_ENV === "production" ? "mysql" : "127.0.0.1";
const MYSQL_HOST = process.env.MYSQL_HOST || DEFAULT_MYSQL_HOST;
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_USER = process.env.MYSQL_USER || "zhanji";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "zhanji-local-password";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "zhanji_universe";

export const DATABASE_PATH = `mysql://${MYSQL_USER}:****@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`;

let pool: Pool | null = null;
let schemaPromise: Promise<void> | null = null;

function assertDatabaseRuntimeAllowed() {
  if (process.env.PLATFORM_RUNTIME_ROLE === "web") {
    throw new Error(
      "Database access is disabled in the web runtime. Use the platform API."
    );
  }
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS site_content (
    \`key\` VARCHAR(191) PRIMARY KEY,
    json LONGTEXT NOT NULL,
    updated_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS invite_codes (
    code VARCHAR(191) PRIMARY KEY,
    label VARCHAR(255),
    active TINYINT(1) NOT NULL DEFAULT 1,
    used_count INT NOT NULL DEFAULT 0,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS front_users (
    id VARCHAR(191) PRIMARY KEY,
    username VARCHAR(191),
    account VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    profile LONGTEXT,
    invite_code VARCHAR(191),
    source VARCHAR(40) NOT NULL,
    password_hash VARCHAR(255),
    password_salt VARCHAR(255),
    active TINYINT(1) NOT NULL DEFAULT 1,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until VARCHAR(40),
    last_login_at VARCHAR(40),
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    UNIQUE KEY uq_front_users_username (username)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS front_user_identities (
    id VARCHAR(191) PRIMARY KEY,
    provider VARCHAR(40) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    user_id VARCHAR(191) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    UNIQUE KEY uq_front_identity_provider_subject (provider, provider_subject),
    INDEX idx_front_identity_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS login_settings (
    \`key\` VARCHAR(191) PRIMARY KEY,
    json LONGTEXT NOT NULL,
    updated_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS wechat_login_tickets (
    id VARCHAR(191) PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL,
    scanned_account VARCHAR(255),
    scanned_contact VARCHAR(255),
    expires_at VARCHAR(40) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_wechat_login_code (code),
    INDEX idx_wechat_login_status (status),
    INDEX idx_wechat_login_expires (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(191) PRIMARY KEY,
    owner_id VARCHAR(191),
    owner_account VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(120) NOT NULL,
    aspect_ratio VARCHAR(20) NOT NULL DEFAULT '9:16',
    cover_image LONGTEXT,
    source LONGTEXT NOT NULL,
    goal LONGTEXT NOT NULL,
    style LONGTEXT NOT NULL,
    deliverables_json LONGTEXT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_projects_created_at (created_at),
    INDEX idx_projects_owner_id (owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS project_types (
    id VARCHAR(191) PRIMARY KEY,
    slug VARCHAR(191) NOT NULL UNIQUE,
    label VARCHAR(120) NOT NULL,
    category VARCHAR(120) NOT NULL,
    description LONGTEXT NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_project_types_active_sort (active, sort_order),
    INDEX idx_project_types_category (category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS project_uploads (
    id VARCHAR(191) PRIMARY KEY,
    project_id VARCHAR(191) NOT NULL,
    owner_id VARCHAR(191),
    owner_account VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(255),
    file_size BIGINT NOT NULL DEFAULT 0,
    storage_path VARCHAR(1024) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_project_uploads_project_id (project_id),
    INDEX idx_project_uploads_owner_id (owner_id),
    INDEX idx_project_uploads_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS project_canvas_states (
    project_id VARCHAR(191) PRIMARY KEY,
    owner_id VARCHAR(191),
    owner_account VARCHAR(255),
    state_json LONGTEXT NOT NULL,
    revision INT NOT NULL DEFAULT 1,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_project_canvas_owner_id (owner_id),
    INDEX idx_project_canvas_updated_at (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS episodes (
    id VARCHAR(191) PRIMARY KEY,
    project_id VARCHAR(191) NOT NULL,
    episode_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary LONGTEXT NOT NULL,
    script LONGTEXT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    sort_order INT NOT NULL DEFAULT 0,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    UNIQUE KEY uq_episodes_project_number (project_id, episode_number),
    INDEX idx_episodes_project_sort (project_id, sort_order, episode_number),
    INDEX idx_episodes_project_status (project_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS elements (
    id VARCHAR(191) PRIMARY KEY,
    project_id VARCHAR(191) NOT NULL,
    episode_id VARCHAR(191),
    kind VARCHAR(40) NOT NULL,
    name VARCHAR(255) NOT NULL,
    aliases_json LONGTEXT NOT NULL,
    prompt LONGTEXT NOT NULL,
    description LONGTEXT NOT NULL,
    notes LONGTEXT NOT NULL,
    reference_image_url VARCHAR(2048),
    voice_profile_id VARCHAR(191),
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    sort_order INT NOT NULL DEFAULT 0,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_elements_project_kind_sort (project_id, kind, sort_order),
    INDEX idx_elements_project_episode (project_id, episode_id),
    INDEX idx_elements_project_status (project_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS storyboards (
    id VARCHAR(191) PRIMARY KEY,
    project_id VARCHAR(191) NOT NULL,
    episode_id VARCHAR(191) NOT NULL,
    shot_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    prompt LONGTEXT NOT NULL,
    negative_prompt LONGTEXT NOT NULL,
    dialogue LONGTEXT NOT NULL,
    camera VARCHAR(500) NOT NULL,
    duration_ms INT NOT NULL DEFAULT 3000,
    element_ids_json LONGTEXT NOT NULL,
    reference_image_url VARCHAR(2048),
    image_url VARCHAR(2048),
    video_url VARCHAR(2048),
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    sort_order INT NOT NULL DEFAULT 0,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    UNIQUE KEY uq_storyboards_episode_shot (episode_id, shot_number),
    INDEX idx_storyboards_project_episode_sort (project_id, episode_id, sort_order, shot_number),
    INDEX idx_storyboards_project_status (project_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS voiceovers (
    id VARCHAR(191) PRIMARY KEY,
    project_id VARCHAR(191) NOT NULL,
    episode_id VARCHAR(191) NOT NULL,
    storyboard_id VARCHAR(191),
    role_element_id VARCHAR(191),
    line_text LONGTEXT NOT NULL,
    speaker_name VARCHAR(255) NOT NULL,
    voice_profile_id VARCHAR(191),
    audio_url VARCHAR(2048),
    duration_ms INT NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    sort_order INT NOT NULL DEFAULT 0,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_voiceovers_project_episode_sort (project_id, episode_id, sort_order),
    INDEX idx_voiceovers_project_storyboard (project_id, storyboard_id),
    INDEX idx_voiceovers_project_role (project_id, role_element_id),
    INDEX idx_voiceovers_project_status (project_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS compositions (
    id VARCHAR(191) PRIMARY KEY,
    project_id VARCHAR(191) NOT NULL,
    episode_id VARCHAR(191) NOT NULL,
    timeline_json LONGTEXT NOT NULL,
    settings_json LONGTEXT NOT NULL,
    output_url VARCHAR(2048),
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    revision INT NOT NULL DEFAULT 1,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    UNIQUE KEY uq_compositions_project_episode (project_id, episode_id),
    INDEX idx_compositions_project_status (project_id, status),
    INDEX idx_compositions_project_updated (project_id, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS generation_jobs (
    id VARCHAR(191) PRIMARY KEY,
    project_id VARCHAR(191) NOT NULL,
    episode_id VARCHAR(191),
    resource_type VARCHAR(40) NOT NULL,
    resource_id VARCHAR(191) NOT NULL,
    task_type VARCHAR(80) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'queued',
    input_json LONGTEXT NOT NULL,
    output_json LONGTEXT,
    error LONGTEXT,
    model_config_id VARCHAR(191),
    created_by_id VARCHAR(191),
    created_by_account VARCHAR(255),
    attempt_count INT NOT NULL DEFAULT 0,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_generation_jobs_project_created (project_id, created_at),
    INDEX idx_generation_jobs_project_episode (project_id, episode_id),
    INDEX idx_generation_jobs_project_status (project_id, status),
    INDEX idx_generation_jobs_resource (project_id, resource_type, resource_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS model_api_configs (
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(80) NOT NULL,
    base_url VARCHAR(512) NOT NULL,
    api_key LONGTEXT,
    model VARCHAR(255) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    system_prompt LONGTEXT NOT NULL,
    temperature DOUBLE NOT NULL DEFAULT 0.7,
    max_tokens INT NOT NULL DEFAULT 1200,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_model_api_enabled (enabled),
    INDEX idx_model_api_updated_at (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS model_api_calls (
    id VARCHAR(191) PRIMARY KEY,
    config_id VARCHAR(191),
    actor_id VARCHAR(191),
    actor_account VARCHAR(255),
    actor_role VARCHAR(40),
    project_id VARCHAR(191),
    project_name VARCHAR(255),
    node_title VARCHAR(255),
    status VARCHAR(40) NOT NULL,
    prompt LONGTEXT NOT NULL,
    prompt_truncated TINYINT(1) NOT NULL DEFAULT 0,
    response_text LONGTEXT,
    response_truncated TINYINT(1) NOT NULL DEFAULT 0,
    error LONGTEXT,
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_model_api_calls_created_at (created_at),
    INDEX idx_model_api_calls_config_id (config_id),
    INDEX idx_model_api_calls_actor_created (actor_id, created_at),
    INDEX idx_model_api_calls_project_created (project_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS model_api_usage_buckets (
    config_id VARCHAR(191) NOT NULL,
    actor_key VARCHAR(255) NOT NULL,
    window_type VARCHAR(20) NOT NULL,
    window_start BIGINT NOT NULL,
    request_count INT NOT NULL DEFAULT 0,
    updated_at VARCHAR(40) NOT NULL,
    PRIMARY KEY (config_id, actor_key, window_type, window_start),
    INDEX idx_model_usage_updated (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS model_api_concurrency_leases (
    id VARCHAR(191) PRIMARY KEY,
    config_id VARCHAR(191) NOT NULL,
    actor_key VARCHAR(255) NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_model_leases_actor (config_id, actor_key, expires_at),
    INDEX idx_model_leases_expires (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS api_account_links (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `DELETE FROM api_account_links
   WHERE principal_type = 'admin' OR oidc_subject LIKE 'admin:%'`,
  `CREATE TABLE IF NOT EXISTS model_billing_audits (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS wechat_pay_orders (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(191) PRIMARY KEY,
    username VARCHAR(191) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(80) NOT NULL,
    permissions_json LONGTEXT NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(255) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at VARCHAR(40),
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ,
  `CREATE TABLE IF NOT EXISTS admin_login_throttles (
    scope VARCHAR(20) NOT NULL,
    key_hash CHAR(64) NOT NULL,
    failure_count INT NOT NULL DEFAULT 0,
    window_started_at VARCHAR(40) NOT NULL,
    locked_until VARCHAR(40),
    updated_at VARCHAR(40) NOT NULL,
    PRIMARY KEY (scope, key_hash),
    INDEX idx_admin_login_throttles_locked (locked_until),
    INDEX idx_admin_login_throttles_updated (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id VARCHAR(191) PRIMARY KEY,
    admin_user_id VARCHAR(191),
    actor_username VARCHAR(191),
    action VARCHAR(191) NOT NULL,
    target_type VARCHAR(120),
    target_id VARCHAR(191),
    success TINYINT(1) NOT NULL DEFAULT 1,
    ip_address VARCHAR(191),
    user_agent VARCHAR(512),
    details_json LONGTEXT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_admin_audit_user_created (admin_user_id, created_at),
    INDEX idx_admin_audit_action_created (action, created_at),
    INDEX idx_admin_audit_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS skill_tools (
    id VARCHAR(191) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    trigger_name VARCHAR(191) NOT NULL UNIQUE,
    category VARCHAR(120) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    description LONGTEXT NOT NULL,
    source VARCHAR(40) NOT NULL,
    visibility VARCHAR(40) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    modules_json LONGTEXT NOT NULL,
    package_json LONGTEXT,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_skill_tools_active (active),
    INDEX idx_skill_tools_updated_at (updated_at),
    INDEX idx_skill_tools_category (category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS skill_runs (
    id VARCHAR(191) PRIMARY KEY,
    skill_id VARCHAR(191),
    skill_name VARCHAR(255) NOT NULL,
    module_title VARCHAR(255) NOT NULL,
    project_name VARCHAR(255),
    input_text LONGTEXT NOT NULL,
    output_text LONGTEXT,
    status VARCHAR(40) NOT NULL,
    error LONGTEXT,
    model VARCHAR(255),
    duration_ms INT NOT NULL DEFAULT 0,
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_skill_runs_created_at (created_at),
    INDEX idx_skill_runs_skill_id (skill_id),
    INDEX idx_skill_runs_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS skill_chat_sessions (
    id VARCHAR(191) PRIMARY KEY,
    skill_id VARCHAR(191) NOT NULL,
    skill_name VARCHAR(255) NOT NULL,
    module_id VARCHAR(191),
    module_title VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    owner_id VARCHAR(191),
    owner_account VARCHAR(255),
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_skill_chat_sessions_skill_id (skill_id),
    INDEX idx_skill_chat_sessions_owner_id (owner_id),
    INDEX idx_skill_chat_sessions_owner_account (owner_account),
    INDEX idx_skill_chat_sessions_updated_at (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS skill_chat_messages (
    id VARCHAR(191) PRIMARY KEY,
    session_id VARCHAR(191) NOT NULL,
    role VARCHAR(40) NOT NULL,
    content LONGTEXT NOT NULL,
    attachments_json LONGTEXT,
    files_json LONGTEXT,
    status VARCHAR(40) NOT NULL,
    error LONGTEXT,
    model VARCHAR(255),
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_skill_chat_messages_session_id (session_id),
    INDEX idx_skill_chat_messages_created_at (created_at),
    INDEX idx_skill_chat_messages_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS skill_chat_files (
    id VARCHAR(191) PRIMARY KEY,
    session_id VARCHAR(191) NOT NULL,
    message_id VARCHAR(191),
    owner_id VARCHAR(191),
    owner_account VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    relative_path VARCHAR(1024) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    source VARCHAR(40) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_skill_chat_files_session_id (session_id),
    INDEX idx_skill_chat_files_message_id (message_id),
    INDEX idx_skill_chat_files_owner_id (owner_id),
    INDEX idx_skill_chat_files_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS oidc_authorization_codes (
    id VARCHAR(191) PRIMARY KEY,
    expires_at BIGINT NOT NULL,
    used_at VARCHAR(40),
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_oidc_authorization_codes_expires_at (expires_at),
    INDEX idx_oidc_authorization_codes_used_at (used_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

const migrationStatements = [
  `ALTER TABLE front_users ADD COLUMN username VARCHAR(191) AFTER id`,
  `ALTER TABLE front_users ADD COLUMN password_hash VARCHAR(255) AFTER source`,
  `ALTER TABLE front_users ADD COLUMN password_salt VARCHAR(255) AFTER password_hash`,
  `ALTER TABLE front_users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER password_salt`,
  `ALTER TABLE front_users ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0 AFTER active`,
  `ALTER TABLE front_users ADD COLUMN locked_until VARCHAR(40) AFTER failed_attempts`,
  `ALTER TABLE front_users ADD COLUMN last_login_at VARCHAR(40) AFTER locked_until`,
  `ALTER TABLE front_users ADD COLUMN updated_at VARCHAR(40) AFTER created_at`,
  `ALTER TABLE front_users ADD UNIQUE KEY uq_front_users_username (username)`,
  `ALTER TABLE projects ADD COLUMN aspect_ratio VARCHAR(20) NOT NULL DEFAULT '9:16' AFTER type`,
  `ALTER TABLE projects ADD COLUMN cover_image LONGTEXT AFTER aspect_ratio`,
  `ALTER TABLE model_api_calls ADD COLUMN actor_id VARCHAR(191) AFTER config_id`,
  `ALTER TABLE model_api_calls ADD COLUMN actor_account VARCHAR(255) AFTER actor_id`,
  `ALTER TABLE model_api_calls ADD COLUMN actor_role VARCHAR(40) AFTER actor_account`,
  `ALTER TABLE model_api_calls ADD COLUMN project_id VARCHAR(191) AFTER actor_role`,
  `ALTER TABLE model_api_calls ADD COLUMN project_name VARCHAR(255) AFTER project_id`,
  `ALTER TABLE model_api_calls ADD COLUMN prompt_truncated TINYINT(1) NOT NULL DEFAULT 0 AFTER prompt`,
  `ALTER TABLE model_api_calls ADD COLUMN response_truncated TINYINT(1) NOT NULL DEFAULT 0 AFTER response_text`,
  `ALTER TABLE model_api_calls ADD INDEX idx_model_api_calls_actor_created (actor_id, created_at)`,
  `ALTER TABLE model_api_calls ADD INDEX idx_model_api_calls_project_created (project_id, created_at)`,
  `ALTER TABLE api_account_links ADD UNIQUE KEY uq_api_account_token (internal_token_id)`,
  `UPDATE model_api_configs
   SET api_key = NULL
   WHERE provider = 'new-api' AND api_key IS NOT NULL`
];

async function runSchemaStatements(connection: DatabaseConnection) {
  for (const statement of schemaStatements) {
    await connection.execute(statement);
  }

  for (const statement of migrationStatements) {
    try {
      await connection.execute(statement);
    } catch (error) {
      if (
        !["ER_DUP_FIELDNAME", "ER_DUP_KEYNAME"].includes(
          (error as { code?: string }).code ?? ""
        )
      ) {
        throw error;
      }
    }
  }
}

function createPool() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.PLATFORM_RUNTIME_ROLE !== "web"
  ) {
    const missing = [
      "MYSQL_HOST",
      "MYSQL_PORT",
      "MYSQL_DATABASE",
      "MYSQL_USER",
      "MYSQL_PASSWORD"
    ].filter((key) => !process.env[key]?.trim());

    if (missing.length) {
      throw new Error(
        `Production database configuration is incomplete: ${missing.join(", ")}`
      );
    }
  }

  return mysql.createPool({
    charset: "utf8mb4",
    connectionLimit: 10,
    database: MYSQL_DATABASE,
    host: MYSQL_HOST,
    password: MYSQL_PASSWORD,
    port: MYSQL_PORT,
    supportBigNumbers: true,
    timezone: "Z",
    user: MYSQL_USER,
    waitForConnections: true
  });
}

function getPool() {
  assertDatabaseRuntimeAllowed();
  pool ??= createPool();
  return pool;
}

function createDatabase(connection: DatabaseConnection): Database {
  return {
    async execute(sql, params = []) {
      const [result] = await connection.execute<ResultSetHeader>(sql, params);
      return result;
    },
    async first<T extends object>(sql: string, params: SqlValue[] = []) {
      const [rows] = await connection.execute<RowDataPacket[]>(sql, params);
      const row = rows[0];
      return row ? (row as T) : null;
    },
    async rows<T extends object>(sql: string, params: SqlValue[] = []) {
      const [rows] = await connection.execute<RowDataPacket[]>(sql, params);
      return rows as T[];
    }
  };
}

export async function ensureDatabaseSchema(connection: DatabaseConnection = getPool()) {
  if (connection === pool) {
    schemaPromise ??= (async () => {
      await runSchemaStatements(connection);
    })();

    return schemaPromise;
  }

  await runSchemaStatements(connection);
}

export async function readDatabase<T>(operation: (db: Database) => Promise<T> | T) {
  const currentPool = getPool();
  await ensureDatabaseSchema(currentPool);
  return operation(createDatabase(currentPool));
}

export async function writeDatabase<T>(operation: (db: Database) => Promise<T> | T) {
  const currentPool = getPool();

  // Schema setup can execute DDL statements. MySQL implicitly commits around
  // DDL, so it must complete before the business transaction begins.
  await ensureDatabaseSchema(currentPool);

  const connection = await currentPool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await operation(createDatabase(connection));
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getFirstRow<T extends object>(
  db: Database,
  sql: string,
  params: SqlValue[] = []
) {
  return db.first<T>(sql, params);
}

export async function getRows<T extends object>(
  db: Database,
  sql: string,
  params: SqlValue[] = []
) {
  return db.rows<T>(sql, params);
}
