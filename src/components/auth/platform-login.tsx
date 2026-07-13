"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  KeyRound,
  Loader2,
  QrCode,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";

import type { Brand, MediaMap } from "@/content/site";
import { writeFrontUser, type FrontUser } from "@/lib/front-auth";
import { safeFrontRedirectPath } from "@/lib/safe-redirect";

type AuthResponse = {
  message?: string;
  ok?: boolean;
  user?: FrontUser;
};

type OAuthProviderId = "apple" | "github" | "google";

type PublicOAuthLoginSettings = {
  accountClaim: string;
  authorizeUrl: string;
  clientId: string;
  configured: boolean;
  contactClaim: string;
  enabled: boolean;
  label: string;
  provider: OAuthProviderId;
  scopes: string;
  tokenUrl: string;
  userInfoUrl: string;
};

type PublicLoginSettings = {
  oauth: PublicOAuthLoginSettings[];
  wechat: {
    appId: string;
    defaultAccount: string;
    defaultContact: string;
    enabled: boolean;
    mode: "local-scan" | "official";
    qrHint: string;
    qrTitle: string;
  };
};

type WechatTicket = {
  code: string;
  expiresAt: string;
  status: "confirmed" | "consumed" | "expired" | "pending";
};

type WechatTicketResponse = {
  message?: string;
  ok?: boolean;
  scanUrl?: string;
  ticket?: WechatTicket;
};

type WechatStatusResponse = {
  message?: string;
  ok?: boolean;
  ticket?: WechatTicket | null;
  user?: FrontUser;
};

function cleanNextPath(value: string | null) {
  return safeFrontRedirectPath(value);
}

