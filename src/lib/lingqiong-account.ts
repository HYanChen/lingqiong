import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

import { oidcClaimsFromSession } from "@/lib/oidc-provider";
import type { PlatformSessionUser } from "@/lib/platform-auth";
import { writeDatabase } from "@/lib/database";

const INTERNAL_TOKEN_NAME = "灵穹创作平台内部调用";
const INTERNAL_TOKEN_CACHE_MS = 10 * 60 * 1000;
const NEW_API_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_QUOTA_PER_UNIT = 500_000;

type NewApiUserRow = RowDataPacket & {
  access_token: string | null;
  created_at: number | null;
  display_name: string | null;
  email: string | null;
  group: string | null;
  id: number;
  last_login_at: number | null;
  oidc_id: string | null;
  quota: number;
  request_count: number;
  status: number;
  used_quota: number;
  username: string | null;
};

type NewApiTokenSummary = {
  id?: number;
  name?: string;
  status?: number;
};

type NewApiPayload = {
  data?: unknown;
  message?: string;
  success?: boolean;
  url?: string;
};

export type LingqiongCurrencyConfig = {
  customCurrencyExchangeRate: number;
  customCurrencySymbol: string;
  quotaDisplayType: string;
  quotaPerUnit: number;
  usdExchangeRate: number;
};

export type LingqiongApiAccount = {
  balanceLabel: string;
  createdAt: string | null;
  displayName: string;
  email: string;
  group: string;
  id: number;
  lastLoginAt: string | null;
  quota: number;
  requestCount: number;
  status: "active" | "disabled";
  usedLabel: string;
  usedQuota: number;
  username: string;
};

export type LingqiongAccountState = {
  account: LingqiongApiAccount | null;
  connected: boolean;
  currency: LingqiongCurrencyConfig;
  modelAccess: {
    allowed: boolean;
    code: string;
    message: string;
    rechargeUrl: string;
  };
};

export type LingqiongModelAccess = LingqiongAccountState & {
  account: LingqiongApiAccount;
  apiKey: string;
  newApiTokenId: number;
  principalId: string;
};

export class LingqiongAccountError extends Error {
  code: string;
  rechargeUrl: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "LingqiongAccountError";
    this.code = code;
    this.rechargeUrl = "/account/billing";
    this.status = status;
  }
}

let newApiPool: Pool | null = null;
const internalModelTokenCache = new Map<
  number,
  { apiKey: string; expiresAt: number; tokenId: number }
>();

function newApiDatabaseName() {
  return process.env.NEW_API_MYSQL_DATABASE?.trim() || "new_api";
}

function getNewApiPool() {
  if (process.env.PLATFORM_RUNTIME_ROLE === "web") {
    throw new LingqiongAccountError(
      "API_ACCOUNT_SERVICE_UNAVAILABLE",
      "灵穹 API 账户服务只能由平台 API 访问。",
      503
    );
  }

  newApiPool ??= mysql.createPool({
    charset: "utf8mb4",
    connectionLimit: 6,
    database: newApiDatabaseName(),
    host:
      process.env.MYSQL_HOST ||
      (process.env.NODE_ENV === "production" ? "mysql" : "127.0.0.1"),
    password: process.env.MYSQL_PASSWORD || "zhanji-local-password",
    port: Number(process.env.MYSQL_PORT || 3306),
    supportBigNumbers: true,
    timezone: "Z",
    user: process.env.MYSQL_USER || "zhanji",
    waitForConnections: true
  });

  return newApiPool;
}

function newApiServerBaseUrl() {
  return (process.env.NEW_API_SERVER_BASE_URL || "http://new-api:3000").replace(
    /\/+$/u,
    ""
  );
}

function bridgeSecret() {
  return (
    process.env.NEW_API_ACCOUNT_BRIDGE_SECRET ||
    process.env.PLATFORM_AUTH_SECRET ||
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "lingqiong-local-account-bridge"
  );
}

function principalForSession(session: PlatformSessionUser) {
  if (
    session.role !== "creator" ||
    session.source === "admin" ||
    !session.id
  ) {
    throw new LingqiongAccountError(
      "API_CREATOR_ACCOUNT_REQUIRED",
      "请使用普通用户账号进入灵穹 API 用户端。",
      403
    );
  }

  const claims = oidcClaimsFromSession(session);

  return {
    oidcSubject: claims.sub,
    principalId: session.id,
    principalType: "creator"
  };
}

