import { promises as fs } from "node:fs";
import path from "node:path";

import initSqlJs, { type Database, type SqlValue } from "sql.js";

const DATA_DIR = path.join(process.cwd(), "data");
export const DATABASE_PATH = path.join(DATA_DIR, "zhanji-universe.sqlite");

let databasePromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function databaseFileExists() {
  try {
    await fs.access(DATABASE_PATH);
    return true;
  } catch {
    return false;
  }
}

async function openDatabase() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), "node_modules/sql.js/dist", file)
  });
  const exists = await databaseFileExists();
  const bytes = exists ? await fs.readFile(DATABASE_PATH) : null;
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();

  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      label TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS front_users (
      id TEXT PRIMARY KEY,
      account TEXT NOT NULL,
      contact TEXT,
      profile TEXT,
      invite_code TEXT,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      owner_account TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      goal TEXT NOT NULL,
      style TEXT NOT NULL,
      deliverables_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(owner_id) REFERENCES front_users(id)
    );

    CREATE TABLE IF NOT EXISTS model_api_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT,
      model TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      system_prompt TEXT NOT NULL,
      temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 1200,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_api_calls (
      id TEXT PRIMARY KEY,
      config_id TEXT,
      node_title TEXT,
      status TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response_text TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(config_id) REFERENCES model_api_configs(id)
    );
  `);

  return db;
}

async function getDatabase() {
  databasePromise ??= openDatabase();
  return databasePromise;
}

async function persistDatabase(db: Database) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATABASE_PATH, Buffer.from(db.export()));
}

export async function readDatabase<T>(operation: (db: Database) => T) {
  const db = await getDatabase();
  return operation(db);
}

export async function writeDatabase<T>(operation: (db: Database) => T) {
  let result!: T;

  writeQueue = writeQueue.then(async () => {
    const db = await getDatabase();
    result = operation(db);
    await persistDatabase(db);
  });

  await writeQueue;
  return result;
}

export function getFirstRow<T extends Record<string, unknown>>(
  db: Database,
  sql: string,
  params: SqlValue[] = []
) {
  const statement = db.prepare(sql, params);

  try {
    if (!statement.step()) {
      return null;
    }

    return statement.getAsObject() as T;
  } finally {
    statement.free();
  }
}

export function getRows<T extends Record<string, unknown>>(
  db: Database,
  sql: string,
  params: SqlValue[] = []
) {
  const statement = db.prepare(sql, params);
  const rows: T[] = [];

  try {
    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }

    return rows;
  } finally {
    statement.free();
  }
}
