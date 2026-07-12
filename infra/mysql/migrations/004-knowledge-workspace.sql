CREATE TABLE IF NOT EXISTS knowledge_spaces (
  id VARCHAR(191) PRIMARY KEY,
  owner_id VARCHAR(191) NOT NULL,
  owner_account VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description VARCHAR(2000) NOT NULL DEFAULT '',
  icon VARCHAR(32) NOT NULL DEFAULT 'book-open',
  color VARCHAR(32) NOT NULL DEFAULT '#7c3aed',
  revision INT NOT NULL DEFAULT 1,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  INDEX idx_knowledge_spaces_owner_updated (owner_id, updated_at),
  INDEX idx_knowledge_spaces_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_pages (
  id VARCHAR(191) PRIMARY KEY,
  space_id VARCHAR(191) NOT NULL,
  parent_id VARCHAR(191),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  page_type VARCHAR(32) NOT NULL DEFAULT 'document',
  icon VARCHAR(32) NOT NULL DEFAULT 'file-text',
  content_json LONGTEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 1,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  UNIQUE KEY uq_knowledge_pages_space_slug (space_id, slug),
  INDEX idx_knowledge_pages_space_parent_sort (space_id, parent_id, sort_order),
  INDEX idx_knowledge_pages_space_updated (space_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_tables (
  id VARCHAR(191) PRIMARY KEY,
  space_id VARCHAR(191) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description VARCHAR(2000) NOT NULL DEFAULT '',
  icon VARCHAR(32) NOT NULL DEFAULT 'table-2',
  revision INT NOT NULL DEFAULT 1,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  INDEX idx_knowledge_tables_space_updated (space_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_fields (
  id VARCHAR(191) PRIMARY KEY,
  table_id VARCHAR(191) NOT NULL,
  name VARCHAR(255) NOT NULL,
  field_type VARCHAR(40) NOT NULL,
  config_json LONGTEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 1,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  INDEX idx_knowledge_fields_table_sort (table_id, sort_order),
  INDEX idx_knowledge_fields_table_updated (table_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_records (
  id VARCHAR(191) PRIMARY KEY,
  table_id VARCHAR(191) NOT NULL,
  values_json LONGTEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 1,
  created_by_id VARCHAR(191),
  created_by_account VARCHAR(255),
  updated_by_id VARCHAR(191),
  updated_by_account VARCHAR(255),
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  INDEX idx_knowledge_records_table_sort (table_id, sort_order),
  INDEX idx_knowledge_records_table_updated (table_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_views (
  id VARCHAR(191) PRIMARY KEY,
  table_id VARCHAR(191) NOT NULL,
  name VARCHAR(255) NOT NULL,
  view_type VARCHAR(32) NOT NULL DEFAULT 'grid',
  filter_json LONGTEXT NOT NULL,
  sort_json LONGTEXT NOT NULL,
  group_json LONGTEXT NOT NULL,
  visible_field_ids_json LONGTEXT NOT NULL,
  row_height VARCHAR(24) NOT NULL DEFAULT 'medium',
  frozen_field_count INT NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 1,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  INDEX idx_knowledge_views_table_default (table_id, is_default),
  INDEX idx_knowledge_views_table_updated (table_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
