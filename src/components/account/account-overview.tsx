"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  CircleUserRound,
  CloudOff,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type PlatformUser = {
  account: string;
  contact?: string;
  createdAt?: string;
  id?: string;
  profile?: string;
  role?: string;
  source?: string;
};

type ApiAccount = {
  balance?: number | string;
  balanceLabel?: string;
  displayName?: string;
  display_name?: string;
  group?: string;
  id?: number | string;
  quota?: number | string;
  requestCount?: number | string;
  request_count?: number | string;
  totalUsed?: number | string;
  usedQuota?: number | string;
  usedLabel?: string;
  used_quota?: number | string;
  username?: string;
};

type OverviewResponse = {
  account?: ApiAccount | null;
  apiAccount: ApiAccount | null;
  connected: boolean;
  links: Record<string, string | undefined>;
  modelAccess: {
    allowed: boolean;
    code: string;
    message: string;
  };
  ok: boolean;
  platformUser: PlatformUser;
};

type ProfileResponse = {
  message?: string;
  ok: boolean;
  platformUser?: PlatformUser;
  user?: PlatformUser;
};

async function accountRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      ...(typeof init?.body === "string" ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {})
    }
  });
  const result = (await response.json().catch(() => null)) as
    | (T & { message?: string; ok?: boolean })
    | null;
  if (!response.ok || !result) {
    throw new Error(result?.message || "用户中心暂时无法访问。");
  }
  return result;
}

function metricValue(value: number | string | undefined) {
  if (typeof value === "number") return value.toLocaleString("zh-CN");
  if (typeof value === "string" && value.trim()) return value;
  return "0";
}

