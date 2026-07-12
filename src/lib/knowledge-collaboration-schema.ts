import { readDatabase } from "@/lib/database";
import { ensureKnowledgeSchema } from "@/lib/knowledge-schema";

let collaborationSchemaPromise: Promise<void> | null = null;

const collaborationSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS knowledge_space_members (
    id VARCHAR(191) PRIMARY KEY,
    space_id VARCHAR(191) NOT NULL,
    user_id VARCHAR(191) NOT NULL,
    account VARCHAR(255),
    member_role VARCHAR(32) NOT NULL DEFAULT 'viewer',
    revision INT NOT NULL DEFAULT 1,
    added_by_id VARCHAR(191),
    added_by_account VARCHAR(255),
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    UNIQUE KEY uq_knowledge_space_member (space_id, user_id),
    INDEX idx_knowledge_members_user (user_id, updated_at),
    INDEX idx_knowledge_members_space_role (space_id, member_role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS knowledge_page_comments (
    id VARCHAR(191) PRIMARY KEY,
    space_id VARCHAR(191) NOT NULL,
    page_id VARCHAR(191) NOT NULL,
    parent_comment_id VARCHAR(191),
    author_id VARCHAR(191) NOT NULL,
    author_account VARCHAR(255),
    body TEXT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    revision INT NOT NULL DEFAULT 1,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_knowledge_page_comments_page (page_id, created_at),
    INDEX idx_knowledge_page_comments_parent (parent_comment_id),
    INDEX idx_knowledge_page_comments_author (author_id, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS knowledge_page_versions (
    id VARCHAR(191) PRIMARY KEY,
    space_id VARCHAR(191) NOT NULL,
    page_id VARCHAR(191) NOT NULL,
    version_number INT NOT NULL,
    page_revision INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content_json LONGTEXT NOT NULL,
    change_summary VARCHAR(1000) NOT NULL DEFAULT '',
    created_by_id VARCHAR(191),
    created_by_account VARCHAR(255),
    created_at VARCHAR(40) NOT NULL,
    UNIQUE KEY uq_knowledge_page_version (page_id, version_number),
    INDEX idx_knowledge_page_versions_page_created (page_id, created_at),
    INDEX idx_knowledge_page_versions_space_created (space_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS knowledge_record_comments (
    id VARCHAR(191) PRIMARY KEY,
    table_id VARCHAR(191) NOT NULL,
    record_id VARCHAR(191) NOT NULL,
    parent_comment_id VARCHAR(191),
    author_id VARCHAR(191) NOT NULL,
    author_account VARCHAR(255),
    body TEXT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    revision INT NOT NULL DEFAULT 1,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_knowledge_record_comments_record (record_id, created_at),
    INDEX idx_knowledge_record_comments_parent (parent_comment_id),
    INDEX idx_knowledge_record_comments_author (author_id, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS knowledge_record_activities (
    id VARCHAR(191) PRIMARY KEY,
    table_id VARCHAR(191) NOT NULL,
    record_id VARCHAR(191) NOT NULL,
    actor_id VARCHAR(191),
    actor_account VARCHAR(255),
    action VARCHAR(64) NOT NULL,
    details_json LONGTEXT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_knowledge_record_activities_record (record_id, created_at),
    INDEX idx_knowledge_record_activities_table (table_id, created_at),
    INDEX idx_knowledge_record_activities_actor (actor_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS knowledge_automation_rules (
    id VARCHAR(191) PRIMARY KEY,
    table_id VARCHAR(191) NOT NULL,
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(40) NOT NULL,
    trigger_config_json LONGTEXT NOT NULL,
    conditions_json LONGTEXT NOT NULL,
    actions_json LONGTEXT NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    revision INT NOT NULL DEFAULT 1,
    created_by_id VARCHAR(191),
    created_by_account VARCHAR(255),
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_knowledge_automation_rules_table (table_id, enabled, updated_at),
    INDEX idx_knowledge_automation_rules_trigger (table_id, trigger_type, enabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS knowledge_automation_runs (
    id VARCHAR(191) PRIMARY KEY,
    rule_id VARCHAR(191) NOT NULL,
    table_id VARCHAR(191) NOT NULL,
    record_id VARCHAR(191),
    status VARCHAR(24) NOT NULL DEFAULT 'queued',
    trigger_payload_json LONGTEXT NOT NULL,
    result_json LONGTEXT,
    error_text TEXT,
    revision INT NOT NULL DEFAULT 1,
    started_at VARCHAR(40),
    finished_at VARCHAR(40),
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_knowledge_automation_runs_rule (rule_id, created_at),
    INDEX idx_knowledge_automation_runs_table_status (table_id, status, created_at),
    INDEX idx_knowledge_automation_runs_record (record_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

export async function ensureKnowledgeCollaborationSchema() {
  await ensureKnowledgeSchema();
  collaborationSchemaPromise ??= readDatabase(async (db) => {
    for (const statement of collaborationSchemaStatements) {
      await db.execute(statement);
    }
  }).catch((error) => {
    collaborationSchemaPromise = null;
    throw error;
  });

  return collaborationSchemaPromise;
}
