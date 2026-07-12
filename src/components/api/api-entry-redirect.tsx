"use client";

import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Loader2, ShieldCheck, WandSparkles } from "lucide-react";

type OAuthStateResponse = {
  data?: string;
  message?: string;
  success?: boolean;
};

function fallbackToApiSignIn() {
  window.location.replace("/sign-in?redirect=%2Fdashboard");
}

export function ApiEntryRedirect({
  clientId,
  returnTo
}: {
  clientId: string;
  returnTo: string;
}) {
  const [message, setMessage] = useState("正在进入灵穹 API 用户端...");

  useEffect(() => {
    async function startUnifiedLogin() {
      try {
        // New API treats an OAuth callback received while another New API
        // session is active as an account-binding request. Always clear that
        // session first so a platform creator can never be attached to a
        // previously signed-in administrator (or another creator).
        const logoutResponse = await fetch("/api/user/logout", {
          cache: "no-store",
          credentials: "include"
        });
        const logoutPayload = (await logoutResponse
          .json()
          .catch(() => null)) as OAuthStateResponse | null;

        if (!logoutResponse.ok || logoutPayload?.success === false) {
          throw new Error(logoutPayload?.message || "无法清理旧的灵穹 API 会话");
        }

        const response = await fetch("/api/oauth/state", {
          cache: "no-store",
          credentials: "include"
        });
        const payload = (await response.json()) as OAuthStateResponse;

        if (!response.ok || !payload.success || !payload.data) {
          fallbackToApiSignIn();
          return;
        }

        const authorizationUrl = new URL(
          "/_wcu-api/oidc/authorize",
          window.location.origin
        );
        authorizationUrl.searchParams.set("client_id", clientId);
        authorizationUrl.searchParams.set(
          "redirect_uri",
          `${window.location.origin}/oauth/oidc`
        );
        authorizationUrl.searchParams.set("response_type", "code");
        authorizationUrl.searchParams.set("scope", "openid profile email");
        authorizationUrl.searchParams.set("state", payload.data);
        authorizationUrl.searchParams.set("return_to", returnTo);

        setMessage("正在通过战纪宇宙统一登录进入灵穹 API...");
        window.location.replace(authorizationUrl);
      } catch {
        fallbackToApiSignIn();
      }
    }

    void startUnifiedLogin();
  }, [clientId, returnTo]);

  return (
    <section className="relative grid min-h-screen place-items-center overflow-hidden bg-[#050506] px-6 text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(34,211,238,0.16),transparent_28rem),radial-gradient(circle_at_84%_72%,rgba(180,83,9,0.12),transparent_30rem)]" />
      <div className="cinema-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="relative w-full max-w-3xl rounded-lg border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
              <WandSparkles aria-hidden="true" className="h-4 w-4" />
              Lingqiong API
            </p>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight text-stone-50 md:text-6xl">
              正在进入灵穹 API
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-stone-300">
              这里是模型渠道、令牌、额度和调用日志的用户端。系统会使用战纪宇宙统一登录会话进入，无需重复登录。
            </p>
          </div>
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">
            <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["统一登录", "沿用战纪宇宙平台会话"],
            ["模型网关", "服务画布与生产线调用"],
            ["用户端首页", "进入仪表盘和 Playground"]
          ].map(([title, body]) => (
            <div
              className="rounded-lg border border-white/10 bg-zinc-950/50 p-4"
              key={title}
            >
              <p className="text-sm font-semibold text-stone-50">{title}</p>
              <p className="mt-2 text-xs leading-6 text-stone-500">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-stone-300">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-cyan-100" />
            <span>{message}</span>
          </div>
          <a
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/50 hover:bg-cyan-200/10"
            href={returnTo}
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            手动打开
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