function qrImageUrl(scanUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(scanUrl)}`;
}

const newApiPagePrefixes = [
  "/channels",
  "/dashboard",
  "/keys",
  "/models",
  "/playground",
  "/pricing",
  "/profile",
  "/rankings",
  "/redemption-codes",
  "/subscriptions",
  "/system-settings",
  "/usage-logs",
  "/users",
  "/wallet"
];

function isNewApiPagePath(path: string) {
  return newApiPagePrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function PlatformLogin({
  brand,
  media
}: {
  brand: Brand;
  media: MediaMap;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wechatError, setWechatError] = useState("");
  const [wechatLoading, setWechatLoading] = useState(false);
  const [wechatMessage, setWechatMessage] = useState("等待扫码确认");
  const [wechatScanUrl, setWechatScanUrl] = useState("");
  const [wechatSettings, setWechatSettings] = useState<PublicLoginSettings | null>(null);
  const [wechatTicket, setWechatTicket] = useState<WechatTicket | null>(null);
  const loginError = searchParams.get("error");
  const nextPath = useMemo(
    () => cleanNextPath(searchParams.get("next")),
    [searchParams]
  );
  const oauthProviders = useMemo(
    () => wechatSettings?.oauth ?? [],
    [wechatSettings?.oauth]
  );

  const navigateAfterLogin = useCallback(
    (path: string, user: FrontUser) => {
      writeFrontUser(user);

      if (path.startsWith("/_wcu-api/oidc/") || path.startsWith("/bookstack")) {
        window.location.assign(path);
        return;
      }

      if (isNewApiPagePath(path)) {
        window.location.assign("/api");
        return;
      }

      router.push(path);
      router.refresh();
    },
    [router]
  );

  const requestWechatTicket = useCallback(async () => {
    setWechatLoading(true);
    setWechatError("");
    setWechatMessage("正在生成二维码");

    try {
      const response = await fetch("/_wcu-api/auth/wechat/ticket", {
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as
        | null
        | WechatTicketResponse;

      if (!response.ok || !result?.ticket || !result.scanUrl) {
        setWechatError(result?.message ?? "微信二维码生成失败。");
        setWechatTicket(null);
        setWechatScanUrl("");
        return;
      }

      setWechatTicket(result.ticket);
      setWechatScanUrl(result.scanUrl);
      setWechatMessage("请使用微信扫一扫确认登录");
    } catch {
      setWechatError("网络暂时不可用，请稍后再试。");
    } finally {
      setWechatLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const response = await fetch("/_wcu-api/login-settings", { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as
          | null
          | PublicLoginSettings;

        if (active && response.ok && result?.wechat) {
          setWechatSettings(result);

          if (result.wechat.enabled) {
            await requestWechatTicket();
          }
        }
      } catch {
        if (active) {
          setWechatSettings(null);
        }
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, [requestWechatTicket]);

  useEffect(() => {
    const ticketCode = wechatTicket?.code ?? "";

    if (
      !wechatSettings?.wechat.enabled ||
      !ticketCode
    ) {
      return;
    }

    let active = true;
    let busy = false;

    async function poll() {
      if (busy) {
        return;
      }

      busy = true;

      try {
        const response = await fetch(
          `/_wcu-api/auth/wechat/status?ticket=${encodeURIComponent(ticketCode)}`,
          { cache: "no-store" }
        );
        const result = (await response.json().catch(() => null)) as
          | null
          | WechatStatusResponse;

        if (!active) {
          return;
        }

        if (!response.ok || !result?.ok) {
          setWechatError(result?.message ?? "二维码状态读取失败。");
          return;
        }

        if (result.user) {
          setWechatMessage("已确认，正在进入统一平台");
          navigateAfterLogin(nextPath, result.user);
          return;
        }

        if (result.ticket?.status === "expired") {
          setWechatMessage("二维码已过期");
          setWechatError("二维码已过期，请刷新后重新扫码。");
          return;
        }

        if (result.ticket?.status === "confirmed") {
          setWechatMessage("已扫码确认，正在登录");
          return;
        }

        setWechatMessage("等待扫码确认");
      } catch {
        if (active) {
          setWechatError("网络暂时不可用，请稍后再试。");
        }
      } finally {
        busy = false;
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 1800);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    navigateAfterLogin,
    nextPath,
    wechatSettings?.wechat.enabled,
    wechatSettings?.wechat.mode,
    wechatTicket?.code
  ]);

  async function confirmWechatOnThisDevice() {
    if (!wechatTicket?.code) {
      return;
    }

    setWechatLoading(true);
    setWechatError("");

    try {
      const response = await fetch("/_wcu-api/auth/wechat/confirm", {
        body: JSON.stringify({ ticket: wechatTicket.code }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as
        | null
        | WechatTicketResponse;

      if (!response.ok || !result?.ok) {
        setWechatError(result?.message ?? "确认失败，请刷新二维码后重试。");
        return;
      }

      setWechatMessage("已确认，正在登录");
    } catch {
      setWechatError("网络暂时不可用，请稍后再试。");
    } finally {
      setWechatLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/_wcu-api/auth/login", {
        body: JSON.stringify({
          password,
          username: username.trim() || undefined
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as AuthResponse | null;

      if (!response.ok || !result?.user) {
        setError(result?.message ?? "登录失败，请检查账号和密码。");
        return;
      }

      navigateAfterLogin(nextPath, result.user);
    } catch {
      setError("网络暂时不可用，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  function startOAuthLogin(provider: OAuthProviderId) {
    const url = new URL(`/_wcu-api/auth/oauth/start/${provider}`, window.location.origin);
    url.searchParams.set("next", nextPath);
    window.location.assign(url);
  }

  function oauthIcon(provider: OAuthProviderId) {
    if (provider === "github") {
      return <span aria-hidden="true" className="text-sm font-bold leading-none">GH</span>;
    }

    if (provider === "apple") {
      return <span aria-hidden="true" className="text-base leading-none">A</span>;
    }

    return <BadgeCheck aria-hidden="true" className="h-4 w-4" />;
  }

  return (
    <section className="min-h-screen overflow-hidden bg-[#050505] px-5 pb-16 pt-28 text-stone-100 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <aside className="relative min-h-[520px] overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
          <Image
            alt="战纪宇宙用户登录视觉"
            className="h-full w-full object-cover opacity-72"
            fill
            priority
            sizes="(min-width: 1024px) 52vw, 100vw"
            src={media.workflow}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/92 via-black/50 to-cyan-950/24" />
          <div className="absolute inset-0 cinema-grid opacity-30" />
          <div className="relative z-10 flex min-h-[520px] flex-col justify-end p-6 md:p-9">
            <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              {brand.english}
            </p>
            <h1 className="mt-5 max-w-xl text-balance text-4xl font-semibold leading-tight text-stone-50 md:text-6xl">
              战纪宇宙统一登录
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-stone-300">
              使用账号密码、微信扫码或第三方账号进入创作者工作台、灵穹 API 与灵穹知识库。
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["创作者工作台", "灵穹 API", "灵穹知识库"].map((item) => (
                <div
                  className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 backdrop-blur"
                  key={item}
                >
                  <p className="text-xs font-semibold text-cyan-100">Unified</p>
                  <p className="mt-2 text-sm text-stone-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg border border-cyan-300/35 bg-cyan-300/10 text-cyan-100">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xl font-semibold text-stone-50">用户登录</p>
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                {brand.name} Platform
              </p>
            </div>
          </div>

          <form
            className="mt-8 grid gap-5 rounded-lg border border-cyan-200/20 bg-cyan-200/[0.07] p-4"
            onSubmit={submit}
          >
            <div>
              <p className="text-base font-semibold text-stone-50">账号密码登录</p>
              <p className="mt-2 text-xs leading-6 text-stone-400">
                输入注册时设置的登录账号和密码。
              </p>
            </div>
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                <UserRound aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                登录账号
              </span>
              <input
                autoComplete="username"
                autoFocus
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-4 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70"
                maxLength={64}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入登录账号"
                required
                type="text"
                value={username}
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                <KeyRound aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                登录密码
              </span>
              <input
                autoComplete="current-password"
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-4 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70"
                maxLength={128}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入登录密码"
                required
                type="password"
                value={password}
              />
            </label>

            {loginError ? (
              <p className="flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                {loginError}
              </p>
            ) : null}

            {error ? (
              <p className="flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
                <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                {error}
              </p>
            ) : null}

            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-stone-50 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || !username.trim() || !password}
              type="submit"
            >
              {loading ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              )}
              登录并进入创作台
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-lg bg-cyan-200 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
              href="/register"
            >
              使用邀请码注册
            </Link>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              href="/"
            >
              返回首页
            </Link>
          </div>

          {wechatSettings?.wechat.enabled ? (
            <div className="mt-8 rounded-lg border border-cyan-200/20 bg-cyan-200/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-base font-semibold text-cyan-50">
                    <QrCode aria-hidden="true" className="h-5 w-5" />
                    {wechatSettings.wechat.qrTitle}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-cyan-50/70">
                    {wechatSettings.wechat.qrHint}
                  </p>
                </div>
                <button
                  aria-label="刷新微信登录二维码"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-200/25 text-cyan-50 transition hover:bg-cyan-200/10 disabled:opacity-50"
                  disabled={wechatLoading}
                  onClick={() => void requestWechatTicket()}
                  type="button"
                >
                  {wechatLoading ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw aria-hidden="true" className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-[220px_1fr] sm:items-center">
                <div className="grid h-[220px] w-[220px] place-items-center rounded-lg border border-white/10 bg-stone-50 p-3 text-zinc-950">
                  {wechatScanUrl ? (
                    <Image
                      alt="微信扫码登录二维码"
                      className="h-full w-full"
                      height={196}
                      src={qrImageUrl(wechatScanUrl)}
                      unoptimized
                      width={196}
                    />
                  ) : (
                    <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-100">{wechatMessage}</p>
                  <p className="mt-2 break-all text-xs leading-6 text-stone-400">
                    {wechatScanUrl || "二维码生成中"}
                  </p>
                  {wechatSettings.wechat.mode === "local-scan" ? (
                    <button
                      className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-4 text-xs font-semibold text-stone-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={wechatLoading || !wechatTicket}
                      onClick={() => void confirmWechatOnThisDevice()}
                      type="button"
                    >
                      本机测试确认
                    </button>
                  ) : null}
                </div>
              </div>

              {wechatError ? (
                <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm leading-6 text-red-100">
                  <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  {wechatError}
                </p>
              ) : null}
            </div>
          ) : null}

          {oauthProviders.length ? (
            <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <p className="text-base font-semibold text-stone-50">
                第三方账号登录
              </p>
              <p className="mt-2 text-xs leading-6 text-stone-500">
                Google、GitHub 登录会写入同一个战纪宇宙平台会话；Apple
                将在完成标准签名校验后开放。
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {oauthProviders.map((provider) => (
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-zinc-950/55 px-4 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/45 hover:bg-cyan-200/10 disabled:cursor-not-allowed disabled:border-white/8 disabled:text-stone-600"
                    disabled={
                      provider.provider === "apple" ||
                      !provider.enabled ||
                      !provider.configured
                    }
                    key={provider.provider}
                    onClick={() => startOAuthLogin(provider.provider)}
                    title={
                        provider.provider === "apple"
                          ? "Apple 登录需完成标准签名校验后启用"
                          : provider.enabled && provider.configured
                        ? `${provider.label} 登录`
                        : `${provider.label} 登录暂未开通`
                    }
                    type="button"
                  >
                    {oauthIcon(provider.provider)}
                    <span>{provider.label}</span>
                    {provider.provider === "apple" ||
                    !provider.enabled ||
                    !provider.configured ? (
                      <span className="text-[10px] font-medium text-stone-600">
                        待配置
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </section>
  );
}
