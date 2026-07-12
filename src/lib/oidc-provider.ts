import {
  createPrivateKey,
  createHmac,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { writeDatabase } from "@/lib/database";
import type { PlatformSessionUser } from "@/lib/platform-auth";

type OidcTicket = {
  account: string;
  aud: string;
  email: string;
  exp: number;
  jti?: string;
  name: string;
  nonce?: string;
  redirectUri?: string;
  role: PlatformSessionUser["role"];
  sub: string;
  type: "access" | "code";
};

const OIDC_KID = "lingqiong-oidc-local";
const OIDC_AUTHORIZATION_CODE_MAX_AGE = 300;

function oidcPrivateKeyPath() {
  return (
    process.env.WCU_OIDC_PRIVATE_KEY_PATH ||
    join(/*turbopackIgnore: true*/ process.cwd(), "data", "oidc-private-key.pem")
  );
}

function loadOidcPrivateKeyPem() {
  const keyPath = oidcPrivateKeyPath();

  try {
    if (existsSync(keyPath)) {
      return readFileSync(keyPath, "utf8");
    }
  } catch {
    // Fall through and generate a new key.
  }

  const generatedKeyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = generatedKeyPair.privateKey
    .export({ format: "pem", type: "pkcs8" })
    .toString();

  try {
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, pem, { mode: 0o600 });
  } catch {
    // If persistence is unavailable, keep the in-memory key for this process.
  }

  return pem;
}

const privateKeyPem = loadOidcPrivateKeyPem();
const privateKey = createPrivateKey(privateKeyPem);
const publicKey = createPublicKey(privateKeyPem);

function oidcSecret() {
  return (
    process.env.WCU_OIDC_CLIENT_SECRET ||
    process.env.PLATFORM_AUTH_SECRET ||
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "zhanji-bookstack-local-secret"
  );
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value: unknown) {
  return base64UrlEncode(JSON.stringify(value));
}

function signContent(value: string) {
  return createHmac("sha256", oidcSecret()).update(value).digest("base64url");
}

