import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { findOrCreateFrontUserIdentity } from "@/lib/front-users";
import { getLoginSettings } from "@/lib/login-settings";
import {
  platformUserFromFrontUser,
  setPlatformSession
} from "@/lib/platform-auth";
import { safeFrontRedirectPath } from "@/lib/safe-redirect";

const STATE_MAX_AGE_SECONDS = 10 * 60;

type WechatStatePayload = {
  exp: number;
  next: string;
  nonce: string;
};

type WechatTokenResponse = {
  access_token?: string;
  errcode?: number;
  errmsg?: string;
  expires_in?: number;
  openid?: string;
  refresh_token?: string;
  scope?: string;
  unionid?: string;
};

type WechatProfileResponse = {
  city?: string;
  country?: string;
  errcode?: number;
  errmsg?: string;
  headimgurl?: string;
  nickname?: string;
  openid?: string;
  privilege?: string[];
  province?: string;
  sex?: number;
  unionid?: string;
};

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

function callbackUri(requestUrl: URL) {
  return `${requestUrl.origin}/_wcu-api/auth/wechat/callback`;
}

function createStateBinding(next: string, nonce: string) {
  const payload = base64UrlEncode(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + STATE_MAX_AGE_SECONDS,
      next,
      nonce
    } satisfies WechatStatePayload)
  );

  return `${payload}.${signPayload(payload)}`;
}

function readStateBinding(binding: string | null | undefined) {
  if (!binding) {
    return null;
  }

  const [payload, signature] = binding.split(".");

  if (!payload || !signature || !signaturesMatch(signature, signPayload(payload))) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as WechatStatePayload;

    if (
      !parsed.nonce ||
      parsed.exp < Math.floor(Date.now() / 1000) ||
      safeFrontRedirectPath(parsed.next) !== parsed.next
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function officialSetupReady(settings: Awaited<ReturnType<typeof getLoginSettings>>) {
  return Boolean(
    settings.wechat.enabled &&
      settings.wechat.mode === "official" &&
      settings.wechat.appId.trim() &&
      settings.wechat.appSecret.trim()
  );
}

export const wechatOfficialStateCookieName = "wcu_wechat_oauth_state";

export async function createWechatOfficialAuthorization(requestUrl: URL) {
  const settings = await getLoginSettings();

  if (!officialSetupReady(settings)) {
    throw new Error("微信开放平台登录尚未配置完整。");
  }

  const nonce = randomUUID().replaceAll("-", "");
  const next = safeFrontRedirectPath(requestUrl.searchParams.get("next"));
  const authorizationUrl = new URL("https://open.weixin.qq.com/connect/qrconnect");
  authorizationUrl.searchParams.set("appid", settings.wechat.appId.trim());
  authorizationUrl.searchParams.set("redirect_uri", callbackUri(requestUrl));
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "snsapi_login");
  authorizationUrl.searchParams.set("state", nonce);
  authorizationUrl.hash = "wechat_redirect";

  return {
    authorizationUrl,
    stateBinding: createStateBinding(next, nonce)
  };
}

async function exchangeWechatCode(input: {
  appId: string;
  appSecret: string;
  code: string;
}) {
  const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  url.searchParams.set("appid", input.appId);
  url.searchParams.set("secret", input.appSecret);
  url.searchParams.set("code", input.code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  const token = (await response.json().catch(() => null)) as
    | WechatTokenResponse
    | null;

  if (!response.ok || !token?.access_token || !token.openid || token.errcode) {
    throw new Error(token?.errmsg || "微信授权码换取 Token 失败。");
  }

  return token;
}

async function fetchWechatProfile(token: WechatTokenResponse) {
  const url = new URL("https://api.weixin.qq.com/sns/userinfo");
  url.searchParams.set("access_token", token.access_token || "");
  url.searchParams.set("openid", token.openid || "");
  url.searchParams.set("lang", "zh_CN");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  const profile = (await response.json().catch(() => null)) as
    | WechatProfileResponse
    | null;

  if (!response.ok || !profile?.openid || profile.errcode) {
    throw new Error(profile?.errmsg || "微信用户资料读取失败。");
  }

  return profile;
}

export async function completeWechatOfficialLogin(input: {
  code: string;
  requestUrl: URL;
  state: string | null;
  stateBinding?: string | null;
}) {
  const binding = readStateBinding(input.stateBinding);

  if (!binding || !input.state || !signaturesMatch(binding.nonce, input.state)) {
    throw new Error("微信登录状态已失效，请重新发起登录。");
  }

  const settings = await getLoginSettings();

  if (!officialSetupReady(settings)) {
    throw new Error("微信开放平台登录尚未配置完整。");
  }

  const token = await exchangeWechatCode({
    appId: settings.wechat.appId.trim(),
    appSecret: settings.wechat.appSecret.trim(),
    code: input.code
  });
  const profile = await fetchWechatProfile(token);
  const providerSubject = (
    profile.unionid || token.unionid || profile.openid || ""
  ).trim();

  if (!providerSubject) {
    throw new Error("微信账号缺少稳定用户标识，无法安全登录。");
  }

  const account =
    profile.nickname?.trim() || `微信用户 ${providerSubject.slice(-8)}`;
  const user = await findOrCreateFrontUserIdentity({
    account,
    contact: `wechat:${providerSubject}`,
    profile: "微信开放平台登录",
    provider: "wechat",
    providerSubject
  });

  await setPlatformSession(platformUserFromFrontUser(user));

  return {
    next: binding.next,
    user
  };
}