function isoFromUnix(value: number | null) {
  return value && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function defaultCurrencyConfig(): LingqiongCurrencyConfig {
  return {
    customCurrencyExchangeRate: 1,
    customCurrencySymbol: "¤",
    quotaDisplayType: "CNY",
    quotaPerUnit: DEFAULT_QUOTA_PER_UNIT,
    usdExchangeRate: 7.3
  };
}

async function getCurrencyConfig() {
  try {
    const response = await fetch(`${newApiServerBaseUrl()}/api/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(NEW_API_REQUEST_TIMEOUT_MS)
    });
    const payload = (await response.json()) as NewApiPayload;
    const data =
      payload.data && typeof payload.data === "object"
        ? (payload.data as Record<string, unknown>)
        : {};
    const defaults = defaultCurrencyConfig();

    if (!response.ok || payload.success === false) {
      return defaults;
    }

    return {
      customCurrencyExchangeRate: numberValue(
        data.custom_currency_exchange_rate,
        defaults.customCurrencyExchangeRate
      ),
      customCurrencySymbol: stringValue(
        data.custom_currency_symbol,
        defaults.customCurrencySymbol
      ),
      quotaDisplayType: stringValue(
        data.quota_display_type,
        defaults.quotaDisplayType
      ).toUpperCase(),
      quotaPerUnit: Math.max(
        1,
        numberValue(data.quota_per_unit, defaults.quotaPerUnit)
      ),
      usdExchangeRate: numberValue(
        data.usd_exchange_rate,
        defaults.usdExchangeRate
      )
    } satisfies LingqiongCurrencyConfig;
  } catch {
    return defaultCurrencyConfig();
  }
}

function formatQuota(quota: number, config: LingqiongCurrencyConfig) {
  const units = quota / config.quotaPerUnit;

  if (config.quotaDisplayType === "TOKENS") {
    return `${Math.max(0, Math.round(quota)).toLocaleString("zh-CN")} 点`;
  }

  if (config.quotaDisplayType === "USD") {
    return `$${Math.max(0, units).toFixed(2)}`;
  }

  if (config.quotaDisplayType === "CUSTOM") {
    return `${config.customCurrencySymbol}${Math.max(
      0,
      units * config.customCurrencyExchangeRate
    ).toFixed(2)}`;
  }

  return `¥${Math.max(0, units * config.usdExchangeRate).toFixed(2)}`;
}

function mapAccount(
  row: NewApiUserRow,
  currency: LingqiongCurrencyConfig
): LingqiongApiAccount {
  return {
    balanceLabel: formatQuota(numberValue(row.quota), currency),
    createdAt: isoFromUnix(numberValue(row.created_at) || null),
    displayName: row.display_name || row.username || "灵穹用户",
    email: row.email || "",
    group: row.group || "default",
    id: numberValue(row.id),
    lastLoginAt: isoFromUnix(numberValue(row.last_login_at) || null),
    quota: numberValue(row.quota),
    requestCount: numberValue(row.request_count),
    status: numberValue(row.status) === 1 ? "active" : "disabled",
    usedLabel: formatQuota(numberValue(row.used_quota), currency),
    usedQuota: numberValue(row.used_quota),
    username: row.username || ""
  };
}

async function findNewApiUser(oidcSubject: string) {
  const [rows] = await getNewApiPool().execute<NewApiUserRow[]>(
    `SELECT id, username, display_name, email, oidc_id, access_token, quota,
      used_quota, request_count, status, \`group\`, created_at, last_login_at
     FROM users
     WHERE oidc_id = ? AND deleted_at IS NULL
     ORDER BY id ASC
     LIMIT 1`,
    [oidcSubject]
  );

  return rows[0] ?? null;
}

async function upsertAccountLink(
  session: PlatformSessionUser,
  user: NewApiUserRow | null,
  status: "active" | "disabled" | "error" | "pending",
  internalTokenId?: number | null
) {
  const principal = principalForSession(session);
  const now = new Date().toISOString();

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO api_account_links (
        id, principal_type, principal_id, oidc_subject, new_api_user_id,
        internal_token_id, link_status, last_verified_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        principal_type = VALUES(principal_type),
        principal_id = VALUES(principal_id),
        oidc_subject = VALUES(oidc_subject),
        new_api_user_id = VALUES(new_api_user_id),
        internal_token_id = COALESCE(VALUES(internal_token_id), internal_token_id),
        link_status = VALUES(link_status),
        last_verified_at = VALUES(last_verified_at),
        updated_at = VALUES(updated_at)`,
      [
        randomUUID(),
        principal.principalType,
        principal.principalId,
        principal.oidcSubject,
        user?.id ?? null,
        internalTokenId ?? null,
        status,
        now,
        now,
        now
      ]
    );
  });
}

async function resolveNewApiUser(session: PlatformSessionUser) {
  const principal = principalForSession(session);

  try {
    const user = await findNewApiUser(principal.oidcSubject);
    await upsertAccountLink(
      session,
      user,
      !user ? "pending" : numberValue(user.status) === 1 ? "active" : "disabled"
    );
    return user;
  } catch {
    await upsertAccountLink(session, null, "error").catch(() => null);
    throw new LingqiongAccountError(
      "API_ACCOUNT_SERVICE_UNAVAILABLE",
      "灵穹 API 账户服务暂时不可用，请稍后重试。",
      503
    );
  }
}

async function ensureBridgeAccessToken(user: NewApiUserRow) {
  if (user.access_token?.trim()) {
    return user.access_token.trim();
  }

  const generated = createHmac("sha256", bridgeSecret())
    .update(`new-api-user-access:${user.id}:${user.oidc_id ?? ""}`)
    .digest("hex")
    .slice(0, 32);

  await getNewApiPool().execute(
    `UPDATE users
     SET access_token = ?
     WHERE id = ? AND (access_token IS NULL OR access_token = '')`,
    [generated, user.id]
  );
  const [rows] = await getNewApiPool().execute<NewApiUserRow[]>(
    `SELECT id, username, display_name, email, oidc_id, access_token, quota,
      used_quota, request_count, status, \`group\`, created_at, last_login_at
     FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [user.id]
  );
  const accessToken = rows[0]?.access_token?.trim();

  if (!accessToken) {
    throw new LingqiongAccountError(
      "API_ACCOUNT_BRIDGE_FAILED",
      "灵穹 API 账户连接失败，请重新登录后重试。",
      503
    );
  }

  return accessToken;
}

async function newApiUserRequest(
  user: NewApiUserRow,
  path: string,
  options: { body?: unknown; method?: "GET" | "POST" | "PUT" } = {}
) {
  const accessToken = await ensureBridgeAccessToken(user);
  let response: Response;

  try {
    response = await fetch(`${newApiServerBaseUrl()}${path}`, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: accessToken,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        "New-Api-User": String(user.id),
        "X-WCU-Account-Bridge": "1"
      },
      method: options.method || "GET",
      redirect: "error",
      signal: AbortSignal.timeout(NEW_API_REQUEST_TIMEOUT_MS)
    });
  } catch {
    throw new LingqiongAccountError(
      "API_ACCOUNT_UPSTREAM_UNAVAILABLE",
      "灵穹 API 暂时不可用，请稍后重试。",
      503
    );
  }

  const payload = (await response.json().catch(() => null)) as NewApiPayload | null;

  if (!response.ok || !payload) {
    throw new LingqiongAccountError(
      "API_ACCOUNT_UPSTREAM_ERROR",
      "灵穹 API 返回异常，请稍后重试。",
      response.status >= 400 ? response.status : 502
    );
  }

  if (payload.success === false || payload.message === "error") {
    const detail =
      typeof payload.data === "string" ? payload.data : payload.message || "请求失败";
    throw new LingqiongAccountError(
      "API_ACCOUNT_OPERATION_FAILED",
      String(detail).slice(0, 500),
      400
    );
  }

  return payload;
}

function payloadItems(payload: NewApiPayload) {
  const data = payload.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const items = (data as Record<string, unknown>).items;
    return Array.isArray(items) ? items : [];
  }

  return [];
}

async function ensureInternalModelToken(
  session: PlatformSessionUser,
  user: NewApiUserRow
) {
  const cached = internalModelTokenCache.get(user.id);

  if (cached && cached.expiresAt > Date.now()) {
    return { apiKey: cached.apiKey, tokenId: cached.tokenId };
  }

  internalModelTokenCache.delete(user.id);

  const listTokens = async () => {
    const payload = await newApiUserRequest(user, "/api/token/?p=1&size=100");
    return payloadItems(payload) as NewApiTokenSummary[];
  };
  let token = (await listTokens()).find(
    (item) => item.name === INTERNAL_TOKEN_NAME && item.status === 1
  );

  if (!token?.id) {
    await newApiUserRequest(user, "/api/token/", {
      body: {
        allow_ips: "",
        cross_group_retry: false,
        expired_time: -1,
        group: "",
        model_limits: "",
        model_limits_enabled: false,
        name: INTERNAL_TOKEN_NAME,
        remain_quota: 0,
        unlimited_quota: true
      },
      method: "POST"
    });
    token = (await listTokens()).find(
      (item) => item.name === INTERNAL_TOKEN_NAME && item.status === 1
    );
  }

  if (!token?.id) {
    throw new LingqiongAccountError(
      "API_MODEL_TOKEN_UNAVAILABLE",
      "无法建立灵穹 API 模型调用凭证，请稍后重试。",
      503
    );
  }

  const keyPayload = await newApiUserRequest(user, `/api/token/${token.id}/key`, {
    method: "POST"
  });
  const keyData =
    keyPayload.data && typeof keyPayload.data === "object"
      ? (keyPayload.data as Record<string, unknown>)
      : {};
  const rawKey = stringValue(keyData.key).replace(/^sk-/u, "");

  if (!rawKey) {
    throw new LingqiongAccountError(
      "API_MODEL_TOKEN_UNAVAILABLE",
      "灵穹 API 模型调用凭证不可用，请稍后重试。",
      503
    );
  }

  await upsertAccountLink(session, user, "active", token.id);

  internalModelTokenCache.set(user.id, {
    apiKey: `sk-${rawKey}`,
    expiresAt: Date.now() + INTERNAL_TOKEN_CACHE_MS,
    tokenId: token.id
  });

  return { apiKey: `sk-${rawKey}`, tokenId: token.id };
}

export async function getLingqiongAccountState(
  session: PlatformSessionUser
): Promise<LingqiongAccountState> {
  const [user, currency] = await Promise.all([
    resolveNewApiUser(session),
    getCurrencyConfig()
  ]);

  if (!user) {
    return {
      account: null,
      connected: false,
      currency,
      modelAccess: {
        allowed: false,
        code: "API_ACCOUNT_REQUIRED",
        message: "请先开通并登录灵穹 API 账户。",
        rechargeUrl: "/account/billing"
      }
    };
  }

  const account = mapAccount(user, currency);

  if (account.status !== "active") {
    return {
      account,
      connected: true,
      currency,
      modelAccess: {
        allowed: false,
        code: "API_ACCOUNT_DISABLED",
        message: "灵穹 API 账户已停用，请联系管理员。",
        rechargeUrl: "/account/billing"
      }
    };
  }

  if (account.quota <= 0) {
    return {
      account,
      connected: true,
      currency,
      modelAccess: {
        allowed: false,
        code: "API_BALANCE_REQUIRED",
        message: "请先充值灵穹 API 账户后再使用模型功能。",
        rechargeUrl: "/account/billing"
      }
    };
  }

  return {
    account,
    connected: true,
    currency,
    modelAccess: {
      allowed: true,
      code: "API_MODEL_ACCESS_READY",
      message: "灵穹 API 账户余额可用。",
      rechargeUrl: "/account/billing"
    }
  };
}

export async function requireLingqiongModelAccess(
  session: PlatformSessionUser
): Promise<LingqiongModelAccess> {
  const state = await getLingqiongAccountState(session);

  if (!state.connected || !state.account || !state.modelAccess.allowed) {
    throw new LingqiongAccountError(
      state.modelAccess.code,
      state.modelAccess.message,
      state.modelAccess.code === "API_ACCOUNT_DISABLED" ? 403 : 402
    );
  }

  const user = await findNewApiUser(principalForSession(session).oidcSubject);

  if (!user) {
    throw new LingqiongAccountError(
      "API_ACCOUNT_REQUIRED",
      "请先开通并登录灵穹 API 账户。",
      402
    );
  }

  const token = await ensureInternalModelToken(session, user);

  return {
    ...state,
    account: state.account,
    apiKey: token.apiKey,
    newApiTokenId: token.tokenId,
    principalId: principalForSession(session).principalId
  };
}

function sanitizedPaymentSettings(value: unknown) {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const paymentMethods = Array.isArray(input.pay_methods)
    ? input.pay_methods
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const method = item as Record<string, unknown>;
          return {
            color: stringValue(method.color),
            minTopup: numberValue(method.min_topup),
            name: stringValue(method.name, stringValue(method.type)),
            type: stringValue(method.type)
          };
        })
        .filter((item) => item.type)
    : [];

  return {
    amountOptions: Array.isArray(input.amount_options)
      ? input.amount_options.map((item) => numberValue(item)).filter((item) => item > 0)
      : [],
    complianceConfirmed: Boolean(input.payment_compliance_confirmed),
    enableOnlineTopup: Boolean(input.enable_online_topup),
    enableRedemption: Boolean(input.enable_redemption),
    minTopup: numberValue(input.min_topup, 1),
    paymentMethods
  };
}

export async function getLingqiongBilling(session: PlatformSessionUser) {
  const state = await getLingqiongAccountState(session);

  if (!state.connected) {
    return {
      ...state,
      orders: [],
      settings: {
        amountOptions: [],
        complianceConfirmed: false,
        enableOnlineTopup: false,
        enableRedemption: false,
        minTopup: 1,
        paymentMethods: []
      }
    };
  }

  const user = await findNewApiUser(principalForSession(session).oidcSubject);

  if (!user) {
    throw new LingqiongAccountError(
      "API_ACCOUNT_REQUIRED",
      "请先开通灵穹 API 账户。",
      402
    );
  }

  const [settingsPayload, ordersPayload] = await Promise.all([
    newApiUserRequest(user, "/api/user/topup/info"),
    newApiUserRequest(user, "/api/user/topup/self?p=1&size=20")
  ]);

  return {
    ...state,
    orders: payloadItems(ordersPayload).map((item) => {
      const order = item as Record<string, unknown>;
      return {
        amount: numberValue(order.amount),
        completeTime: numberValue(order.complete_time) || null,
        createTime: numberValue(order.create_time) || null,
        money: numberValue(order.money),
        paymentMethod: stringValue(order.payment_method),
        paymentProvider: stringValue(order.payment_provider),
        status: stringValue(order.status),
        tradeNo: stringValue(order.trade_no)
      };
    }),
    settings: sanitizedPaymentSettings(settingsPayload.data)
  };
}

function validTopupAmount(value: unknown) {
  const amount = Number(value);

  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000) {
    throw new LingqiongAccountError(
      "INVALID_TOPUP_AMOUNT",
      "充值数量必须是 1 至 1000000 之间的整数。",
      400
    );
  }

  return amount;
}

function paymentEndpoint(method: string, action: "amount" | "pay") {
  if (method === "stripe") {
    return `/api/user/stripe/${action}`;
  }

  if (method === "waffo") {
    return `/api/user/waffo/${action}`;
  }

  if (method === "waffo_pancake" || method === "waffo-pancake") {
    return `/api/user/waffo-pancake/${action}`;
  }

  if (method === "creem" && action === "pay") {
    return "/api/user/creem/pay";
  }

  return action === "amount" ? "/api/user/amount" : "/api/user/pay";
}

async function billingUser(session: PlatformSessionUser) {
  const user = await resolveNewApiUser(session);

  if (!user) {
    throw new LingqiongAccountError(
      "API_ACCOUNT_REQUIRED",
      "请先开通并登录灵穹 API 账户。",
      402
    );
  }

  if (numberValue(user.status) !== 1) {
    throw new LingqiongAccountError(
      "API_ACCOUNT_DISABLED",
      "灵穹 API 账户已停用，请联系管理员。",
      403
    );
  }

  return user;
}

export async function quoteLingqiongTopup(
  session: PlatformSessionUser,
  input: { amount: unknown; paymentMethod: unknown }
) {
  const amount = validTopupAmount(input.amount);
  const paymentMethod = stringValue(input.paymentMethod).trim();

  if (!paymentMethod || paymentMethod.length > 80) {
    throw new LingqiongAccountError(
      "INVALID_PAYMENT_METHOD",
      "请选择有效的支付方式。",
      400
    );
  }

  const user = await billingUser(session);
  const payload = await newApiUserRequest(
    user,
    paymentEndpoint(paymentMethod, "amount"),
    {
      body: { amount, payment_method: paymentMethod },
      method: "POST"
    }
  );
  const payable = numberValue(payload.data, Number.NaN);

  if (!Number.isFinite(payable) || payable <= 0) {
    throw new LingqiongAccountError(
      "PAYMENT_QUOTE_INVALID",
      "支付金额计算失败，请检查充值数量。",
      400
    );
  }

  return { amount, payable, paymentMethod };
}

function paymentUrlFromPayload(payload: NewApiPayload) {
  const data = payload.data;
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const candidate =
    stringValue(record.pay_link) ||
    stringValue(record.checkout_url) ||
    stringValue(record.payment_url) ||
    stringValue(payload.url);

  if (!candidate) {
    return "";
  }

  try {
    const url = new URL(candidate);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    if (payload.url && data && typeof data === "object") {
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === "string" || typeof value === "number") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  } catch {
    return "";
  }
}

export async function createLingqiongPayment(
  session: PlatformSessionUser,
  input: { amount: unknown; paymentMethod: unknown }
) {
  const quote = await quoteLingqiongTopup(session, input);
  const user = await billingUser(session);
  const publicBase = (process.env.WCU_PUBLIC_BASE_URL || "http://localhost").replace(
    /\/+$/u,
    ""
  );
  const payload = await newApiUserRequest(
    user,
    paymentEndpoint(quote.paymentMethod, "pay"),
    {
      body: {
        amount: quote.amount,
        cancel_url: `${publicBase}/account/billing?payment=cancelled`,
        payment_method: quote.paymentMethod,
        success_url: `${publicBase}/account/billing?payment=success`
      },
      method: "POST"
    }
  );
  const paymentUrl = paymentUrlFromPayload(payload);

  if (!paymentUrl) {
    throw new LingqiongAccountError(
      "PAYMENT_URL_MISSING",
      "支付渠道没有返回可用的收银台地址，请联系管理员检查配置。",
      503
    );
  }

  return { ...quote, paymentUrl };
}

export async function redeemLingqiongCode(
  session: PlatformSessionUser,
  rawCode: unknown
) {
  const code = stringValue(rawCode).trim();

  if (!/^[A-Za-z0-9_-]{4,191}$/u.test(code)) {
    throw new LingqiongAccountError(
      "INVALID_REDEMPTION_CODE",
      "请输入有效的兑换码。",
      400
    );
  }

  const user = await billingUser(session);
  const payload = await newApiUserRequest(user, "/api/user/topup", {
    body: { key: code },
    method: "POST"
  });

  return { creditedQuota: numberValue(payload.data) };
}

export async function beginModelBillingAudit(input: {
  access: LingqiongModelAccess;
  capability: string;
  generationJobId?: string;
  model?: string;
  projectId?: string;
  requestId?: string;
}) {
  const id = randomUUID();
  const requestId = input.requestId || randomUUID();
  const now = new Date().toISOString();

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO model_billing_audits (
        id, request_id, principal_id, new_api_user_id, new_api_token_id,
        project_id, generation_job_id, capability, model, status,
        quota_before, quota_after, quota_charged, error_code, created_at, completed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'started', ?, NULL, NULL, NULL, ?, NULL)`,
      [
        id,
        requestId,
        input.access.principalId,
        input.access.account.id,
        input.access.newApiTokenId,
        input.projectId ?? null,
        input.generationJobId ?? null,
        input.capability.slice(0, 80),
        input.model?.slice(0, 255) ?? null,
        input.access.account.quota,
        now
      ]
    );
  });

  return { id, requestId };
}

export async function completeModelBillingAudit(
  auditId: string,
  input: { errorCode?: string; newApiUserId: number; status: "failed" | "succeeded" }
) {
  const [rows] = await getNewApiPool().execute<NewApiUserRow[]>(
    `SELECT id, username, display_name, email, oidc_id, access_token, quota,
      used_quota, request_count, status, \`group\`, created_at, last_login_at
     FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [input.newApiUserId]
  );
  const quotaAfter = rows[0] ? numberValue(rows[0].quota) : null;
  const completedAt = new Date().toISOString();

  await writeDatabase(async (db) => {
    await db.execute(
      `UPDATE model_billing_audits
       SET status = ?, quota_after = ?,
         quota_charged = CASE
           WHEN ? IS NULL THEN NULL
           ELSE GREATEST(quota_before - ?, 0)
         END,
         error_code = ?, completed_at = ?
       WHERE id = ? AND status = 'started'`,
      [
        input.status,
        quotaAfter,
        quotaAfter,
        quotaAfter ?? 0,
        input.errorCode?.slice(0, 120) ?? null,
        completedAt,
        auditId
      ]
    );
  });
}
