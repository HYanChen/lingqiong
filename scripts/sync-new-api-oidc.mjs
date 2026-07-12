#!/usr/bin/env node

import mysql from "mysql2/promise";

const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 2_000;

function requiredEnvironment(name, { trim = false } = {}) {
  const rawValue = process.env[name];
  const value = trim ? rawValue?.trim() : rawValue;

  if (!value) {
    throw new Error(`missing_environment:${name}`);
  }

  return value;
}

function optionalEnvironment(name, fallback, { trim = false } = {}) {
  const rawValue = process.env[name];
  const value = trim ? rawValue?.trim() : rawValue;
  return value || fallback;
}

function normalizedBaseUrl(value, name) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`invalid_url:${name}`);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`invalid_url:${name}`);
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  return parsed.toString().replace(/\/$/u, "");
}

function validatedDatabaseName(value) {
  if (!/^[A-Za-z0-9_]+$/u.test(value)) {
    throw new Error("invalid_database_name");
  }

  return value;
}

function safeErrorCode(error) {
  const code = error && typeof error === "object" ? error.code : null;
  return typeof code === "string" && /^[A-Z0-9_]+$/u.test(code)
    ? code
    : "SYNC_FAILED";
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function configuration() {
  const publicBaseUrl = normalizedBaseUrl(
    requiredEnvironment("WCU_PUBLIC_BASE_URL", { trim: true }),
    "WCU_PUBLIC_BASE_URL"
  );
  const issuer = normalizedBaseUrl(
    optionalEnvironment(
      "WCU_OIDC_ISSUER",
      "http://platform-api:3000/api/oidc",
      { trim: true }
    ),
    "WCU_OIDC_ISSUER"
  );
  const clientId = optionalEnvironment(
    "WCU_OIDC_CLIENT_ID",
    "zhanji-bookstack",
    { trim: true }
  );
  const clientSecret = requiredEnvironment("WCU_OIDC_CLIENT_SECRET");

  return {
    database: validatedDatabaseName(
      optionalEnvironment("NEW_API_MYSQL_DATABASE", "new_api", { trim: true })
    ),
    host: optionalEnvironment("MYSQL_HOST", "mysql", { trim: true }),
    password: requiredEnvironment("MYSQL_PASSWORD"),
    port: Number(optionalEnvironment("MYSQL_PORT", "3306", { trim: true })),
    user: requiredEnvironment("MYSQL_USER", { trim: true }),
    values: new Map([
      ["ServerAddress", publicBaseUrl],
      ["RegisterEnabled", "true"],
      ["PasswordRegisterEnabled", "false"],
      ["oidc.enabled", "true"],
      ["oidc.client_id", clientId],
      ["oidc.client_secret", clientSecret],
      ["oidc.well_known", `${issuer}/.well-known/openid-configuration`],
      ["oidc.authorization_endpoint", `${publicBaseUrl}/_wcu-api/oidc/authorize`],
      ["oidc.token_endpoint", `${issuer}/token`],
      ["oidc.user_info_endpoint", `${issuer}/userinfo`]
    ])
  };
}

async function synchronize(config) {
  const connection = await mysql.createConnection({
    connectTimeout: 5_000,
    database: config.database,
    host: config.host,
    multipleStatements: false,
    password: config.password,
    port: config.port,
    user: config.user
  });

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS options (
        \`key\` VARCHAR(191) NOT NULL,
        \`value\` LONGTEXT NULL,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB
        DEFAULT CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
    `);

    await connection.beginTransaction();

    try {
      for (const [key, value] of config.values) {
        await connection.execute(
          `INSERT INTO options (\`key\`, \`value\`)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE \`value\` = ?`,
          [key, value, value]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    const keys = [...config.values.keys()];
    const placeholders = keys.map(() => "?").join(", ");
    const [rows] = await connection.execute(
      `SELECT \`key\`, \`value\` FROM options WHERE \`key\` IN (${placeholders})`,
      keys
    );
    const stored = new Map(rows.map((row) => [row.key, row.value]));
    const mismatches = keys.filter(
      (key) => stored.get(key) !== config.values.get(key)
    );

    if (mismatches.length > 0) {
      throw Object.assign(new Error("verification_failed"), {
        code: "VERIFY_FAILED"
      });
    }

    const [tableRows] = await connection.execute(
      `SELECT COUNT(*) AS total
       FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'users'`,
      [config.database]
    );
    const hasUsersTable = Number(tableRows[0]?.total || 0) > 0;
    let clearedPrivilegedBindings = 0;

    if (hasUsersTable) {
      const [result] = await connection.execute(
        `UPDATE users
         SET oidc_id = ''
         WHERE role >= 10 AND oidc_id IS NOT NULL AND oidc_id <> ''`
      );
      clearedPrivilegedBindings = Number(result.affectedRows || 0);
    }

    return { clearedPrivilegedBindings };
  } finally {
    await connection.end().catch(() => undefined);
  }
}

async function main() {
  let config;

  try {
    config = configuration();
  } catch (error) {
    console.error(
      `[new-api-oidc-init] configuration rejected (${safeErrorCode(error)})`
    );
    process.exitCode = 1;
    return;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await synchronize(config);
      console.log(
        `[new-api-oidc-init] synchronized ${config.values.size} option keys; cleared ${result.clearedPrivilegedBindings} privileged OIDC bindings; secret values were not logged`
      );
      return;
    } catch (error) {
      const code = safeErrorCode(error);

      if (attempt === MAX_ATTEMPTS) {
        console.error(
          `[new-api-oidc-init] failed after ${MAX_ATTEMPTS} attempts (${code})`
        );
        process.exitCode = 1;
        return;
      }

      console.warn(
        `[new-api-oidc-init] attempt ${attempt}/${MAX_ATTEMPTS} failed (${code}); retrying`
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
}

await main();
