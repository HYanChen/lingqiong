import "server-only";

import {
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify
} from "node:crypto";

import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

import { readDatabase, writeDatabase } from "@/lib/database";

const API_BASE = "https://api.mch.weixin.qq.com";
const REQUEST_TIMEOUT_MS = 15_000;

type PaymentOrderRow = {
  amount_fen: number;
  code_url: string | null;
  created_at: string;
  new_api_user_id: number;
  paid_at: string | null;
  principal_id: string;
  quota_amount: number;
  status: string;
  trade_no: string;
  transaction_id: string | null;
  updated_at: string;
};

type WechatNotifyResource = {
  algorithm?: string;
  associated_data?: string;
  ciphertext?: string;
  nonce?: string;
};

type WechatNotifyBody = {
  id?: string;
  resource?: WechatNotifyResource;
};

type DecryptedTransaction = {
  amount?: { payer_total?: number; total?: number };
  appid?: string;
  attach?: string;
  mchid?: string;
  out_trade_no?: string;
  trade_state?: string;
  transaction_id?: string;
};

let creditPool: Pool | null = null;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少微信支付配置：${name}`);
  return value;
}

function privateKeyPem() {
  return required("WECHAT_PAY_PRIVATE_KEY").replaceAll("\\n", "\n");
}

function publicKeyPem() {
  return required("WECHAT_PAY_PUBLIC_KEY").replaceAll("\\n", "\n");
}

function apiV3Key() {
  const key = required("WECHAT_PAY_API_V3_KEY");
  if (Buffer.byteLength(key, "utf8") !== 32) {
    throw new Error("微信支付 API v3 密钥必须为 32 字节。");
  }
  return key;
}

function platformDatabaseName() {
  const value = process.env.MYSQL_DATABASE?.trim() || "zhanji_universe";
  if (!/^[A-Za-z0-9_]+$/u.test(value)) throw new Error("平台数据库名不安全。");
  return value;
}

function getCreditPool() {
  creditPool ??= mysql.createPool({
    charset: "utf8mb4",
    connectionLimit: 3,
    database: process.env.NEW_API_MYSQL_DATABASE?.trim() || "new_api",
    host: process.env.MYSQL_HOST || (process.env.NODE_ENV === "production" ? "mysql" : "127.0.0.1"),
    password: process.env.MYSQL_PASSWORD || "zhanji-local-password",
    port: Number(process.env.MYSQL_PORT || 3306),
    supportBigNumbers: true,
    timezone: "Z",
    user: process.env.MYSQL_USER || "zhanji",
    waitForConnections: true
  });
  return creditPool;
}

export function wechatPayConfigured() {
  return Boolean(
    process.env.WECHAT_PAY_ENABLED === "true" &&
      process.env.WECHAT_PAY_APP_ID?.trim() &&
      process.env.WECHAT_PAY_MCH_ID?.trim() &&
      process.env.WECHAT_PAY_MCH_SERIAL_NO?.trim() &&
      process.env.WECHAT_PAY_PRIVATE_KEY?.trim() &&
      process.env.WECHAT_PAY_API_V3_KEY?.trim() &&
      process.env.WECHAT_PAY_PUBLIC_KEY_ID?.trim() &&
      process.env.WECHAT_PAY_PUBLIC_KEY?.trim()
  );
}

function authorization(method: string, pathname: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("hex");
  const message = `${method}\n${pathname}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = sign("RSA-SHA256", Buffer.from(message), createPrivateKey(privateKeyPem())).toString("base64");
  return `WECHATPAY2-SHA256-RSA2048 mchid="${required("WECHAT_PAY_MCH_ID")}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${required("WECHAT_PAY_MCH_SERIAL_NO")}",signature="${signature}"`;
}

