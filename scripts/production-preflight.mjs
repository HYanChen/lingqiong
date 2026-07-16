#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const envPath = process.argv.slice(2).find((value) => value !== "--") || ".env.baota";

function parseEnv(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function isPlaceholder(value) {
  const normalized = String(value || "").toLowerCase();
  return (
    !normalized ||
    normalized.includes("replace-with") ||
    normalized.includes("change-this") ||
    normalized.includes("example") ||
    normalized.includes("local-secret") ||
    normalized.includes("local-password")
  );
}

function hasVariety(value) {
  return /[a-z]/u.test(value) && /[A-Z]/u.test(value) && /\d/u.test(value);
}

if (!existsSync(envPath)) {
  console.error(`未找到生产环境文件：${envPath}`);
  console.error("请复制 .env.baota.example 后填写正式配置。");
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const errors = [];
const warnings = [];
const required = [
  "ADMIN_PASSWORD",
  "ADMIN_SECRET",
  "PLATFORM_AUTH_SECRET",
  "WCU_INTERNAL_SERVICE_SECRET",
  "WCU_PUBLIC_BASE_URL",
  "WCU_INVITE_CODES",
  "NEW_API_SESSION_SECRET",
  "NEW_API_ACCOUNT_BRIDGE_SECRET",
  "WCU_OIDC_CLIENT_SECRET",
  "WCU_OIDC_REDIRECT_URIS",
  "MYSQL_ROOT_PASSWORD",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "BOOKSTACK_DATABASE",
  "BOOKSTACK_APP_KEY"
];

for (const key of required) {
  if (isPlaceholder(env[key])) {
    errors.push(`${key} 未填写正式值`);
  }
}

for (const key of [
  "ADMIN_SECRET",
  "PLATFORM_AUTH_SECRET",
  "WCU_INTERNAL_SERVICE_SECRET",
  "NEW_API_SESSION_SECRET",
  "NEW_API_ACCOUNT_BRIDGE_SECRET",
  "WCU_OIDC_CLIENT_SECRET",
  "MYSQL_ROOT_PASSWORD",
  "MYSQL_PASSWORD"
]) {
  const value = env[key] || "";

  if (value && value.length < 24) {
    errors.push(`${key} 长度至少需要 24 个字符`);
  }
}

if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 12) {
  errors.push("ADMIN_PASSWORD 长度至少需要 12 个字符");
} else if (env.ADMIN_PASSWORD && !hasVariety(env.ADMIN_PASSWORD)) {
  warnings.push("ADMIN_PASSWORD 建议同时包含大小写字母与数字");
}

try {
  const publicUrl = new URL(env.WCU_PUBLIC_BASE_URL || "");

  if (publicUrl.protocol !== "https:" || publicUrl.pathname !== "/") {
    errors.push("WCU_PUBLIC_BASE_URL 必须是只包含正式域名的 HTTPS 地址");
  }

  const redirectUris = (env.WCU_OIDC_REDIRECT_URIS || "")
    .split(/[\s,]+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  const requiredRedirectUris = [
    new URL("/bookstack/oidc/callback", publicUrl).toString(),
    new URL("/oauth/oidc", publicUrl).toString()
  ];

  for (const requiredRedirectUri of requiredRedirectUris) {
    if (!redirectUris.includes(requiredRedirectUri)) {
      errors.push(`WCU_OIDC_REDIRECT_URIS 缺少精确回调：${requiredRedirectUri}`);
    }
  }

  for (const redirectUri of redirectUris) {
    try {
      const parsed = new URL(redirectUri);

      if (
        parsed.protocol !== "https:" ||
        parsed.origin !== publicUrl.origin ||
        parsed.username ||
        parsed.password ||
        parsed.hash
      ) {
        errors.push(`OIDC 回调必须是正式域名下的 HTTPS 精确地址：${redirectUri}`);
      }
    } catch {
      errors.push(`OIDC 回调地址无效：${redirectUri}`);
    }
  }
} catch {
  errors.push("WCU_PUBLIC_BASE_URL 不是有效网址");
}

if (
  env.BOOKSTACK_APP_KEY &&
  !/^base64:[A-Za-z0-9+/]{43}=$/u.test(env.BOOKSTACK_APP_KEY)
) {
  errors.push("BOOKSTACK_APP_KEY 必须是 base64: 开头的 32 字节密钥");
}

const secretKeys = [
  "ADMIN_SECRET",
  "PLATFORM_AUTH_SECRET",
  "WCU_INTERNAL_SERVICE_SECRET",
  "NEW_API_SESSION_SECRET",
  "NEW_API_ACCOUNT_BRIDGE_SECRET",
  "WCU_OIDC_CLIENT_SECRET",
  "MYSQL_ROOT_PASSWORD",
  "MYSQL_PASSWORD"
];
const secretValues = secretKeys.map((key) => env[key]).filter(Boolean);

if (new Set(secretValues).size !== secretValues.length) {
  errors.push("不同服务必须使用不同的密钥或数据库密码");
}

if ((env.WCU_INVITE_CODES || "").split(",").some((code) => code.trim().length < 10)) {
  errors.push("每个 WCU_INVITE_CODES 邀请码至少需要 10 个字符");
}

for (const warning of warnings) {
  console.warn(`警告：${warning}`);
}

if (errors.length) {
  for (const error of errors) {
    console.error(`失败：${error}`);
  }

  console.error(`生产上线预检未通过，共 ${errors.length} 项。`);
  process.exit(1);
}

console.log("生产上线预检通过：必填配置、密钥强度与服务隔离配置均符合要求。");