function safeLink(value: string | undefined, fallback: string) {
  if (value?.startsWith("/")) return value;
  if (value && /^https?:\/\//iu.test(value)) return value;
  return fallback;
}

function sourceLabel(source?: string) {
  return ({
    admin: "系统管理账号",
    apple: "Apple",
    github: "GitHub",
    google: "Google",
    invite: "邀请码",
    login: "账号密码",
    wechat: "微信"
  } as Record<string, string>)[source ?? ""] ?? "统一登录";
}

function OverviewSkeleton() {
  return (
    <div aria-label="正在加载用户中心" className="space-y-5">
      <div className="h-52 animate-pulse rounded-3xl border border-white/8 bg-white/[0.035]" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="h-32 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" key={index} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-96 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" />
        <div className="h-72 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" />
      </div>
    </div>
  );
}

export function AccountOverview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [account, setAccount] = useState("");
  const [contact, setContact] = useState("");
  const [profile, setProfile] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await accountRequest<OverviewResponse>("/_wcu-api/account/overview");
      setOverview({ ...result, apiAccount: result.apiAccount ?? result.account ?? null });
      setAccount(result.platformUser.account ?? "");
      setContact(result.platformUser.contact ?? "");
      setProfile(result.platformUser.profile ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "用户中心加载失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadOverview();
    });
    return () => {
      cancelled = true;
    };
  }, [loadOverview]);

  const stats = useMemo(() => {
    const resource = overview?.apiAccount;
    return [
      {
        description: "当前可用模型资源",
        icon: WalletCards,
        label: "账户余额",
        value: metricValue(resource?.balanceLabel ?? resource?.balance ?? resource?.quota)
      },
      {
        description: "历史累计资源消耗",
        icon: BarChart3,
        label: "累计使用",
        value: metricValue(resource?.usedLabel ?? resource?.totalUsed ?? resource?.usedQuota ?? resource?.used_quota)
      },
      {
        description: "文本、图像与工作流请求",
        icon: Activity,
        label: "API 请求",
        value: metricValue(resource?.requestCount ?? resource?.request_count)
      }
    ];
  }, [overview]);

  async function saveProfile() {
    if (!overview || !account.trim()) {
      setError("账号显示名不能为空。");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await accountRequest<ProfileResponse>("/_wcu-api/account/profile", {
        body: JSON.stringify({
          account: account.trim(),
          contact: contact.trim(),
          profile: profile.trim()
        }),
        method: "PATCH"
      });
      const platformUser = result.platformUser ?? result.user ?? {
        ...overview.platformUser,
        account: account.trim(),
        contact: contact.trim(),
        profile: profile.trim()
      };
      setOverview((current) => current ? { ...current, platformUser } : current);
      setMessage(result.message || "创作者资料已保存。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "资料保存失败。");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !overview) return <OverviewSkeleton />;

  if (!overview) {
    return (
      <section className="grid min-h-[520px] place-items-center rounded-3xl border border-red-300/20 bg-red-300/[0.045] px-6 text-center">
        <div className="max-w-md">
          <CloudOff aria-hidden="true" className="mx-auto h-11 w-11 text-red-200" />
          <h1 className="mt-5 text-2xl font-semibold text-white">用户中心读取失败</h1>
          <p className="mt-3 text-sm leading-7 text-stone-400">{error || "请稍后重试。"}</p>
          <button className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-white/12 px-5 text-sm font-semibold text-white transition hover:border-cyan-100/40" onClick={() => void loadOverview()} type="button">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />重新加载
          </button>
        </div>
      </section>
    );
  }

  const insufficientBalance = !overview.modelAccess.allowed && /balance|quota|credit|insufficient/iu.test(overview.modelAccess.code);
  const profileEditable = overview.platformUser.source !== "admin" && overview.platformUser.role !== "admin";
  const billingHref = safeLink(overview.links.billing, "/account/billing");
  const connectHref = safeLink(overview.links.connect, "/api?redirect=/account");

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-100/15 bg-[linear-gradient(120deg,rgba(10,36,48,0.96),rgba(11,17,25,0.96)_55%,rgba(21,64,61,0.78))] px-5 py-7 shadow-[0_26px_90px_rgba(0,0,0,0.28)] sm:px-8 sm:py-9">
        <div className="cinema-grid pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-cyan-100/20 bg-cyan-200/10 text-2xl font-semibold text-cyan-50 shadow-[0_0_38px_rgba(34,211,238,0.12)]">
              {overview.platformUser.account.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold text-white sm:text-3xl">{overview.platformUser.account}</h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] text-emerald-100"><BadgeCheck className="h-3.5 w-3.5" />已登录</span>
              </div>
              <p className="mt-2 text-sm text-stone-400">{overview.platformUser.profile || "灵穹 AI 影视创作者"}</p>
              <p className="mt-1 text-xs text-stone-500">{sourceLabel(overview.platformUser.source)}{overview.platformUser.contact ? ` · ${overview.platformUser.contact}` : ""}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#61eadc] px-5 text-sm font-semibold text-[#04110f] transition hover:bg-cyan-100" href={billingHref}><WalletCards className="h-4 w-4" />充值与账单</Link>
            <Link className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/12 px-5 text-sm font-semibold text-stone-100 transition hover:border-cyan-100/40 hover:bg-white/5" href={safeLink(overview.links.projects, "/projects")}>进入项目<ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {error ? <div className="flex items-center justify-between gap-4 rounded-xl border border-red-300/20 bg-red-300/8 px-4 py-3 text-sm text-red-100"><span>{error}</span><button aria-label="关闭错误" onClick={() => setError("")} type="button"><X className="h-4 w-4" /></button></div> : null}
      {message ? <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-4 py-3 text-sm text-emerald-100"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{message}</span><button aria-label="关闭提示" onClick={() => setMessage("")} type="button"><X className="h-4 w-4" /></button></div> : null}

      {!overview.connected ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.055] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" /><div><h2 className="font-semibold text-amber-50">灵穹 API 资源账户尚未开通</h2><p className="mt-1 text-sm leading-6 text-stone-400">连接资源账户后才能查看余额、调用模型和完成充值。</p></div></div>
          <a className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-200 px-4 text-sm font-semibold text-amber-950" href={connectHref}>立即连接<ArrowRight className="h-4 w-4" /></a>
        </section>
      ) : !overview.modelAccess.allowed ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.055] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" /><div><h2 className="font-semibold text-amber-50">{insufficientBalance ? "资源余额不足" : "当前无法调用模型"}</h2><p className="mt-1 text-sm leading-6 text-stone-400">{overview.modelAccess.message || "请检查账户状态或联系平台运营人员。"}</p></div></div>
          {insufficientBalance ? <Link className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#61eadc] px-4 text-sm font-semibold text-[#04110f]" href={billingHref}>去充值<ArrowRight className="h-4 w-4" /></Link> : null}
        </section>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] px-5 py-4 text-sm text-emerald-100"><ShieldCheck className="h-5 w-5" /><span>模型访问正常，可直接进入项目或 Skill 工作台创作。</span></div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => <article className="rounded-2xl border border-white/10 bg-[#0b1119]/90 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.16)]" key={stat.label}><div className="flex items-center justify-between text-stone-500"><span className="text-xs font-medium uppercase tracking-[0.18em]">{stat.label}</span><stat.icon className="h-4 w-4 text-cyan-100/75" /></div><p className="mt-5 break-all font-mono text-2xl font-semibold tabular-nums text-white sm:text-3xl">{overview.connected ? stat.value : "—"}</p><p className="mt-2 text-xs leading-5 text-stone-500">{stat.description}</p></article>)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-2xl border border-white/10 bg-[#0b1119]/90 shadow-[0_18px_60px_rgba(0,0,0,0.16)]">
          <header className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-6"><div><h2 className="text-lg font-semibold text-white">创作者资料</h2><p className="mt-1 text-sm text-stone-500">用于项目署名、协作与平台通知。</p></div><CircleUserRound className="h-5 w-5 text-cyan-100" /></header>
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <label className="grid gap-2 text-sm text-stone-300"><span>显示名</span><input className="h-11 rounded-xl border border-white/10 bg-black/25 px-4 text-white outline-none transition placeholder:text-stone-600 focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-200/10 read-only:cursor-not-allowed read-only:text-stone-500" maxLength={80} onChange={(event) => setAccount(event.target.value)} readOnly={!profileEditable} value={account} /></label>
            <label className="grid gap-2 text-sm text-stone-300"><span>联系方式</span><input className="h-11 rounded-xl border border-white/10 bg-black/25 px-4 text-white outline-none transition placeholder:text-stone-600 focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-200/10 read-only:cursor-not-allowed read-only:text-stone-500" maxLength={255} onChange={(event) => setContact(event.target.value)} placeholder="邮箱或手机号" readOnly={!profileEditable} value={contact} /></label>
            <label className="grid gap-2 text-sm text-stone-300 sm:col-span-2"><span>创作者身份</span><textarea className="min-h-28 resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 leading-7 text-white outline-none transition placeholder:text-stone-600 focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-200/10 read-only:cursor-not-allowed read-only:text-stone-500" maxLength={500} onChange={(event) => setProfile(event.target.value)} placeholder="例如：导演 / 制片、编剧 / 策划" readOnly={!profileEditable} value={profile} /></label>
            <div className="flex items-center justify-between gap-4 sm:col-span-2">{!profileEditable ? <p className="text-xs leading-5 text-stone-500">当前账号资料由平台统一维护。</p> : <span />}<button className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#61eadc] px-5 text-sm font-semibold text-[#04110f] transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-55" disabled={!profileEditable || saving || !account.trim()} onClick={() => void saveProfile()} type="button">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "正在保存" : "保存资料"}</button></div>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-[#0b1119]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] sm:p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">资源账户</h2><Sparkles className="h-5 w-5 text-cyan-100" /></div>
          {overview.connected && overview.apiAccount ? <div className="mt-6 space-y-4 text-sm"><div className="rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-stone-500">账户</p><p className="mt-2 break-all font-medium text-white">{overview.apiAccount.displayName || overview.apiAccount.display_name || overview.apiAccount.username || overview.platformUser.account}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-stone-500">用户组</p><p className="mt-2 text-white">{overview.apiAccount.group || "default"}</p></div><div className="rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-stone-500">账户 ID</p><p className="mt-2 truncate text-white">{overview.apiAccount.id ?? "—"}</p></div></div><Link className="inline-flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-stone-300 transition hover:border-cyan-100/35 hover:text-white" href={safeLink(overview.links.usage, "/usage-logs/common")}><span>查看使用记录</span><ArrowRight className="h-4 w-4" /></Link></div> : <div className="mt-10 text-center"><AlertTriangle className="mx-auto h-9 w-9 text-amber-200" /><p className="mt-4 font-medium text-white">还没有可用的资源账户</p><p className="mt-2 text-sm leading-6 text-stone-500">连接后会在这里展示余额和调用数据。</p></div>}
        </article>
      </section>
    </div>
  );
}
