"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";

type AdminLoginResponse = {
  message?: string;
  ok?: boolean;
  user?: {
    username: string;
  };
};

export function AdminLogin({ sessionError = "" }: { sessionError?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(sessionError);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/_wcu-api/admin/login", {
        body: JSON.stringify({ password, username: username.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as
        | AdminLoginResponse
        | null;

      if (!response.ok || !result?.ok || !result.user) {
        setError(result?.message ?? "登录失败，请检查管理员账号和密码。");
        return;
      }

      window.location.replace("/admin");
    } catch {
      setError("后台登录服务暂时不可用，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-5 py-12 text-stone-100">
      <div className="pointer-events-none absolute inset-0 cinema-grid opacity-25" />
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-cyan-400/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-blue-500/10 blur-[130px]" />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex min-h-72 flex-col justify-between border-b border-white/10 bg-gradient-to-br from-cyan-950/50 via-zinc-950 to-zinc-950 p-7 lg:min-h-[610px] lg:border-b-0 lg:border-r lg:p-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl border border-cyan-300/35 bg-cyan-300/10 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                <Sparkles aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg font-semibold text-white">战纪宇宙</p>
                <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">
                  War Chronicle Universe
                </p>
              </div>
            </div>

            <p className="mt-12 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
              Administration
            </p>
            <h1 className="mt-5 max-w-md text-balance text-4xl font-semibold leading-tight text-white md:text-5xl">
              管理后台
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-stone-400">
              官网内容、用户与权限、模型渠道、知识库及平台运行数据的受控管理空间。
            </p>
          </div>

          <div className="mt-10 flex items-start gap-3 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.06] p-4 text-xs leading-6 text-cyan-50/75">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
            <p>此页面仅供授权管理人员使用。登录行为会被记录到后台审计日志。</p>
          </div>
        </aside>

        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Secure sign in
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-white">管理员登录</h2>
            <p className="mt-3 text-sm leading-7 text-stone-500">
              请输入已授权的后台账号与密码。
            </p>
          </div>

          <form className="mt-9 grid gap-5" onSubmit={submit}>
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                <UserRound aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                管理员账号
              </span>
              <input
                autoCapitalize="none"
                autoComplete="username"
                autoFocus
                className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-200/10"
                disabled={loading}
                name="username"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入管理员账号"
                required
                spellCheck={false}
                type="text"
                value={username}
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                <KeyRound aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                管理员密码
              </span>
              <span className="relative mt-2 block">
                <input
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 pr-12 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-200/10"
                  disabled={loading}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入管理员密码"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-lg text-stone-500 transition hover:bg-white/10 hover:text-stone-200"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Eye aria-hidden="true" className="h-4 w-4" />
                  )}
                </button>
              </span>
            </label>

            {error ? (
              <p
                aria-live="polite"
                className="flex items-start gap-2 rounded-xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm leading-6 text-red-100"
                role="alert"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            ) : null}

            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-100 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              )}
              {loading ? "正在验证" : "进入管理后台"}
            </button>
          </form>

          <div className="mt-8 border-t border-white/10 pt-6">
            <Link
              className="text-sm text-stone-500 transition hover:text-cyan-100"
              href="/"
            >
              返回官网首页
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
