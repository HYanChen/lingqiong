import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import mysql from "mysql2/promise";
import initSqlJs from "sql.js";

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, ".env.new-api.example");
const sqlitePath = process.argv[2] || path.join(projectRoot, "data/zhanji-universe.sqlite");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    process.env[key] ??= valueParts.join("=").replace(/^['"]|['"]$/g, "");
  }
}

function quoteName(value) {
  return `\`${value.replace(/`/g, "``")}\``;
}

function tableExists(db, table) {
  const escaped = table.replace(/'/g, "''");
  const result = db.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${escaped}'`
  );
  return Boolean(result[0]?.values.length);
}

function tableColumns(db, table) {
  const escaped = table.replace(/"/g, '""');
  return (db.exec(`PRAGMA table_info("${escaped}")`)[0]?.values ?? []).map((row) => row[1]);
}

function normalizeRows(db, table, columns) {
  if (!tableExists(db, table)) {
    return [];
  }

  const availableColumns = tableColumns(db, table);
  const selectedColumns = columns.filter((column) => availableColumns.includes(column));

  if (!selectedColumns.length) {
    return [];
  }

  const escapedTable = table.replace(/"/g, '""');
  const selected = selectedColumns
    .map((column) => `"${column.replace(/"/g, '""')}"`)
    .join(", ");
  const result = db.exec(`SELECT ${selected} FROM "${escapedTable}"`)[0];

  if (!result) {
    return [];
  }

  return result.values.map((values) => {
    const row = Object.fromEntries(columns.map((column) => [column, null]));

    selectedColumns.forEach((column, index) => {
      row[column] = values[index] ?? null;
    });

    return row;
  });
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
    account VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    profile LONGTEXT,
    invite_code VARCHAR(191),
    source VARCHAR(40) NOT NULL,
    created_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(191) PRIMARY KEY,
    owner_id VARCHAR(191),
    owner_account VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(120) NOT NULL,
    source LONGTEXT NOT NULL,
    goal LONGTEXT NOT NULL,
    style LONGTEXT NOT NULL,
    deliverables_json LONGTEXT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    INDEX idx_projects_created_at (created_at),
    INDEX idx_projects_owner_id (owner_id)
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
    node_title VARCHAR(255),
    status VARCHAR(40) NOT NULL,
    prompt LONGTEXT NOT NULL,
    response_text LONGTEXT,
    error LONGTEXT,
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_model_api_calls_created_at (created_at),
    INDEX idx_model_api_calls_config_id (config_id)
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
];

const tables = [
  {
    name: "site_content",
    primaryKey: "key",
    columns: ["key", "json", "updated_at"]
  },
  {
    name: "invite_codes",
    primaryKey: "code",
    columns: ["code", "label", "active", "used_count", "created_at", "updated_at"]
  },
  {
    name: "front_users",
    primaryKey: "id",
    columns: ["id", "account", "contact", "profile", "invite_code", "source", "created_at"]
  },
  {
    name: "projects",
    primaryKey: "id",
    columns: [
      "id",
      "owner_id",
      "owner_account",
      "name",
      "type",
      "source",
      "goal",
      "style",
      "deliverables_json",
      "created_at",
      "updated_at"
    ]
  },
  {
    name: "model_api_configs",
    primaryKey: "id",
    columns: [
      "id",
      "name",
      "provider",
      "base_url",
      "api_key",
      "model",
      "enabled",
      "system_prompt",
      "temperature",
      "max_tokens",
      "created_at",
      "updated_at"
    ]
  },
  {
    name: "model_api_calls",
    primaryKey: "id",
    columns: [
      "id",
      "config_id",
      "node_title",
      "status",
      "prompt",
      "response_text",
      "error",
      "created_at"
    ]
  },
  {
    name: "admin_users",
    primaryKey: "id",
    columns: [
      "id",
      "username",
      "display_name",
      "role",
      "permissions_json",
      "password_hash",
      "password_salt",
      "active",
      "last_login_at",
      "created_at",
      "updated_at"
    ]
  }
];

loadEnvFile(envPath);

if (!existsSync(sqlitePath)) {
  console.error(`SQLite file not found: ${sqlitePath}`);
  process.exit(1);
}

const mysqlConfig = {
  charset: "utf8mb4",
  database: process.env.MYSQL_DATABASE || "zhanji_universe",
  host: process.env.MYSQL_HOST || "127.0.0.1",
  password: process.env.MYSQL_PASSWORD || "zhanji-local-password",
  port: Number(process.env.MYSQL_PORT || 3306),
  timezone: "Z",
  user: process.env.MYSQL_USER || "zhanji"
};

const SQL = await initSqlJs();
const sqlite = new SQL.Database(readFileSync(sqlitePath));
const connection = await mysql.createConnection(mysqlConfig);

try {
  for (const statement of schemaStatements) {
    await connection.execute(statement);
  }

  for (const table of tables) {
    const rows = normalizeRows(sqlite, table.name, table.columns);

    if (!rows.length) {
      console.log(`${table.name}: 0`);
      continue;
    }

    const columns = table.columns;
    const updateColumns = columns.filter((column) => column !== table.primaryKey);
    const sql = `INSERT INTO ${quoteName(table.name)}
      (${columns.map(quoteName).join(", ")})
      VALUES (${columns.map(() => "?").join(", ")})
      ON DUPLICATE KEY UPDATE ${updateColumns
        .map((column) => `${quoteName(column)} = VALUES(${quoteName(column)})`)
        .join(", ")}`;

    for (const row of rows) {
      await connection.execute(
        sql,
        columns.map((column) => row[column])
      );
    }

    console.log(`${table.name}: ${rows.length}`);
  }
} finally {
  sqlite.close();
  await connection.end();
}
