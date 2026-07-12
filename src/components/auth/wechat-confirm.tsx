"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, QrCode, Smartphone, XCircle } from "lucide-react";

type ConfirmResponse = {
  message?: string;
  ok?: boolean;
};

export function WechatConfirm({ brandName }: { brandName: string }) {
  const searchParams = useSearchParams();
  const ticket = searchParams.get("ticket") ?? "";
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!ticket) {
      setError("缺少登录二维码票据，请回到电脑端刷新二维码。");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/_wcu-api/auth/wechat/confirm", {
        body: JSON.stringify({ ticket }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as ConfirmResponse | null;

      if (!response.ok || !result?.ok) {
        setError(result?.message ?? "确认失败，请刷新二维码后重试。");
        return;
      }

      setConfirmed(true);
    } catch {
      setError("网络暂时不可用，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-screen bg-[#050505] px-5 py-12 text-stone-100">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center">
        <div className="w-full rounded-lg border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-950/20">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
              <Smartphone aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xl font-semibold text-stone-50">微信扫码确认</p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-stone-500">
                {brandName}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-cyan-200/15 bg-cyan-200/10 p-5">
            <QrCode aria-hidden="true" className="h-6 w-6 text-cyan-100" />
            <p className="mt-4 text-sm leading-7 text-cyan-50/80">
              确认后，电脑端登录页会自动进入统一平台。二维码仅短时间有效，请确认是本人操作。
            </p>
          </div>

          {confirmed ? (
            <p className="mt-6 flex items-start gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm leading-6 text-emerald-100">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              已确认登录，请回到电脑浏览器继续使用。
            </p>
          ) : null}

          {error ? (
            <p className="mt-6 flex items-start gap-2 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm leading-6 text-red-100">
              <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <button
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-stone-50 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || confirmed}
            onClick={() => void confirm()}
            type="button"
          >
            {loading ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            )}
            {confirmed ? "已确认" : "确认登录"}
          </button>
        </div>
      </div>
    </section>
  );
}