function signaturesMatch(a: string, b: string) {
  const actual = Buffer.from(a);
  const expected = Buffer.from(b);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function oidcClientId() {
  return process.env.WCU_OIDC_CLIENT_ID || "zhanji-bookstack";
}

export function oidcClientSecret() {
  return process.env.WCU_OIDC_CLIENT_SECRET || "zhanji-bookstack-local-secret";
}

export function oidcIssuer() {
  return process.env.WCU_OIDC_ISSUER || "http://web:3000/api/oidc";
}

export function oidcPublicBaseUrl() {
  return (process.env.WCU_PUBLIC_BASE_URL || "http://localhost").replace(/\/+$/, "");
}

function normalizedHttpUrl(value: string) {
  try {
    const url = new URL(value);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function configuredUrlList(value?: string) {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizedHttpUrl)
    .filter((item): item is string => Boolean(item));
}

export function oidcAllowedRedirectUris() {
  const configured = configuredUrlList(process.env.WCU_OIDC_REDIRECT_URIS);

  if (configured.length) {
    return configured;
  }

  const bookstackBase = (
    process.env.BOOKSTACK_APP_URL || `${oidcPublicBaseUrl()}/bookstack`
  ).replace(/\/+$/, "");
  const fallback = normalizedHttpUrl(`${bookstackBase}/oidc/callback`);

  return fallback ? [fallback] : [];
}

export function isAllowedOidcRedirectUri(value: string) {
  const candidate = value.trim();
  return Boolean(
    normalizedHttpUrl(candidate) && oidcAllowedRedirectUris().includes(candidate)
  );
}

export function resolveOidcPostLogoutRedirectUri(value?: string | null) {
  const publicBase = normalizedHttpUrl(oidcPublicBaseUrl());

  if (!publicBase) {
    return null;
  }

  if (!value?.trim()) {
    return publicBase;
  }

  let candidate: string | null = null;

  try {
    candidate = normalizedHttpUrl(new URL(value, publicBase).toString());
  } catch {
    return null;
  }

  if (!candidate) {
    return null;
  }

  const candidateUrl = new URL(candidate);
  const publicUrl = new URL(publicBase);
  const allowlist = configuredUrlList(process.env.WCU_OIDC_POST_LOGOUT_REDIRECT_URIS);

  return candidateUrl.origin === publicUrl.origin || allowlist.includes(candidate)
    ? candidate
    : null;
}

export function publicOidcPath(path: string) {
  return `${oidcPublicBaseUrl()}/_wcu-api/oidc${path}`;
}

export function internalOidcPath(path: string) {
  return `${oidcIssuer()}${path}`;
}

export function oidcPublicJwks() {
  const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey;

  return {
    keys: [
      {
        ...jwk,
        alg: "RS256",
        kid: OIDC_KID,
        use: "sig"
      }
    ]
  };
}

function safeEmail(session: PlatformSessionUser) {
  const contact = session.contact?.trim();

  if (contact?.includes("@")) {
    return contact;
  }

  const raw = (session.id || session.account || "creator")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${raw || "creator"}@lingqiong.local`;
}

export function oidcClaimsFromSession(session: PlatformSessionUser) {
  const role: PlatformSessionUser["role"] =
    session.source === "admin" &&
    (session.adminRole === "owner" || session.adminRole === "admin")
      ? "admin"
      : "creator";

  return {
    account: session.account,
    aud: oidcClientId(),
    email: safeEmail(session),
    name: session.account || "战纪宇宙用户",
    role,
    sub: `${session.source === "admin" ? `admin:${session.adminRole}` : role}:${session.id || session.account}`
  };
}

export function createOidcTicket(
  input: Omit<OidcTicket, "exp" | "type"> & {
    maxAge?: number;
    type: OidcTicket["type"];
  }
) {
  const payload = base64UrlJson({
    ...input,
    exp: Math.floor(Date.now() / 1000) + (input.maxAge ?? 300)
  });

  return `${payload}.${signContent(payload)}`;
}

export async function createOidcAuthorizationCode(
  input: Omit<OidcTicket, "exp" | "jti" | "redirectUri" | "type"> & {
    redirectUri: string;
  }
) {
  const createdAt = new Date().toISOString();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + OIDC_AUTHORIZATION_CODE_MAX_AGE;
  const jti = randomUUID();
  const payload = base64UrlJson({
    ...input,
    exp: expiresAt,
    jti,
    type: "code"
  });
  const code = `${payload}.${signContent(payload)}`;

  await writeDatabase(async (db) => {
    await db.execute("DELETE FROM oidc_authorization_codes WHERE expires_at <= ?", [now]);
    await db.execute(
      `INSERT INTO oidc_authorization_codes (id, expires_at, used_at, created_at)
       VALUES (?, ?, NULL, ?)`,
      [jti, expiresAt, createdAt]
    );
  });

  return code;
}

export function readOidcTicket(token?: string, type?: OidcTicket["type"]) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !signaturesMatch(signature, signContent(payload))) {
    return null;
  }

  try {
    const ticket = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as OidcTicket;

    if (
      (ticket.type !== "access" && ticket.type !== "code") ||
      (type && ticket.type !== type) ||
      !Number.isFinite(ticket.exp) ||
      !ticket.aud ||
      !ticket.sub
    ) {
      return null;
    }

    if (ticket.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return ticket;
  } catch {
    return null;
  }
}

export async function consumeOidcAuthorizationCode(code: string, redirectUri: string) {
  const ticket = readOidcTicket(code, "code");

  if (
    !ticket?.jti ||
    ticket.aud !== oidcClientId() ||
    !ticket.redirectUri ||
    ticket.redirectUri !== redirectUri
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  return writeDatabase(async (db) => {
    const result = await db.execute(
      `UPDATE oidc_authorization_codes
       SET used_at = ?
       WHERE id = ? AND used_at IS NULL AND expires_at > ?`,
      [new Date().toISOString(), ticket.jti ?? null, now]
    );

    return Number(result.affectedRows) === 1 ? ticket : null;
  });
}

export function signOidcIdToken(ticket: OidcTicket) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({
    alg: "RS256",
    kid: OIDC_KID,
    typ: "JWT"
  });
  const payload = base64UrlJson({
    aud: oidcClientId(),
    email: ticket.email,
    exp: now + 3600,
    groups: ticket.role === "admin" ? ["admin", "creator"] : ["creator"],
    iat: now,
    iss: oidcIssuer(),
    name: ticket.name,
    nonce: ticket.nonce,
    preferred_username: ticket.account,
    role: ticket.role,
    sub: ticket.sub
  });
  const content = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(content).sign(privateKey);

  return `${content}.${base64UrlEncode(signature)}`;
}

export function isValidOidcClient(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Basic ")) {
    return false;
  }

  const decoded = Buffer.from(authorizationHeader.slice(6), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex === -1) {
    return false;
  }

  const clientId = decoded.slice(0, separatorIndex);
  const secret = decoded.slice(separatorIndex + 1);

  return isValidOidcClientCredentials(clientId, secret);
}

export function isValidOidcClientCredentials(clientId: string, secret: string) {
  if (!clientId || !secret) {
    return false;
  }

  return (
    signaturesMatch(clientId, oidcClientId()) &&
    signaturesMatch(secret, oidcClientSecret())
  );
}
