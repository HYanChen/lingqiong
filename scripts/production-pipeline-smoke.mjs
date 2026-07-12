#!/usr/bin/env node

import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import mysql from "mysql2/promise";

const envFiles = [".env.local", ".env", ".env.new-api.example"];
const positiveQuota = 50_000_000;
const baseUrl = (
  process.env.PIPELINE_TEST_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost"
).replace(/\/+$/, "");
const apiPrefix = normalizePrefix(
  process.env.PIPELINE_TEST_API_PREFIX || "/_wcu-api"
);

function envValue(key) {
  if (process.env[key]) {
    return process.env[key];
  }

  for (const file of envFiles) {
    if (!existsSync(file)) {
      continue;
    }

    const match = readFileSync(file, "utf8")
      .split(/\r?\n/u)
      .map((line) =>
        line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u)
      )
      .find((item) => item?.[1] === key);

    if (match?.[2]) {
      return match[2].trim().replace(/^(['"])(.*)\1$/u, "$2");
    }
  }

  return undefined;
}

function databaseConfig(database) {
  return {
    bigNumberStrings: true,
    charset: "utf8mb4",
    connectionLimit: 3,
    database,
    host: envValue("MYSQL_HOST") || "127.0.0.1",
    password: envValue("MYSQL_PASSWORD") || "zhanji-local-password",
    port: Number(envValue("MYSQL_PORT") || 3306),
    supportBigNumbers: true,
    timezone: "Z",
    user: envValue("MYSQL_USER") || "zhanji",
    waitForConnections: true
  };
}

const mainPool = mysql.createPool(
  databaseConfig(envValue("MYSQL_DATABASE") || "zhanji_universe")
);
const newApiPool = mysql.createPool(
  databaseConfig(envValue("NEW_API_MYSQL_DATABASE") || "new_api")
);

function normalizePrefix(value) {
  const normalized = `/${String(value).trim()}`.replace(/\/{2,}/g, "/");
  return normalized === "/" ? "" : normalized.replace(/\/$/, "");
}

function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${apiPrefix}${normalizedPath}`;
}

function assert(condition, message, context) {
  if (!condition) {
    const suffix = context ? `\n${JSON.stringify(context, null, 2)}` : "";
    throw new Error(`${message}${suffix}`);
  }
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function first(pool, sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0] ?? null;
}

async function optionalExecute(pool, sql, params = []) {
  try {
    return await pool.execute(sql, params);
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return null;
    }

    throw error;
  }
}

async function optionalFirst(pool, sql, params = []) {
  try {
    return await first(pool, sql, params);
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return null;
    }

    throw error;
  }
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    },
    redirect: "manual"
  });
  const body = await response.json().catch(() => null);
  return { body, response };
}

function expectStatus(result, status, label) {
  assert(result.response.status === status, `${label}: expected HTTP ${status}`, {
    body: result.body,
    status: result.response.status,
    url: result.response.url
  });
  return result.body;
}

function cookieHeader(response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") || ""];

  return setCookies
    .flatMap((header) => header.split(/,(?=\s*[^;,]+=)/u))
    .map((header) => header.split(";", 1)[0].trim())
    .filter(Boolean)
    .join("; ");
}

const suffix = `${Date.now().toString(36)}.${randomBytes(4).toString("hex")}`;
const frontId = randomUUID();
const frontUsername = `pipeline.audit.${suffix}`;
const frontPassword = `Pipeline-${randomBytes(18).toString("base64url")}!`;
const oidcSubject = `creator:${frontId}`;
const newApiUsername = `pipeline-${suffix}`;
const newApiEmail = `${newApiUsername}@example.invalid`;
const nowIso = new Date().toISOString();
const nowUnix = Math.floor(Date.now() / 1000);
const salt = randomBytes(16).toString("hex");
const passwordHash = scryptSync(frontPassword, salt, 64).toString("hex");

let cookie = "";
let newApiUserId = 0;
let internalTokenId = 0;

const authenticated = (path, options = {}) =>
  jsonRequest(path, {
    ...options,
    headers: { cookie, ...(options.headers || {}) }
  });

let projectId;
const projectIds = new Set();
let cleanupVerified = false;
let projectCleanupVerified = false;
let checks = 0;
const checked = (condition, message, context) => {
  assert(condition, message, context);
  checks += 1;
};

async function createTemporarySubject() {
  await mainPool.execute(
    `INSERT INTO front_users (
      id, username, account, contact, profile, invite_code, source,
      password_hash, password_salt, active, failed_attempts, locked_until,
      last_login_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, NULL, 'login', ?, ?, 1, 0, NULL, NULL, ?, ?)`,
    [
      frontId,
      frontUsername,
      "生产流水线自动验收用户",
      newApiEmail,
      "普通创作者",
      passwordHash,
      salt,
      nowIso,
      nowIso
    ]
  );

  const [result] = await newApiPool.execute(
    `INSERT INTO users (
      username, password, display_name, role, status, email, oidc_id,
      quota, used_quota, request_count, \`group\`, created_at, last_login_at
     ) VALUES (?, ?, ?, 1, 1, ?, ?, ?, 0, 0, 'default', ?, ?)`,
    [
      newApiUsername,
      randomBytes(32).toString("hex"),
      "生产流水线自动验收用户",
      newApiEmail,
      oidcSubject,
      positiveQuota,
      nowUnix,
      nowUnix
    ]
  );
  newApiUserId = numberValue(result.insertId);
  checked(newApiUserId > 0, "temporary New API user id missing");
}

async function loginTemporarySubject() {
  const login = await jsonRequest("/auth/login", {
    body: JSON.stringify({
      password: frontPassword,
      username: frontUsername
    }),
    method: "POST"
  });
  expectStatus(login, 200, "temporary front user login");
  cookie = cookieHeader(login.response);
  checked(
    cookie.includes("wcu_platform_session="),
    "platform session cookie missing"
  );
  checked(!cookie.includes("wcu_admin="), "front user received admin cookie");
  checked(
    login.body?.user?.id === frontId &&
      login.body?.user?.role === "creator" &&
      login.body?.user?.source !== "admin",
    "temporary login did not establish a creator session",
    login.body
  );
}

async function verifyTemporaryAccountBinding() {
  const overviewResult = await authenticated("/account/overview");
  const overview = expectStatus(
    overviewResult,
    200,
    "temporary account overview"
  );
  checked(
    overview?.connected === true &&
      overview?.modelAccess?.allowed === true &&
      overview?.platformUser?.id === frontId &&
      overview?.platformUser?.role === "creator" &&
      overview?.platformUser?.source !== "admin" &&
      numberValue(overview?.account?.id) === newApiUserId &&
      numberValue(overview?.account?.quota) === positiveQuota,
    "temporary New API account is not active with positive quota",
    overview
  );

  const link = await first(
    mainPool,
    `SELECT principal_type, principal_id, oidc_subject, new_api_user_id,
      internal_token_id, link_status
     FROM api_account_links
     WHERE principal_type = 'creator' AND principal_id = ?`,
    [frontId]
  );
  checked(
    link?.principal_type === "creator" &&
      link?.principal_id === frontId &&
      link?.oidc_subject === oidcSubject &&
      numberValue(link?.new_api_user_id) === newApiUserId &&
      link?.link_status === "active",
    "temporary platform API account link is invalid",
    link
  );
}

async function verifyTemporaryInternalToken() {
  const link = await first(
    mainPool,
    `SELECT internal_token_id, link_status, new_api_user_id
     FROM api_account_links
     WHERE principal_type = 'creator' AND principal_id = ?`,
    [frontId]
  );
  internalTokenId = numberValue(link?.internal_token_id);
  const token = internalTokenId
    ? await first(
        newApiPool,
        `SELECT id, user_id, status, name
         FROM tokens
         WHERE id = ? AND deleted_at IS NULL`,
        [internalTokenId]
      )
    : null;

  checked(
    numberValue(link?.new_api_user_id) === newApiUserId &&
      link?.link_status === "active" &&
      internalTokenId > 0 &&
      numberValue(token?.user_id) === newApiUserId &&
      numberValue(token?.status) === 1 &&
      token?.name === "灵穹创作平台内部调用",
    "temporary internal model token binding is invalid",
    {
      link,
      token: token
        ? {
            id: token.id,
            name: token.name,
            status: token.status,
            userId: token.user_id
          }
        : null
    }
  );
}

const projectTables = [
  "generation_jobs",
  "voiceovers",
  "storyboards",
  "compositions",
  "elements",
  "episodes",
  "project_canvas_states",
  "project_uploads"
];

async function deleteProjectData(connection, id) {
  for (const table of projectTables) {
    await connection.execute(`DELETE FROM ${table} WHERE project_id = ?`, [id]);
  }
  await connection.execute("DELETE FROM projects WHERE id = ?", [id]);
}

async function cleanupTemporarySubject() {
  const errors = [];
  const candidateNewApiUserIds = new Set(
    newApiUserId > 0 ? [newApiUserId] : []
  );
  const capture = async (label, cleanup) => {
    try {
      await cleanup();
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : error}`);
    }
  };

  if (projectId && cookie) {
    await authenticated(`/projects/${projectId}`, { method: "DELETE" }).catch(
      () => null
    );
  }

  await capture("project cleanup", async () => {
    const connection = await mainPool.getConnection();

    try {
      await connection.beginTransaction();
      for (const id of projectIds) {
        await deleteProjectData(connection, id);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => null);
      throw error;
    } finally {
      connection.release();
    }
  });

  await capture("platform account cleanup", async () => {
    await optionalExecute(
      mainPool,
      "DELETE FROM model_billing_audits WHERE principal_id = ? OR new_api_user_id = ?",
      [frontId, newApiUserId]
    );
    await optionalExecute(
      mainPool,
      "DELETE FROM api_account_links WHERE principal_id = ? OR oidc_subject = ? OR new_api_user_id = ?",
      [frontId, oidcSubject, newApiUserId]
    );
    await mainPool.execute("DELETE FROM model_api_calls WHERE actor_id = ?", [
      frontId
    ]);
  });

  await capture("New API cleanup", async () => {
    const [users] = await newApiPool.execute(
      "SELECT id FROM users WHERE id = ? OR oidc_id = ?",
      [newApiUserId, oidcSubject]
    );

    for (const user of users) {
      const id = numberValue(user.id);
      if (id > 0) {
        candidateNewApiUserIds.add(id);
      }
    }

    if (candidateNewApiUserIds.size) {
      const ids = [...candidateNewApiUserIds];
      const placeholders = ids.map(() => "?").join(",");
      await newApiPool.execute(
        `DELETE FROM tokens WHERE user_id IN (${placeholders})`,
        ids
      );
      await optionalExecute(
        newApiPool,
        `DELETE FROM logs WHERE user_id IN (${placeholders})`,
        ids
      );
      await optionalExecute(
        newApiPool,
        `DELETE FROM top_ups WHERE user_id IN (${placeholders})`,
        ids
      );
    }

    await newApiPool.execute("DELETE FROM users WHERE id = ? OR oidc_id = ?", [
      newApiUserId,
      oidcSubject
    ]);
  });

  await capture("temporary front user cleanup", async () => {
    await mainPool.execute(
      "DELETE FROM front_user_identities WHERE user_id = ?",
      [frontId]
    );
    await mainPool.execute("DELETE FROM front_users WHERE id = ?", [frontId]);
  });

  await capture("cleanup verification", async () => {
    const ids = [...candidateNewApiUserIds];
    const placeholders = ids.map(() => "?").join(",");
    const projectIdList = [...projectIds];
    const projectPlaceholders = projectIdList.map(() => "?").join(",");
    let projectChildren = 0;

    if (projectIdList.length) {
      for (const table of projectTables) {
        projectChildren += numberValue(
          (
            await first(
              mainPool,
              `SELECT COUNT(*) AS total FROM ${table} WHERE project_id IN (${projectPlaceholders})`,
              projectIdList
            )
          )?.total
        );
      }
    }

    const residual = {
      frontUser: numberValue(
        (
          await first(
            mainPool,
            "SELECT COUNT(*) AS total FROM front_users WHERE id = ?",
            [frontId]
          )
        )?.total
      ),
      frontUserIdentity: numberValue(
        (
          await first(
            mainPool,
            "SELECT COUNT(*) AS total FROM front_user_identities WHERE user_id = ?",
            [frontId]
          )
        )?.total
      ),
      apiAccountLink: numberValue(
        (
          await optionalFirst(
            mainPool,
            "SELECT COUNT(*) AS total FROM api_account_links WHERE principal_id = ? OR oidc_subject = ? OR new_api_user_id = ?",
            [frontId, oidcSubject, newApiUserId]
          )
        )?.total
      ),
      billingAudit: numberValue(
        (
          await optionalFirst(
            mainPool,
            "SELECT COUNT(*) AS total FROM model_billing_audits WHERE principal_id = ? OR new_api_user_id = ?",
            [frontId, newApiUserId]
          )
        )?.total
      ),
      modelCalls: numberValue(
        (
          await first(
            mainPool,
            "SELECT COUNT(*) AS total FROM model_api_calls WHERE actor_id = ?",
            [frontId]
          )
        )?.total
      ),
      newApiLogs: ids.length
        ? numberValue(
            (
              await optionalFirst(
                newApiPool,
                `SELECT COUNT(*) AS total FROM logs WHERE user_id IN (${placeholders})`,
                ids
              )
            )?.total
          )
        : 0,
      newApiTopUps: ids.length
        ? numberValue(
            (
              await optionalFirst(
                newApiPool,
                `SELECT COUNT(*) AS total FROM top_ups WHERE user_id IN (${placeholders})`,
                ids
              )
            )?.total
          )
        : 0,
      newApiTokens: ids.length
        ? numberValue(
            (
              await first(
                newApiPool,
                `SELECT COUNT(*) AS total FROM tokens WHERE user_id IN (${placeholders})`,
                ids
              )
            )?.total
          )
        : 0,
      newApiUser: numberValue(
        (
          await first(
            newApiPool,
            "SELECT COUNT(*) AS total FROM users WHERE id = ? OR oidc_id = ?",
            [newApiUserId, oidcSubject]
          )
        )?.total
      ),
      projectChildren,
      projects: projectIdList.length
        ? numberValue(
            (
              await first(
                mainPool,
                `SELECT COUNT(*) AS total FROM projects WHERE id IN (${projectPlaceholders})`,
                projectIdList
              )
            )?.total
          )
        : 0
    };

    assert(
      Object.values(residual).every((value) => value === 0),
      "production pipeline smoke cleanup left residual data",
      residual
    );
  });

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }

  cleanupVerified = true;
}

let auditError = null;
let cleanupError = null;

try {
  await createTemporarySubject();
  await loginTemporarySubject();
  await verifyTemporaryAccountBinding();

  const projectResult = await authenticated("/projects", {
    body: JSON.stringify({
      aspectRatio: "16:9",
      deliverables: ["pipeline-smoke"],
      goal: "isolated reversible CRUD verification",
      name: `pipeline-smoke-${Date.now()}`,
      source: "automated local smoke test",
      style: "test",
      type: "测试"
    }),
    method: "POST"
  });
  expectStatus(projectResult, 200, "project creation");
  projectId = projectResult.body?.project?.id;
  checked(Boolean(projectId), "project id missing");
  projectIds.add(projectId);

  const root = `/projects/${projectId}`;
  const unauthorized = await jsonRequest(`${root}/episodes`);
  expectStatus(unauthorized, 401, "unauthorized access");
  checked(
    unauthorized.body?.error?.code === "AUTH_REQUIRED",
    "auth error code is unstable",
    unauthorized.body
  );

  const createdEpisode = await authenticated(`${root}/episodes`, {
    body: JSON.stringify({
      script: "第一集测试剧本",
      summary: "第一集",
      title: "测试第一集"
    }),
    method: "POST"
  });
  expectStatus(createdEpisode, 201, "episode creation");
  const episode = createdEpisode.body?.episode;
  checked(episode?.episodeNumber === 1, "episode auto number failed", episode);

  const episodeGet = await authenticated(`${root}/episodes/${episode.id}`);
  expectStatus(episodeGet, 200, "episode read");
  checked(episodeGet.body?.episode?.id === episode.id, "episode read mismatch");

  const duplicateEpisode = await authenticated(`${root}/episodes`, {
    body: JSON.stringify({ episodeNumber: 1, title: "冲突剧集" }),
    method: "POST"
  });
  expectStatus(duplicateEpisode, 409, "episode unique conflict");
  checked(
    duplicateEpisode.body?.error?.code === "RESOURCE_CONFLICT",
    "episode conflict code is unstable",
    duplicateEpisode.body
  );

  const concurrentEpisodeResults = await Promise.all([
    authenticated(`${root}/episodes`, {
      body: JSON.stringify({ title: "并发剧集 A" }),
      method: "POST"
    }),
    authenticated(`${root}/episodes`, {
      body: JSON.stringify({ title: "并发剧集 B" }),
      method: "POST"
    })
  ]);
  concurrentEpisodeResults.forEach((result, index) =>
    expectStatus(result, 201, `concurrent episode ${index + 1}`)
  );
  const concurrentEpisodes = concurrentEpisodeResults.map(
    (result) => result.body?.episode
  );
  checked(
    concurrentEpisodes
      .map((item) => item?.episodeNumber)
      .sort((a, b) => a - b)
      .join(",") === "2,3",
    "concurrent episode numbering collided",
    concurrentEpisodes
  );

  const updatedEpisode = await authenticated(`${root}/episodes/${episode.id}`, {
    body: JSON.stringify({ status: "ready", summary: "已更新" }),
    method: "PATCH"
  });
  expectStatus(updatedEpisode, 200, "episode update");
  checked(
    updatedEpisode.body?.episode?.status === "ready" &&
      updatedEpisode.body?.episode?.summary === "已更新",
    "episode update mismatch",
    updatedEpisode.body
  );

  const episodeList = await authenticated(`${root}/episodes`);
  expectStatus(episodeList, 200, "episode list");
  checked(episodeList.body?.episodes?.length === 3, "episode list mismatch");

  const roleResult = await authenticated(`${root}/elements`, {
    body: JSON.stringify({
      aliases: ["测试角色"],
      description: "角色描述",
      episodeId: episode.id,
      kind: "role",
      name: "林锋",
      prompt: "青年军人",
      status: "ready"
    }),
    method: "POST"
  });
  expectStatus(roleResult, 201, "element creation");
  const role = roleResult.body?.element;
  checked(role?.kind === "role", "element create mismatch", role);

  const roleGet = await authenticated(`${root}/elements/${role.id}`);
  expectStatus(roleGet, 200, "element read");
  checked(roleGet.body?.element?.id === role.id, "element read mismatch");

  const invalidMediaUrl = await authenticated(`${root}/elements/${role.id}`, {
    body: JSON.stringify({ referenceImageUrl: "javascript:alert(1)" }),
    method: "PATCH"
  });
  expectStatus(invalidMediaUrl, 400, "unsafe media URL rejection");
  checked(
    invalidMediaUrl.body?.error?.code === "INVALID_URL",
    "unsafe media URL error code mismatch",
    invalidMediaUrl.body
  );

  const roleUpdate = await authenticated(`${root}/elements/${role.id}`, {
    body: JSON.stringify({ aliases: ["测试角色", "队长"], notes: "已复核" }),
    method: "PATCH"
  });
  expectStatus(roleUpdate, 200, "element update");
  checked(
    roleUpdate.body?.element?.aliases?.includes("队长") &&
      roleUpdate.body?.element?.notes === "已复核",
    "element update mismatch",
    roleUpdate.body
  );

  const elementFilter = await authenticated(
    `${root}/elements?episodeId=${encodeURIComponent(episode.id)}&kind=role`
  );
  expectStatus(elementFilter, 200, "element filter");
  checked(elementFilter.body?.elements?.length === 1, "element filter mismatch");

  const storyboardResult = await authenticated(`${root}/storyboards`, {
    body: JSON.stringify({
      dialogue: "出发。",
      durationMs: 3200,
      elementIds: [role.id],
      episodeId: episode.id,
      prompt: "晨雾中的队伍",
      title: "整装出发"
    }),
    method: "POST"
  });
  expectStatus(storyboardResult, 201, "storyboard creation");
  const storyboard = storyboardResult.body?.storyboard;
  checked(storyboard?.shotNumber === 1, "storyboard auto number failed", storyboard);

  const storyboardGet = await authenticated(
    `${root}/storyboards/${storyboard.id}`
  );
  expectStatus(storyboardGet, 200, "storyboard read");
  checked(
    storyboardGet.body?.storyboard?.elementIds?.includes(role.id),
    "storyboard element relation missing"
  );

  const storyboardUpdate = await authenticated(
    `${root}/storyboards/${storyboard.id}`,
    {
      body: JSON.stringify({ camera: "缓慢推进", status: "ready" }),
      method: "PATCH"
    }
  );
  expectStatus(storyboardUpdate, 200, "storyboard update");
  checked(
    storyboardUpdate.body?.storyboard?.camera === "缓慢推进" &&
      storyboardUpdate.body?.storyboard?.status === "ready",
    "storyboard update mismatch",
    storyboardUpdate.body
  );

  const storyboardList = await authenticated(
    `${root}/storyboards?episodeId=${encodeURIComponent(episode.id)}`
  );
  expectStatus(storyboardList, 200, "storyboard list");
  checked(storyboardList.body?.storyboards?.length === 1, "storyboard list mismatch");

  const voiceoverResult = await authenticated(`${root}/voiceovers`, {
    body: JSON.stringify({
      episodeId: episode.id,
      lineText: "出发。",
      roleElementId: role.id,
      speakerName: "林锋",
      storyboardId: storyboard.id
    }),
    method: "POST"
  });
  expectStatus(voiceoverResult, 201, "voiceover creation");
  const voiceover = voiceoverResult.body?.voiceover;
  checked(voiceover?.storyboardId === storyboard.id, "voiceover relation failed");

  const voiceoverGet = await authenticated(`${root}/voiceovers/${voiceover.id}`);
  expectStatus(voiceoverGet, 200, "voiceover read");
  checked(voiceoverGet.body?.voiceover?.id === voiceover.id, "voiceover read mismatch");

  const voiceoverUpdate = await authenticated(`${root}/voiceovers/${voiceover.id}`, {
    body: JSON.stringify({ lineText: "全体出发。", status: "ready" }),
    method: "PATCH"
  });
  expectStatus(voiceoverUpdate, 200, "voiceover update");
  checked(
    voiceoverUpdate.body?.voiceover?.lineText === "全体出发。" &&
      voiceoverUpdate.body?.voiceover?.status === "ready",
    "voiceover update mismatch",
    voiceoverUpdate.body
  );

  const voiceoverList = await authenticated(
    `${root}/voiceovers?episodeId=${encodeURIComponent(episode.id)}`
  );
  expectStatus(voiceoverList, 200, "voiceover list");
  checked(voiceoverList.body?.voiceovers?.length === 1, "voiceover list mismatch");

  const emptyComposition = await authenticated(`${root}/compositions/${episode.id}`);
  expectStatus(emptyComposition, 200, "empty composition read");
  checked(emptyComposition.body?.composition === null, "empty composition shape failed");
  checked(emptyComposition.body?.revision === 0, "empty composition revision failed");

  const savedComposition = await authenticated(`${root}/compositions/${episode.id}`, {
    body: JSON.stringify({
      revision: 0,
      settings: { aspectRatio: "16:9", resolution: "1080p" },
      timeline: [{ resourceId: storyboard.id, type: "video" }]
    }),
    method: "PUT"
  });
  expectStatus(savedComposition, 200, "composition creation");
  checked(savedComposition.body?.revision === 1, "composition revision increment failed");

  const staleComposition = await authenticated(`${root}/compositions/${episode.id}`, {
    body: JSON.stringify({ revision: 0, settings: {}, timeline: [] }),
    method: "PUT"
  });
  expectStatus(staleComposition, 409, "composition revision conflict");
  checked(
    staleComposition.body?.error?.code === "REVISION_CONFLICT" &&
      staleComposition.body?.revision === 1,
    "composition conflict response mismatch",
    staleComposition.body
  );

  const updatedComposition = await authenticated(`${root}/compositions/${episode.id}`, {
    body: JSON.stringify({
      revision: 1,
      settings: { aspectRatio: "16:9", resolution: "4k" },
      status: "ready",
      timeline: [{ resourceId: storyboard.id, type: "video", volume: 1 }]
    }),
    method: "PUT"
  });
  expectStatus(updatedComposition, 200, "composition update");
  checked(
    updatedComposition.body?.revision === 2 &&
      updatedComposition.body?.composition?.settings?.resolution === "4k",
    "composition update mismatch",
    updatedComposition.body
  );

  const compositionJob = await authenticated(`${root}/generation-jobs`, {
    body: JSON.stringify({
      input: { resolution: "4k" },
      resourceId: updatedComposition.body?.composition?.id,
      resourceType: "composition",
      taskType: "composition_export"
    }),
    method: "POST"
  });
  expectStatus(compositionJob, 201, "composition export job creation");
  checked(
    compositionJob.body?.job?.status === "queued" &&
      compositionJob.body?.job?.episodeId === episode.id,
    "composition export job relation failed",
    compositionJob.body
  );
  await verifyTemporaryInternalToken();

  const jobResult = await authenticated(`${root}/generation-jobs`, {
    body: JSON.stringify({
      input: { apiKey: "must-never-appear-in-export", prompt: storyboard.prompt },
      resourceId: storyboard.id,
      resourceType: "storyboard",
      taskType: "storyboard_image"
    }),
    method: "POST"
  });
  expectStatus(jobResult, 201, "generation job creation");
  checked(jobResult.body?.job?.status === "queued", "job is not queued");
  checked(!jobResult.body?.job?.output, "new job contains fake output");

  const jobs = await authenticated(
    `${root}/generation-jobs?episodeId=${encodeURIComponent(
      episode.id
    )}&resourceType=storyboard&status=queued&taskType=storyboard_image&limit=10`
  );
  expectStatus(jobs, 200, "generation job list");
  checked(jobs.body?.jobs?.length === 1, "generation job filters failed", jobs.body);

  const invalidJob = await authenticated(`${root}/generation-jobs`, {
    body: JSON.stringify({
      resourceId: storyboard.id,
      resourceType: "storyboard",
      taskType: "voiceover_audio"
    }),
    method: "POST"
  });
  expectStatus(invalidJob, 400, "generation job resource validation");
  checked(
    invalidJob.body?.error?.code === "INVALID_TASK_RESOURCE",
    "invalid job error code mismatch",
    invalidJob.body
  );

  const unauthorizedExport = await jsonRequest(`${root}/export`);
  expectStatus(unauthorizedExport, 401, "unauthorized project export");
  checked(
    unauthorizedExport.body?.error?.code === "AUTH_REQUIRED",
    "project export auth error code mismatch",
    unauthorizedExport.body
  );

  const selectiveExport = await authenticated(`${root}/export?sections=project`);
  expectStatus(selectiveExport, 200, "selective project export");
  checked(
    selectiveExport.body?.data?.project?.id === projectId &&
      Object.keys(selectiveExport.body?.data || {}).join(",") === "project",
    "selective project export contains unexpected sections",
    selectiveExport.body
  );

  const fullExport = await authenticated(
    `${root}/export`,
    {
      body: JSON.stringify({
        download: true,
        sections: [
          "project",
          "episodes",
          "elements",
          "storyboards",
          "voiceovers",
          "compositions",
          "generationJobs",
          "uploads"
        ]
      }),
      method: "POST"
    }
  );
  expectStatus(fullExport, 200, "downloadable project export");
  checked(
    fullExport.response.headers
      .get("content-disposition")
      ?.startsWith("attachment;") === true &&
      fullExport.response.headers.get("content-type")?.includes("charset=utf-8") ===
        true,
    "project export download headers missing",
    Object.fromEntries(fullExport.response.headers.entries())
  );
  checked(
    fullExport.body?.data?.project?.id === projectId &&
      fullExport.body?.data?.episodes?.length === 3 &&
      fullExport.body?.data?.roles?.length === 1 &&
      fullExport.body?.data?.scenes?.length === 0 &&
      fullExport.body?.data?.props?.length === 0 &&
      fullExport.body?.data?.storyboards?.length === 1 &&
      fullExport.body?.data?.voiceovers?.length === 1 &&
      fullExport.body?.data?.compositions?.length === 1 &&
      fullExport.body?.data?.generationJobs?.length === 2 &&
      fullExport.body?.data?.uploads?.length === 0,
    "project export is missing production data",
    fullExport.body
  );
  checked(
    !("ownerId" in fullExport.body.data.project) &&
      !("ownerAccount" in fullExport.body.data.project) &&
      !JSON.stringify(fullExport.body).includes("must-never-appear-in-export") &&
      JSON.stringify(fullExport.body).includes("[REDACTED]"),
    "project export leaked ownership metadata or secret values",
    fullExport.body
  );

  const invalidExport = await authenticated(`${root}/export?sections=secrets`);
  expectStatus(invalidExport, 400, "invalid project export sections");
  checked(
    invalidExport.body?.error?.code === "INVALID_EXPORT_SECTIONS",
    "invalid project export section error mismatch",
    invalidExport.body
  );

  const storyboardDelete = await authenticated(
    `${root}/storyboards/${storyboard.id}`,
    { method: "DELETE" }
  );
  expectStatus(storyboardDelete, 200, "storyboard delete");
  checked(storyboardDelete.body?.deleted === true, "storyboard delete failed");
  expectStatus(
    await authenticated(`${root}/storyboards/${storyboard.id}`),
    404,
    "deleted storyboard read"
  );

  const jobsAfterStoryboardDelete = await authenticated(
    `${root}/generation-jobs?resourceType=storyboard`
  );
  expectStatus(jobsAfterStoryboardDelete, 200, "generation job cleanup read");
  checked(
    jobsAfterStoryboardDelete.body?.jobs?.length === 0,
    "storyboard job cleanup failed",
    jobsAfterStoryboardDelete.body
  );

  const compositionJobsAfterStoryboardDelete = await authenticated(
    `${root}/generation-jobs?resourceType=composition`
  );
  expectStatus(
    compositionJobsAfterStoryboardDelete,
    200,
    "composition job preservation read"
  );
  checked(
    compositionJobsAfterStoryboardDelete.body?.jobs?.length === 1,
    "storyboard cleanup removed unrelated composition job",
    compositionJobsAfterStoryboardDelete.body
  );

  const voiceoverAfterStoryboardDelete = await authenticated(
    `${root}/voiceovers/${voiceover.id}`
  );
  expectStatus(
    voiceoverAfterStoryboardDelete,
    200,
    "voiceover preservation after storyboard delete"
  );
  checked(
    !voiceoverAfterStoryboardDelete.body?.voiceover?.storyboardId,
    "storyboard delete left a dangling voiceover reference",
    voiceoverAfterStoryboardDelete.body
  );

  const elementDelete = await authenticated(`${root}/elements/${role.id}`, {
    method: "DELETE"
  });
  expectStatus(elementDelete, 200, "element delete");
  checked(elementDelete.body?.deleted === true, "element delete failed");
  expectStatus(
    await authenticated(`${root}/elements/${role.id}`),
    404,
    "deleted element read"
  );

  const voiceoverAfterElementDelete = await authenticated(
    `${root}/voiceovers/${voiceover.id}`
  );
  expectStatus(
    voiceoverAfterElementDelete,
    200,
    "voiceover preservation after element delete"
  );
  checked(
    !voiceoverAfterElementDelete.body?.voiceover?.roleElementId,
    "element delete left a dangling voiceover reference",
    voiceoverAfterElementDelete.body
  );

  const voiceoverDelete = await authenticated(`${root}/voiceovers/${voiceover.id}`, {
    method: "DELETE"
  });
  expectStatus(voiceoverDelete, 200, "voiceover delete");
  checked(voiceoverDelete.body?.deleted === true, "voiceover delete failed");
  expectStatus(
    await authenticated(`${root}/voiceovers/${voiceover.id}`),
    404,
    "deleted voiceover read"
  );

  const episodeDelete = await authenticated(`${root}/episodes/${episode.id}`, {
    method: "DELETE"
  });
  expectStatus(episodeDelete, 200, "episode delete");
  checked(episodeDelete.body?.deleted === true, "episode delete failed");
  expectStatus(
    await authenticated(`${root}/episodes/${episode.id}`),
    404,
    "deleted episode read"
  );

  for (const [index, concurrentEpisode] of concurrentEpisodes.entries()) {
    const deletion = await authenticated(
      `${root}/episodes/${concurrentEpisode.id}`,
      { method: "DELETE" }
    );
    expectStatus(deletion, 200, `concurrent episode cleanup ${index + 1}`);
    checked(
      deletion.body?.deleted === true,
      `concurrent episode cleanup ${index + 1} failed`
    );
  }

  const finalEpisodes = await authenticated(`${root}/episodes`);
  expectStatus(finalEpisodes, 200, "post-delete episode list");
  checked(finalEpisodes.body?.episodes?.length === 0, "episode cleanup failed");

  const projectDelete = await authenticated(root, { method: "DELETE" });
  expectStatus(projectDelete, 200, "project cleanup");
  const projectAfterDelete = await authenticated(root);
  expectStatus(projectAfterDelete, 404, "project cleanup verification");
  projectCleanupVerified = true;
  projectId = undefined;
} catch (error) {
  auditError = error;
} finally {
  try {
    await cleanupTemporarySubject();
  } catch (error) {
    cleanupError = error;
  }
  await Promise.allSettled([mainPool.end(), newApiPool.end()]);
}

if (auditError || cleanupError) {
  const messages = [
    auditError instanceof Error ? auditError.message : auditError,
    cleanupError instanceof Error ? cleanupError.message : cleanupError
  ].filter(Boolean);

  throw new Error(messages.join("\nCleanup failure:\n"));
}

console.log(
  JSON.stringify({
    apiPrefix,
    baseUrl,
    checks,
    cleanupVerified,
    generationStatus: "queued",
    newApiAccountIsolated: true,
    ok: true,
    principalType: "creator",
    projectCleanupVerified,
    revisionConflict: true
  })
);
