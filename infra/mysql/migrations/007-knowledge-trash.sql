SET @knowledge_trash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'knowledge_pages' AND column_name = 'deleted_at') = 0,
  'ALTER TABLE knowledge_pages ADD COLUMN deleted_at VARCHAR(40) NULL',
  'SELECT 1'
);
PREPARE knowledge_trash_stmt FROM @knowledge_trash_sql;
EXECUTE knowledge_trash_stmt;
DEALLOCATE PREPARE knowledge_trash_stmt;

SET @knowledge_trash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'knowledge_pages' AND column_name = 'deleted_by_id') = 0,
  'ALTER TABLE knowledge_pages ADD COLUMN deleted_by_id VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE knowledge_trash_stmt FROM @knowledge_trash_sql;
EXECUTE knowledge_trash_stmt;
DEALLOCATE PREPARE knowledge_trash_stmt;

SET @knowledge_trash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'knowledge_pages' AND column_name = 'deleted_by_account') = 0,
  'ALTER TABLE knowledge_pages ADD COLUMN deleted_by_account VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE knowledge_trash_stmt FROM @knowledge_trash_sql;
EXECUTE knowledge_trash_stmt;
DEALLOCATE PREPARE knowledge_trash_stmt;

SET @knowledge_trash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'knowledge_pages' AND column_name = 'deletion_batch_id') = 0,
  'ALTER TABLE knowledge_pages ADD COLUMN deletion_batch_id VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE knowledge_trash_stmt FROM @knowledge_trash_sql;
EXECUTE knowledge_trash_stmt;
DEALLOCATE PREPARE knowledge_trash_stmt;

SET @knowledge_trash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'knowledge_pages' AND column_name = 'deleted_root_id') = 0,
  'ALTER TABLE knowledge_pages ADD COLUMN deleted_root_id VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE knowledge_trash_stmt FROM @knowledge_trash_sql;
EXECUTE knowledge_trash_stmt;
DEALLOCATE PREPARE knowledge_trash_stmt;

SET @knowledge_trash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'knowledge_tables' AND column_name = 'deleted_at') = 0,
  'ALTER TABLE knowledge_tables ADD COLUMN deleted_at VARCHAR(40) NULL',
  'SELECT 1'
);
PREPARE knowledge_trash_stmt FROM @knowledge_trash_sql;
EXECUTE knowledge_trash_stmt;
DEALLOCATE PREPARE knowledge_trash_stmt;

SET @knowledge_trash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'knowledge_tables' AND column_name = 'deleted_by_id') = 0,
  'ALTER TABLE knowledge_tables ADD COLUMN deleted_by_id VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE knowledge_trash_stmt FROM @knowledge_trash_sql;
EXECUTE knowledge_trash_stmt;
DEALLOCATE PREPARE knowledge_trash_stmt;

SET @knowledge_trash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'knowledge_tables' AND column_name = 'deleted_by_account') = 0,
  'ALTER TABLE knowledge_tables ADD COLUMN deleted_by_account VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE knowledge_trash_stmt FROM @knowledge_trash_sql;
EXECUTE knowledge_trash_stmt;
DEALLOCATE PREPARE knowledge_trash_stmt;

SET @knowledge_trash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'knowledge_tables' AND column_name = 'deletion_batch_id') = 0,
  'ALTER TABLE knowledge_tables ADD COLUMN deletion_batch_id VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE knowledge_trash_stmt FROM @knowledge_trash_sql;
EXECUTE knowledge_trash_stmt;
DEALLOCATE PREPARE knowledge_trash_stmt;

SET @knowledge_trash_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'knowledge_tables' AND column_name = 'deleted_root_id') = 0,
  'ALTER TABLE knowledge_tables ADD COLUMN deleted_root_id VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE knowledge_trash_stmt FROM @knowledge_trash_sql;
EXECUTE knowledge_trash_stmt;
DEALLOCATE PREPARE knowledge_trash_stmt;
