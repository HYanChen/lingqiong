"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Gift,
  Sparkles,
  X
} from "lucide-react";

import type { Brand } from "@/content/site";
import {
  clearFrontUser,
  frontAuthChangedEvent,
  readFrontUser,
  writeFrontUser,
  type FrontUser
} from "@/lib/front-auth";
import { cn } from "@/lib/utils";

export function SiteLogin({ brand }: { brand: Brand }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"phone" | "account">("phone");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<FrontUser | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function syncUser() {
      setUser(readFrontUser());
    }

    const timer = window.setTimeout(() => {
      const existingUser = readFrontUser();
      const shouldAutoOpen =
        !pathname.startsWith("/admin") && pathname !== "/register";

      setUser(existingUser);
      setMounted(true);

      if (!existingUser && shouldAutoOpen) {
        setOpen(true);
      }
    }, 450);

    window.addEventListener(frontAuthChangedEvent, syncUser);
    window.addEventListener("storage", syncUser);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(frontAuthChangedEvent, syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, [pathname]);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextUser: FrontUser = {
      account: account || "战纪创作者",
      createdAt: new Date().toISOString(),
      source: "login"
    };

    writeFrontUser(nextUser);
    setUser(nextUser);
    setMessage("登录成功，已进入创作者工作台。");
    window.setTimeout(() => {
      setOpen(false);
      router.push("/workflow");
    }, 650);
  }

  function logout() {
    clearFrontUser();
    setUser(null);
    setMessage("");
    setOpen(true);
  }

  if (!mounted) {
    return null;
  }

  return (
    <>
      <div className="hidden items-center gap-3 lg:flex">
        <button
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-semibold transition",
            user
              ? "border border-cyan-200/25 bg-cyan-200/10 text-cyan-50 hover:bg-cyan-200/15"
              : "bg-stone-50 text-zinc-950 hover:bg-cyan-100"
          )}
          onClick={() => (user ? router.push("/workflow") : setOpen(true))}
          type="button"
        >
          {user ? "创作者工作台" : "注册/登录"}
        </button>
        {user ? (
          <button
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-stone-300 transition hover:bg-white/10 hover:text-white"
            onClick={logout}
            type="button"
          >
            退出
          </button>
        ) : null}
      </div>

      <button
        className="rounded-lg bg-stone-50 px-4 py-3 text-left text-base font-semibold text-zinc-950 transition hover:bg-cyan-100 lg:hidden"
        onClick={() => (user ? router.push("/workflow") : setOpen(true))}
        type="button"
      >
        {user ? "创作者工作台" : "注册/登录"}
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/72 px-4 py-8 backdrop-blur-xl"
          role="dialog"
        >
          <div className="relative grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0b] shadow-2xl md:grid-cols-[1.05fr_0.95fr]">
            <button
              aria-label="关闭登录弹窗"
              className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-black/40 text-stone-200 transition hover:bg-white/10"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>

            <div className="relative hidden min-h-[560px] overflow-hidden md:block">
              <div className="absolute inset-0 bg-[url('/media/workflow-studio.png')] bg-cover bg-center opacity-78" />
              <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/38 to-cyan-950/34" />
              <div className="absolute inset-x-6 top-6 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-100">
                  <Gift aria-hidden="true" className="h-4 w-4" />
                  创作者挑战赛
                </span>
                <span className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-stone-200">
                  限时开放
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100">
                  {brand.english}
                </p>
                <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight text-stone-50">
                  登录后进入 AI 影视创作大厅
                </h2>
                <p className="mt-4 max-w-md text-sm leading-7 text-stone-300">
                  浏览生产线、作品样板和服务模板，像 LibTV 一样从创作入口直接进入内容流。
                </p>
                <div className="mt-6 grid gap-3">
                  {["生产线卡片", "作品展示", "商务交付"].map((item) => (
                    <div
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-stone-200"
                      key={item}
                    >
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-h-[92vh] overflow-y-auto px-5 py-8 md:px-8 md:py-10">
              <div className="mb-8 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-lg border border-cyan-300/35 bg-cyan-300/10 text-cyan-100">
                  <Sparkles aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xl font-semibold text-stone-50">{brand.name}</p>
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Creator Login
                  </p>
                </div>
              </div>

              <h2 className="text-3xl font-semibold text-stone-50">登录</h2>
              <p className="mt-3 text-sm leading-7 text-stone-400">
                当前为本地前台登录体验，用于进入创作者工作台视觉状态。
              </p>

              <div className="mt-6 grid grid-cols-2 rounded-lg border border-white/10 bg-white/[0.035] p-1">
                {[
                  ["phone", "手机号登录"],
                  ["account", "账号密码"]
                ].map(([id, label]) => (
                  <button
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm transition",
                      mode === id
                        ? "bg-stone-50 text-zinc-950"
                        : "text-stone-400 hover:text-white"
                    )}
                    key={id}
                    onClick={() => setMode(id as "phone" | "account")}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form className="mt-6 space-y-4" onSubmit={login}>
                <label className="block">
                  <span className="text-xs font-medium text-stone-400">
                    {mode === "phone" ? "手机号 / 微信号" : "账号"}
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-white/[0.035] px-4 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70"
                    onChange={(event) => setAccount(event.target.value)}
                    placeholder={mode === "phone" ? "请输入手机号或微信号" : "请输入账号"}
                    value={account}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-stone-400">
                    {mode === "phone" ? "验证码 / 临时密码" : "密码"}
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-white/[0.035] px-4 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "phone" ? "输入任意验证码即可体验" : "输入任意密码即可体验"}
                    type="password"
                    value={password}
                  />
                </label>

                {message ? (
                  <p className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    {message}
                  </p>
                ) : null}

                <button
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-stone-50 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
                  type="submit"
                >
                  进入创作大厅
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-6 grid gap-3">
                <button
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                  onClick={() => {
                    setAccount("demo");
                    setPassword("demo");
                    window.setTimeout(() => {
                      const nextUser: FrontUser = {
                        account: "demo",
                        createdAt: new Date().toISOString(),
                        source: "demo"
                      };
                      writeFrontUser(nextUser);
                      setUser(nextUser);
                      setMessage("已使用体验账号登录。");
                      setOpen(false);
                      router.push("/workflow");
                    }, 120);
                  }}
                  type="button"
                >
                  <Clapperboard aria-hidden="true" className="h-4 w-4" />
                  快速体验
                </button>
                <button
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18"
                  onClick={() => {
                    setOpen(false);
                    router.push("/register");
                  }}
                  type="button"
                >
                  邀请码注册
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