async function wechatRequest<T>(method: "GET" | "POST", pathname: string, payload?: unknown) {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const response = await fetch(`${API_BASE}${pathname}`, {
    body: method === "GET" ? undefined : body,
    headers: {
      Accept: "application/json",
      Authorization: authorization(method, pathname, body),
      ...(method === "POST" ? { "Content-Type": "application/json" } : {})
    },
    method,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const result = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !result) {
    throw new Error(`微信支付请求失败（${response.status}）。`);
  }
  return result;
}

function newTradeNo() {
  return `LQ${Date.now().toString(36)}${randomBytes(6).toString("hex")}`.slice(0, 32);
}

export async function createWechatNativeOrder(input: {
  amountFen: number;
  newApiUserId: number;
  principalId: string;
  quotaAmount: number;
}) {
  if (!wechatPayConfigured()) throw new Error("微信支付尚未配置完整。");
  const tradeNo = newTradeNo();
  const now = new Date().toISOString();
  const publicBase = required("WCU_PUBLIC_BASE_URL").replace(/\/+$/u, "");

  await writeDatabase((db) =>
    db.execute(
      `INSERT INTO wechat_pay_orders
       (trade_no, principal_id, new_api_user_id, quota_amount, amount_fen, status,
        code_url, transaction_id, notify_id, paid_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, ?, ?)`,
      [tradeNo, input.principalId, input.newApiUserId, input.quotaAmount, input.amountFen, now, now]
    )
  );

  const result = await wechatRequest<{ code_url?: string }>("POST", "/v3/pay/transactions/native", {
    amount: { currency: "CNY", total: input.amountFen },
    appid: required("WECHAT_PAY_APP_ID"),
    attach: `lingqiong:${input.newApiUserId}`,
    description: "灵穹 API 资源额度充值",
    mchid: required("WECHAT_PAY_MCH_ID"),
    notify_url: `${publicBase}/_wcu-api/payments/wechat/notify`,
    out_trade_no: tradeNo,
    time_expire: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  });
  if (!result.code_url) throw new Error("微信支付未返回付款二维码。");
  const codeUrl = result.code_url;

  await writeDatabase((db) =>
    db.execute("UPDATE wechat_pay_orders SET code_url = ?, updated_at = ? WHERE trade_no = ?", [codeUrl, new Date().toISOString(), tradeNo])
  );
  return { codeUrl, tradeNo };
}

export async function getWechatOrder(tradeNo: string, principalId?: string) {
  return readDatabase((db) =>
    db.first<PaymentOrderRow>(
      `SELECT trade_no, principal_id, new_api_user_id, quota_amount, amount_fen,
              status, code_url, transaction_id, paid_at, created_at, updated_at
       FROM wechat_pay_orders WHERE trade_no = ?${principalId ? " AND principal_id = ?" : ""} LIMIT 1`,
      principalId ? [tradeNo, principalId] : [tradeNo]
    )
  );
}

export async function listWechatOrders(principalId: string, limit = 20) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  return readDatabase((db) =>
    db.rows<PaymentOrderRow>(
      `SELECT trade_no, principal_id, new_api_user_id, quota_amount, amount_fen,
              status, code_url, transaction_id, paid_at, created_at, updated_at
       FROM wechat_pay_orders WHERE principal_id = ?
       ORDER BY created_at DESC LIMIT ${safeLimit}`,
      [principalId]
    )
  );
}

export function verifyWechatNotifySignature(headers: Headers, rawBody: string) {
  const timestamp = headers.get("wechatpay-timestamp") || "";
  const nonce = headers.get("wechatpay-nonce") || "";
  const signature = headers.get("wechatpay-signature") || "";
  const serial = headers.get("wechatpay-serial") || "";
  if (!timestamp || !nonce || !signature || serial !== required("WECHAT_PAY_PUBLIC_KEY_ID")) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  return verify(
    "RSA-SHA256",
    Buffer.from(`${timestamp}\n${nonce}\n${rawBody}\n`),
    createPublicKey(publicKeyPem()),
    Buffer.from(signature, "base64")
  );
}

function decryptResource(resource: WechatNotifyResource) {
  if (resource.algorithm !== "AEAD_AES_256_GCM" || !resource.ciphertext || !resource.nonce) {
    throw new Error("微信支付回调加密格式不正确。");
  }
  const encrypted = Buffer.from(resource.ciphertext, "base64");
  const authTag = encrypted.subarray(encrypted.length - 16);
  const data = encrypted.subarray(0, -16);
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(apiV3Key()), Buffer.from(resource.nonce));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(resource.associated_data || ""));
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")) as DecryptedTransaction;
}

export async function handleWechatPaymentNotify(rawBody: string) {
  const body = JSON.parse(rawBody) as WechatNotifyBody;
  const transaction = decryptResource(body.resource || {});
  const tradeNo = transaction.out_trade_no || "";
  if (!tradeNo || transaction.trade_state !== "SUCCESS") return;

  const dbName = platformDatabaseName();
  const connection = await getCreditPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<(PaymentOrderRow & RowDataPacket)[]>(
      `SELECT * FROM \`${dbName}\`.wechat_pay_orders WHERE trade_no = ? FOR UPDATE`,
      [tradeNo]
    );
    const order = rows[0];
    if (!order) throw new Error("微信支付订单不存在。");
    if (order.status === "paid") {
      await connection.commit();
      return;
    }
    if (
      transaction.mchid !== required("WECHAT_PAY_MCH_ID") ||
      transaction.appid !== required("WECHAT_PAY_APP_ID") ||
      Number(transaction.amount?.total) !== Number(order.amount_fen)
    ) {
      throw new Error("微信支付订单金额或商户身份不匹配。");
    }
    await connection.execute("UPDATE users SET quota = quota + ? WHERE id = ? AND status = 1", [order.quota_amount, order.new_api_user_id]);
    await connection.execute(
      `UPDATE \`${dbName}\`.wechat_pay_orders
       SET status='paid', transaction_id=?, notify_id=?, paid_at=?, updated_at=?
       WHERE trade_no=? AND status='pending'`,
      [transaction.transaction_id || null, body.id || null, new Date().toISOString(), new Date().toISOString(), tradeNo]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
