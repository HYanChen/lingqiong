"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  CloudOff,
  CreditCard,
  Gift,
  History,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type BillingAccount = Record<string, unknown>;
type BillingSettings = Record<string, unknown>;
type BillingOrder = Record<string, unknown>;

type BillingResponse = {
  account: BillingAccount | null;
  connected: boolean;
  currency?: Record<string, unknown>;
  message?: string;
  ok: boolean;
  orders: BillingOrder[] | { items?: BillingOrder[] };
  settings: BillingSettings;
};

type PaymentMethod = {
  id: string;
  minAmount: number;
  name: string;
};

type Quote = {
  amount: number;
  currency: string;
  payable: number | string;
};

type ActionResponse = {
  account?: BillingAccount | null;
  amount?: number | string;
  currency?: string;
  data?: Record<string, unknown>;
  message?: string;
  ok: boolean;
  payableAmount?: number | string;
  paymentAmount?: number | string;
  paymentUrl?: string;
  quote?: Record<string, unknown>;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function first(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanSetting(settings: BillingSettings, keys: string[], fallback: boolean) {
  const value = first(settings, ...keys);
  return typeof value === "boolean" ? value : fallback;
}

function paymentMethods(settings: BillingSettings): PaymentMethod[] {
  const raw = first(settings, "paymentMethods", "payment_methods", "payMethods", "pay_methods");
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value, index) => {
    if (typeof value === "string" && value.trim()) {
      return [{ id: value, minAmount: 0, name: value }];
    }
    const item = record(value);
    const id = String(first(item, "id", "type", "value", "paymentMethod") ?? "").trim();
    if (!id || item.enabled === false) return [];
    return [{
      id,
      minAmount: numeric(first(item, "minAmount", "min_amount", "minTopup", "min_topup")),
      name: String(first(item, "name", "label") ?? `支付方式 ${index + 1}`)
    }];
  });
}

function presetAmounts(settings: BillingSettings) {
  const raw = first(settings, "presetAmounts", "preset_amounts", "amountOptions", "amount_options");
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => numeric(record(value).value ?? value)).filter((value) => value > 0);
}

function orderItems(orders: BillingResponse["orders"]) {
  return Array.isArray(orders) ? orders : Array.isArray(orders.items) ? orders.items : [];
}

function accountMetric(account: BillingAccount | null, ...keys: string[]) {
  if (!account) return 0;
  return first(account, ...keys) ?? 0;
}

function formatMetric(value: unknown) {
  if (typeof value === "number") return value.toLocaleString("zh-CN");
  if (typeof value === "string" && value.trim()) return value;
  return "0";
}

function formatDate(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const raw = typeof value === "number" && value < 10_000_000_000 ? value * 1000 : value;
  const date = new Date(raw as string | number);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function statusLabel(value: unknown) {
  const status = String(value ?? "pending").toLowerCase();
  if (["success", "paid", "completed"].includes(status)) return { className: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100", label: "已完成" };
  if (["failed", "cancelled", "canceled", "expired"].includes(status)) return { className: "border-red-300/20 bg-red-300/10 text-red-100", label: status === "expired" ? "已过期" : "未完成" };
  return { className: "border-amber-200/20 bg-amber-200/10 text-amber-100", label: "待支付" };
}

async function billingRequest<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/_wcu-api/account/billing", {
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
    throw new Error(result?.message || "账单服务暂时无法访问。");
  }
  return result;
}

function BillingSkeleton() {
  return <div className="space-y-5"><div className="h-48 animate-pulse rounded-3xl border border-white/8 bg-white/[0.035]" /><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="h-[560px] animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" /><div className="h-80 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" /></div><div className="h-72 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" /></div>;
}

