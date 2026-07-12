import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { findOrCreateFrontUserIdentity } from "@/lib/front-users";
import {
  getLoginSettings,
  oauthProviderIds,
  type OAuthLoginSettings,
  type OAuthProviderId
} from "@/lib/login-settings";
import {
  platformUserFromFrontUser,
  setPlatformSession
} from "@/lib/platform-auth";
import { safeFrontRedirectPath } from "@/lib/safe-redirect";

type OAuthStatePayload = {
  exp: number;
  next: string;
  nonce: string;
  provider: OAuthProviderId;
};

type OAuthTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  id_token?: string;
  token_type?: string;
};

type OAuthProfile = Record<string, unknown>;

const STATE_MAX_AGE_SECONDS = 10 * 60;

function authSecret() {
  return (
    process.env.PLATFORM_AUTH_SECRET ||
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "zhanji2026"
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

function signaturesMatch(a: string, b: string) {
  const actual = Buffer.from(a);
  const expected = Buffer.from(b);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function randomNonce() {
  return randomUUID().replaceAll("-", "");
}

function isOAuthProviderId(value: string): value is OAuthProviderId {
  return oauthProviderIds.includes(value as OAuthProviderId);
}

function splitScopes(value: string) {
  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" ");
}

function redirectUriFor(requestUrl: URL, provider: OAuthProviderId) {
  return `${requestUrl.origin}/_wcu-api/auth/oauth/callback/${provider}`;
}

function createOAuthState(input: {
  next: string;
  nonce: string;
  provider: OAuthProviderId;
}) {
  const payload = base64UrlEncode(
    JSON.stringify({
      ...input,
      exp: Math.floor(Date.now() / 1000) + STATE_MAX_AGE_SECONDS
    } satisfies OAuthStatePayload)
  );

  return `${payload}.${signPayload(payload)}`;
}

function readOAuthState(token: string | null, provider: OAuthProviderId) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !signaturesMatch(signature, signPayload(payload))) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as OAuthStatePayload;

    if (
      parsed.provider !== provider ||
      !parsed.nonce ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function oauthSetupReady(settings: OAuthLoginSettings) {
  return Boolean(
    settings.enabled &&
      settings.clientId.trim() &&
      settings.clientSecret.trim() &&
      settings.authorizeUrl.trim() &&
      settings.tokenUrl.trim()
  );
}

export function oauthStateCookieName(providerValue: string) {
  return isOAuthProviderId(providerValue)
    ? `wcu_oauth_state_${providerValue}`
    : "wcu_oauth_state_invalid";
}

export async function createOAuthAuthorizationRedirect(
  providerValue: string,
  requestUrl: URL
) {
  if (!isOAuthProviderId(providerValue)) {
    throw new Error("不支持的登录方式。");
  }

  const settings = await getLoginSettings();
  const oauth = settings.oauth[providerValue];

  if (providerValue === "apple") {
    throw new Error("Apple 登录暂未启用，需完成标准 JWT 签名与 nonce 校验后开放。");
  }

  if (!oauthSetupReady(oauth)) {
    throw new Error(`${oauth.label} 登录尚未配置完整。`);
  }

  const nonce = randomNonce();
  const state = createOAuthState({
    next: safeFrontRedirectPath(requestUrl.searchParams.get("next")),
    nonce,
    provider: providerValue
  });
  const authorizationUrl = new URL(oauth.authorizeUrl);

  authorizationUrl.searchParams.set("client_id", oauth.clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUriFor(requestUrl, providerValue));
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", splitScopes(oauth.scopes));
  authorizationUrl.searchParams.set("state", state);

  if (providerValue === "google") {
    authorizationUrl.searchParams.set("nonce", nonce);
  }

  return { authorizationUrl, stateBinding: nonce };
}

async function exchangeCode(input: {
  code: string;
  oauth: OAuthLoginSettings;
  provider: OAuthProviderId;
  requestUrl: URL;
}) {
  const body = new URLSearchParams({
    client_id: input.oauth.clientId,
    client_secret: input.oauth.clientSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: redirectUriFor(input.requestUrl, input.provider)
  });

  const response = await fetch(input.oauth.tokenUrl, {
    body,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST",
    signal: AbortSignal.timeout(12000)
  });
  const payload = (await response.json().catch(() => null)) as
    | null
    | OAuthTokenResponse;

  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || "第三方授权换取 Token 失败。");
  }

  return payload;
}

async function fetchOAuthProfile(input: {
  oauth: OAuthLoginSettings;
  provider: OAuthProviderId;
  token: OAuthTokenResponse;
}) {
  if (!input.oauth.userInfoUrl.trim()) {
    throw new Error("第三方登录缺少可验证的用户资料接口。");
  }

  const response = await fetch(input.oauth.userInfoUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.token.access_token}`
    },
    signal: AbortSignal.timeout(12000)
  });
  const profile = (await response.json().catch(() => null)) as null | OAuthProfile;

  if (!response.ok || !profile) {
    throw new Error("第三方用户资料读取失败。");
  }

  return profile;
}

function getPathValue(source: OAuthProfile, path: string) {
  let current: unknown = source;

  for (const segment of path.split(".")) {
    if (!segment || typeof current !== "object" || current === null) {
      return "";
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" || typeof current === "number"
    ? String(current)
    : "";
}

function readClaim(profile: OAuthProfile, expression: string) {
  for (const path of expression.split("|")) {
    const value = getPathValue(profile, path.trim()).trim();

    if (value) {
      return value;
    }
  }

  return "";
}

export async function completeOAuthLogin(input: {
  code: string;
  providerValue: string;
  requestUrl: URL;
  stateBinding?: string | null;
  state: string | null;
}) {
  if (!isOAuthProviderId(input.providerValue)) {
    throw new Error("不支持的登录方式。");
  }

  if (input.providerValue === "apple") {
    throw new Error("Apple 登录暂未启用，需完成标准 JWT 签名与 nonce 校验后开放。");
  }

  const state = readOAuthState(input.state, input.providerValue);

  if (!state) {
    throw new Error("登录状态已失效，请重新发起登录。");
  }

  if (!input.stateBinding || !signaturesMatch(state.nonce, input.stateBinding)) {
    throw new Error("登录状态与当前浏览器不匹配，请重新发起登录。");
  }

  const settings = await getLoginSettings();
  const oauth = settings.oauth[input.providerValue];

  if (!oauthSetupReady(oauth)) {
    throw new Error(`${oauth.label} 登录尚未配置完整。`);
  }

  const token = await exchangeCode({
    code: input.code,
    oauth,
    provider: input.providerValue,
    requestUrl: input.requestUrl
  });
  const profile = await fetchOAuthProfile({
    oauth,
    provider: input.providerValue,
    token
  });
  const providerSubject = readClaim(profile, "sub|id");

  if (!providerSubject) {
    throw new Error("第三方账号缺少稳定用户标识，无法安全登录。");
  }

  const account =
    readClaim(profile, oauth.accountClaim) ||
    `${oauth.label} 用户 ${providerSubject.slice(0, 8)}`;
  const contact =
    readClaim(profile, oauth.contactClaim) ||
    `${input.providerValue}:${providerSubject}`;
  const user = await findOrCreateFrontUserIdentity({
    account,
    contact,
    profile: `${oauth.label} OAuth 登录`,
    provider: input.providerValue,
    providerSubject
  });

  await setPlatformSession(platformUserFromFrontUser(user));

  return {
    next: state.next,
    user
  };
}
