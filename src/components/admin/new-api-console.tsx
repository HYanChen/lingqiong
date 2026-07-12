"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CreditCard,
  Loader2,
  PlugZap,
  ReceiptText,
  RefreshCcw,
  ServerCog,
  UsersRound
} from "lucide-react";

import { cn } from "@/lib/utils";

type NewApiStatus = {
  consoleUrl: string;
  message?: string;
  online: boolean;
  serverBaseUrl: string;
  systemName?: string;
  theme?: string;
  version?: string;
};

const fallbackStatus: NewApiStatus = {
  consoleUrl: "http://localhost/api",
  online: false,
  serverBaseUrl: "http://new-api:3000"
};

export function NewApiConsole() {
  const [status, setStatus] = useState<NewApiStatus>(fallbackStatus);
  const [loading, setLoading] = useState(true);

  async function loadStatus() {
    setLoading(true);
    const response = await fetch("/_wcu-api/admin/new-api/status", {
      cache: "no-store"
    });

    if (response.ok) {
      setStatus((await response.json()) as NewApiStatus);
    } else {
      setStatus({
        ...fallbackStatus,
        message: response.status === 401 ? "后台登录已失效" : "状态读取失败"
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">
              <PlugZap aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                lingqiong api
              </p>
              <h2 className="mt-2 text-xl font-semibold text-stone-50">
                灵穹 API 是用户账户与模型计费的唯一账本
              </h2>
              <p className="mt-2 text-sm leading-7 text-stone-400">
                用户先在自己的灵穹 API 账户充值，平台再按该用户的额度执行模型任务。账户、余额、订单、兑换码和用量记录都由同一账本管理。
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-stone-500">运行状态</p>
              <p
                className={cn(
                  "mt-2 inline-flex items-center gap-2 text-sm font-semibold",
                  status.online ? "text-emerald-100" : "text-amber-100"
                )}
              >
                <Activity aria-hidden="true" className="h-4 w-4" />
                {loading ? "检查中" : status.online ? "在线" : "未连通"}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-stone-500">系统名称</p>
              <p className="mt-2 truncate text-sm font-semibold text-stone-100">
                {status.systemName ?? "灵穹 API"}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-stone-500">版本</p>
              <p className="mt-2 truncate text-sm font-semibold text-stone-100">
                {status.version || "待读取"}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-stone-500">前台调用</p>
              <p className="mt-2 truncate text-sm font-semibold text-stone-100">
                /v1
              </p>
            </div>
          </div>

          {status.message ? (
            <p className="mt-4 rounded-lg border border-amber-200/20 bg-amber-200/10 px-4 py-3 text-xs leading-6 text-amber-50">
              {status.message}
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-black/30 text-stone-100">
              <ServerCog aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-stone-50">按用户隔离的计费结构</h2>
              <p className="mt-2 text-sm leading-7 text-stone-400">
                平台会为每个已登录用户自动关联灵穹 API 账户，并在服务端保管独立内部凭证。模型请求不会共用管理员 Token，也不会跨用户扣费。
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {[
              ["官网与画布", "/_wcu-api"],
              ["模型协议", "/v1"],
              ["容器内部", status.serverBaseUrl]
            ].map(([label, value]) => (
              <div
                className="flex flex-col gap-1 rounded-lg border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={label}
              >
                <span className="text-xs text-stone-500">{label}</span>
                <span className="break-all text-sm font-semibold text-stone-100">
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              onClick={() => void loadStatus()}
              type="button"
            >
              {loading ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw aria-hidden="true" className="h-4 w-4" />
              )}
              刷新状态
            </button>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              href="/users"
              rel="noreferrer"
              target="_blank"
            >
              <UsersRound aria-hidden="true" className="h-4 w-4" />
              用户与余额
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              href="/system-settings"
              rel="noreferrer"
              target="_blank"
            >
              <CreditCard aria-hidden="true" className="h-4 w-4" />
              支付渠道设置
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              href="/usage-logs"
              rel="noreferrer"
              target="_blank"
            >
              <ReceiptText aria-hidden="true" className="h-4 w-4" />
              用量记录
            </a>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-cyan-200/20 bg-cyan-200/10 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-200/25 bg-black/20 text-cyan-50">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-cyan-50">
              模型配置与用户计费已分离
            </h2>
            <p className="mt-2 text-xs leading-6 text-cyan-50/75">
              下方只管理可用模型、默认参数与系统提示词；灵穹 API 认证会自动使用当前用户的独立凭证。在支付商户参数配好前，前台只会显示可用的真实兑换方式，不会伪造支付成功。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