export function BillingCenter() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<"pay" | "quote" | "redeem" | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState(0);
  const [methodId, setMethodId] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [redeemCode, setRedeemCode] = useState("");

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await billingRequest<BillingResponse>();
      setData(result);
      const methods = paymentMethods(result.settings);
      const presets = presetAmounts(result.settings);
      const minAmount = numeric(first(result.settings, "minAmount", "min_amount", "minTopup", "min_topup"), 1);
      setMethodId((current) => methods.some((method) => method.id === current) ? current : methods[0]?.id ?? "");
      setAmount((current) => current > 0 ? current : presets[0] ?? Math.max(1, minAmount));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "账单信息加载失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadBilling();
    });
    return () => {
      cancelled = true;
    };
  }, [loadBilling]);

  const methods = useMemo(() => paymentMethods(data?.settings ?? {}), [data]);
  const presets = useMemo(() => presetAmounts(data?.settings ?? {}), [data]);
  const orders = useMemo(() => orderItems(data?.orders ?? []), [data]);
  const currencyConfig = data?.currency ?? {};
  const currency = String(first(currencyConfig, "quotaDisplayType", "quota_display_type", "currency", "currencyCode") ?? first(data?.settings ?? {}, "currency", "currencyCode", "currency_code") ?? "CNY");
  const baseMinAmount = numeric(first(data?.settings ?? {}, "minAmount", "min_amount", "minTopup", "min_topup"), 1);
  const selectedMethod = methods.find((method) => method.id === methodId);
  const minAmount = Math.max(baseMinAmount, selectedMethod?.minAmount ?? 0, 1);
  const explicitlyConfigured = first(data?.settings ?? {}, "paymentConfigured", "payment_configured", "paymentEnabled", "payment_enabled", "enableOnlineTopup", "enable_online_topup");
  const complianceConfirmed = booleanSetting(data?.settings ?? {}, ["complianceConfirmed", "compliance_confirmed", "paymentComplianceConfirmed", "payment_compliance_confirmed"], true);
  const paymentConfigured = (typeof explicitlyConfigured === "boolean" ? explicitlyConfigured : true) && complianceConfirmed && methods.length > 0;
  const redemptionEnabled = booleanSetting(data?.settings ?? {}, ["redemptionEnabled", "redemption_enabled", "enableRedemption", "enable_redemption"], true);
  const balance = accountMetric(data?.account ?? null, "balanceLabel", "balance", "quota");
  const numericBalance = Number(accountMetric(data?.account ?? null, "quota", "balance"));
  const balanceInsufficient = Number.isFinite(numericBalance) && numericBalance <= 0;

  function updateAmount(value: number) {
    setAmount(Number.isFinite(value) ? Math.max(0, value) : 0);
    setQuote(null);
    setError("");
  }

  function updateMethod(value: string) {
    setMethodId(value);
    setQuote(null);
    setError("");
  }

  async function requestQuote(quiet = false): Promise<Quote | null> {
    if (!methodId) {
      setError("请选择支付方式。");
      return null;
    }
    if (!Number.isFinite(amount) || amount < minAmount) {
      setError(`充值金额不能低于 ${minAmount}。`);
      return null;
    }
    setActiveAction("quote");
    setError("");
    try {
      const result = await billingRequest<ActionResponse>({
        body: JSON.stringify({ action: "quote", amount, paymentMethod: methodId }),
        method: "POST"
      });
      const source = result.data ?? result.quote ?? result;
      const rawPayable = first(source, "payable", "payableAmount", "payable_amount", "paymentAmount", "payment_amount", "amount") ?? result.payableAmount ?? result.paymentAmount ?? result.amount ?? amount;
      const nextQuote: Quote = {
        amount,
        currency: String(first(source, "currency", "currencyCode", "currency_code") ?? result.currency ?? currency),
        payable: typeof rawPayable === "string" || typeof rawPayable === "number" ? rawPayable : amount
      };
      setQuote(nextQuote);
      if (!quiet) setMessage(result.message || "实付金额已更新。");
      return nextQuote;
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : "计算实付金额失败。");
      return null;
    } finally {
      setActiveAction("");
    }
  }

  async function startPayment() {
    if (!paymentConfigured) {
      setError("当前没有配置可用的支付通道。");
      return;
    }
    const confirmedQuote = quote ?? await requestQuote(true);
    if (!confirmedQuote) return;
    setActiveAction("pay");
    setError("");
    setMessage("");
    try {
      const result = await billingRequest<ActionResponse>({
        body: JSON.stringify({ action: "pay", amount, paymentMethod: methodId }),
        method: "POST"
      });
      const paymentUrl = String(result.paymentUrl ?? result.data?.paymentUrl ?? "");
      if (!paymentUrl) throw new Error("支付通道未返回收银台地址。");
      const target = new URL(paymentUrl, window.location.origin);
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error("支付地址不安全，已停止跳转。");
      setMessage(result.message || "正在前往安全收银台…");
      window.location.assign(target.toString());
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : "发起支付失败。");
    } finally {
      setActiveAction("");
    }
  }

  async function redeem() {
    if (!redeemCode.trim()) {
      setError("请输入兑换码。");
      return;
    }
    setActiveAction("redeem");
    setError("");
    setMessage("");
    try {
      const result = await billingRequest<ActionResponse>({
        body: JSON.stringify({ action: "redeem", code: redeemCode.trim() }),
        method: "POST"
      });
      setRedeemCode("");
      setMessage(result.message || "兑换成功，余额已更新。");
      await loadBilling();
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : "兑换失败。");
    } finally {
      setActiveAction("");
    }
  }

  if (loading && !data) return <BillingSkeleton />;
  if (!data) return <section className="grid min-h-[520px] place-items-center rounded-3xl border border-red-300/20 bg-red-300/[0.045] px-6 text-center"><div className="max-w-md"><CloudOff className="mx-auto h-11 w-11 text-red-200" /><h1 className="mt-5 text-2xl font-semibold text-white">账单中心读取失败</h1><p className="mt-3 text-sm leading-7 text-stone-400">{error || "请稍后重试。"}</p><button className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-white/12 px-5 text-sm font-semibold text-white hover:border-cyan-100/40" onClick={() => void loadBilling()} type="button"><RefreshCw className="h-4 w-4" />重新加载</button></div></section>;

  if (!data.connected || !data.account) {
    return <section className="relative grid min-h-[560px] place-items-center overflow-hidden rounded-3xl border border-amber-200/20 bg-[linear-gradient(135deg,rgba(54,41,13,0.5),rgba(11,17,25,0.96))] px-6 text-center"><div className="cinema-grid absolute inset-0 opacity-20" /><div className="relative max-w-lg"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-amber-100"><WalletCards className="h-7 w-7" /></span><h1 className="mt-6 text-3xl font-semibold text-white">资源账户尚未开通</h1><p className="mt-4 text-sm leading-7 text-stone-400">充值与账单由灵穹 API 资源账户统一管理。完成连接后，可在本页查看余额、充值和订单。</p><a className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-amber-200 px-5 text-sm font-semibold text-amber-950" href="/api?redirect=/account/billing">连接资源账户<ArrowRight className="h-4 w-4" /></a></div></section>;
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-100/15 bg-[linear-gradient(120deg,rgba(9,31,43,0.97),rgba(11,17,25,0.96)_52%,rgba(21,64,61,0.76))] px-5 py-7 sm:px-8 sm:py-9">
        <div className="cinema-grid pointer-events-none absolute inset-0 opacity-25" />
        <div className="relative flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-100/75">Billing Center</p><h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">充值与账单</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-stone-400">管理模型资源余额、支付通道、兑换码和历史订单。</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-6 py-4 backdrop-blur-xl"><p className="text-xs text-stone-500">当前可用余额</p><p className="mt-2 break-all font-mono text-3xl font-semibold tabular-nums text-white">{formatMetric(balance)}</p></div>
        </div>
      </section>

      {error ? <div className="flex items-center justify-between gap-4 rounded-xl border border-red-300/20 bg-red-300/8 px-4 py-3 text-sm text-red-100"><span>{error}</span><button aria-label="关闭错误" onClick={() => setError("")} type="button"><X className="h-4 w-4" /></button></div> : null}
      {message ? <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-4 py-3 text-sm text-emerald-100"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{message}</span><button aria-label="关闭提示" onClick={() => setMessage("")} type="button"><X className="h-4 w-4" /></button></div> : null}
      {balanceInsufficient ? <div className="flex items-start gap-3 rounded-2xl border border-amber-200/20 bg-amber-200/[0.055] p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" /><div><h2 className="font-semibold text-amber-50">当前余额不足</h2><p className="mt-1 text-sm leading-6 text-stone-400">请完成充值或兑换后再返回创作工作台调用模型。</p></div></div> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-2xl border border-white/10 bg-[#0b1119]/92 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <header className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-6"><div><h2 className="text-lg font-semibold text-white">充值资源额度</h2><p className="mt-1 text-sm text-stone-500">先选择金额和支付方式，系统会计算实付价格。</p></div><CreditCard className="h-5 w-5 text-cyan-100" /></header>
          {!paymentConfigured ? <div className="p-6 sm:p-8"><div className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] px-5 py-10 text-center"><AlertTriangle className="mx-auto h-9 w-9 text-amber-200" /><h3 className="mt-4 text-lg font-semibold text-white">{!complianceConfirmed ? "支付合规配置尚未完成" : "支付通道尚未配置"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-7 text-stone-400">{String(first(data.settings, "message", "paymentMessage", "payment_message") ?? (!complianceConfirmed ? "当前暂不能发起支付，请等待平台完成收款与合规配置。" : "平台尚未启用在线支付。如有充值需求，可先使用兑换码或联系运营人员。"))}</p></div></div> : <div className="space-y-6 p-5 sm:p-6">
            {presets.length ? <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">快速选择</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{presets.map((preset) => <button className={`min-h-16 rounded-xl border px-4 text-left transition ${amount === preset ? "border-cyan-100/55 bg-cyan-200/10 text-cyan-50" : "border-white/10 bg-black/20 text-stone-300 hover:border-white/25"}`} key={preset} onClick={() => updateAmount(preset)} type="button"><strong className="font-mono text-lg">{preset.toLocaleString("zh-CN")}</strong><span className="mt-1 block text-[11px] text-stone-500">资源额度</span></button>)}</div></div> : null}
            <div className="grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm text-stone-300"><span>自定义金额</span><input className="h-11 rounded-xl border border-white/10 bg-black/25 px-4 font-mono text-white outline-none focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-200/10" min={minAmount} onChange={(event) => updateAmount(Number(event.target.value))} type="number" value={amount || ""} /><small className="text-stone-600">最低充值 {minAmount}</small></label><label className="grid gap-2 text-sm text-stone-300"><span>支付方式</span><select className="h-11 rounded-xl border border-white/10 bg-[#080d13] px-4 text-white outline-none focus:border-cyan-200/50" onChange={(event) => updateMethod(event.target.value)} value={methodId}>{methods.map((method) => <option key={method.id} value={method.id}>{method.name}{method.minAmount > 0 ? `（最低 ${method.minAmount}）` : ""}</option>)}</select><small className="text-stone-600">支付由安全收银台完成</small></label></div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-5"><div className="flex items-center justify-between gap-4"><span className="text-sm text-stone-400">预计实付</span>{activeAction === "quote" ? <Loader2 className="h-5 w-5 animate-spin text-cyan-100" /> : <strong className="font-mono text-2xl text-white">{quote ? `${quote.currency} ${formatMetric(quote.payable)}` : "待计算"}</strong>}</div><p className="mt-2 text-xs leading-5 text-stone-600">最终金额以收银台和支付通道返回为准。</p></div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button className="h-11 rounded-xl border border-white/12 px-5 text-sm font-semibold text-stone-200 hover:border-cyan-100/35 disabled:opacity-50" disabled={Boolean(activeAction)} onClick={() => void requestQuote()} type="button">计算实付</button><button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#61eadc] px-6 text-sm font-semibold text-[#04110f] shadow-[0_12px_34px_rgba(54,231,213,0.18)] transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-55" disabled={Boolean(activeAction) || amount < minAmount || !methodId} onClick={() => void startPayment()} type="button">{activeAction === "pay" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{activeAction === "pay" ? "正在创建订单" : "安全支付"}</button></div>
          </div>}
        </article>

        <div className="space-y-5">
          <article className="rounded-2xl border border-white/10 bg-[#0b1119]/92 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">账户概览</h2><CircleDollarSign className="h-5 w-5 text-cyan-100" /></div><div className="mt-5 grid gap-3"><div className="rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-xs text-stone-500">当前余额</p><p className="mt-2 break-all font-mono text-2xl font-semibold text-white">{formatMetric(balance)}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-xs text-stone-500">累计消耗</p><p className="mt-2 break-all font-mono text-base text-white">{formatMetric(accountMetric(data.account, "usedLabel", "totalUsed", "usedQuota", "used_quota"))}</p></div><div className="rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-xs text-stone-500">API 请求</p><p className="mt-2 break-all font-mono text-base text-white">{formatMetric(accountMetric(data.account, "requestCount", "request_count"))}</p></div></div></div><Link className="mt-4 inline-flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm text-stone-300 transition hover:border-cyan-100/35 hover:text-white" href="/usage-logs/common"><span>查看使用明细</span><ArrowRight className="h-4 w-4" /></Link></article>

          <article className="rounded-2xl border border-white/10 bg-[#0b1119]/92 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">兑换码</h2><Gift className="h-5 w-5 text-amber-200" /></div>{redemptionEnabled ? <><p className="mt-2 text-sm leading-6 text-stone-500">输入有效兑换码，资源额度会立即进入当前账户。</p><input className="mt-5 h-11 w-full rounded-xl border border-white/10 bg-black/25 px-4 font-mono text-sm uppercase tracking-wider text-white outline-none focus:border-amber-200/45" maxLength={128} onChange={(event) => setRedeemCode(event.target.value)} placeholder="输入兑换码" value={redeemCode} /><button className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-200/25 bg-amber-200/10 text-sm font-semibold text-amber-50 transition hover:bg-amber-200/15 disabled:opacity-50" disabled={activeAction === "redeem" || !redeemCode.trim()} onClick={() => void redeem()} type="button">{activeAction === "redeem" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}{activeAction === "redeem" ? "正在兑换" : "立即兑换"}</button></> : <div className="mt-5 rounded-xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-stone-500">当前未开放兑换码充值。</div>}</article>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0b1119]/92 shadow-[0_18px_60px_rgba(0,0,0,0.16)]"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-6"><div><div className="flex items-center gap-2"><History className="h-5 w-5 text-cyan-100" /><h2 className="text-lg font-semibold text-white">充值订单</h2></div><p className="mt-1 text-sm text-stone-500">支付回跳后请刷新订单，以服务端入账结果为准。</p></div><button className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-stone-300 transition hover:border-cyan-100/35 hover:text-white disabled:opacity-50" disabled={loading} onClick={() => void loadBilling()} type="button"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />刷新</button></header>{orders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-white/8 text-xs text-stone-500"><th className="px-6 py-4 font-medium">订单号</th><th className="px-4 py-4 font-medium">充值额度</th><th className="px-4 py-4 font-medium">实付</th><th className="px-4 py-4 font-medium">支付方式</th><th className="px-4 py-4 font-medium">状态</th><th className="px-6 py-4 font-medium">创建时间</th></tr></thead><tbody>{orders.map((order, index) => { const status = statusLabel(first(order, "status", "state")); return <tr className="border-b border-white/[0.055] text-stone-300 last:border-0" key={String(first(order, "id", "tradeNo", "trade_no") ?? index)}><td className="px-6 py-4 font-mono text-xs text-stone-400">{String(first(order, "tradeNo", "trade_no", "orderNo", "order_no", "id") ?? "—")}</td><td className="px-4 py-4 font-mono text-white">{formatMetric(first(order, "amount", "quota"))}</td><td className="px-4 py-4 font-mono text-white">{currency} {formatMetric(first(order, "payableAmount", "payable_amount", "money", "paymentAmount", "payment_amount"))}</td><td className="px-4 py-4">{String(first(order, "paymentMethod", "payment_method", "method") ?? "—")}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${status.className}`}>{status.label}</span></td><td className="px-6 py-4 text-stone-500">{formatDate(first(order, "createdAt", "created_at", "createTime", "create_time"))}</td></tr>; })}</tbody></table></div> : <div className="px-6 py-14 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/8 bg-white/[0.035] text-stone-500"><ReceiptText className="h-5 w-5" /></span><h3 className="mt-4 font-semibold text-white">暂无充值订单</h3><p className="mt-2 text-sm text-stone-500">完成第一笔充值后，订单和入账状态会出现在这里。</p></div>}</section>

      <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-5 py-4 text-xs leading-6 text-stone-500"><Banknote className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><p>支付结果由服务端回调确认。浏览器跳转或返回本页不代表已入账，请以余额和订单状态为准。</p></div>
    </div>
  );
}
