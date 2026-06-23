"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  UserRound
} from "lucide-react";

import type { Brand, MediaMap } from "@/content/site";
import { writeFrontUser } from "@/lib/front-auth";
import { cn } from "@/lib/utils";

const profiles = ["导演/制片", "编剧/策划", "品牌/文旅", "AI创作者"];

type InviteVerifyResponse = {
  message?: string;
  ok: boolean;
  user?: {
    account: string;
    contact?: string;
    createdAt: string;
    id: string;
    inviteCode?: string;
    profile?: string;
    source: "invite";
  };
};

export function InviteRegister({
  brand,
  media
}: {
  brand: Brand;
  media: MediaMap;
}) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [account, setAccount] = useState("");
  const [contact, setContact] = useState("");
  const [profile, setProfile] = useState(profiles[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canSubmit = useMemo(
    () => inviteCode.trim().length > 0 && !loading,
    [inviteCode, loading]
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!inviteCode.trim()) {
      setError("请输入邀请码。");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        body: JSON.stringify({ account, contact, inviteCode, profile }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = (await response
        .json()
        .catch(() => null)) as InviteVerifyResponse | null;

      if (!response.ok || !result?.ok || !result.user) {
        setError(result?.message ?? "邀请码无效或已过期。");
        return;
      }

      writeFrontUser(result.user);
      setSuccess("邀请码验证通过，正在进入创作大厅。");
      window.setTimeout(() => router.push("/workflow"), 650);
    } catch {
      setError("网络暂时不可用，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-screen overflow-hidden bg-[#050505] px-5 pb-16 pt-28 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
        <aside className="relative min-h-[420px] overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
          <Image
            alt="战纪宇宙创作者注册视觉"
            className="h-full w-full object-cover opacity-76"
            fill
            priority
            sizes="(min-width: 1024px) 46vw, 100vw"
            src={media.workflow}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/92 via-black/42 to-cyan-950/30" />
          <div className="absolute inset-0 cinema-grid opacity-35" />
          <div className="relative z-10 flex min-h-[420px] flex-col justify-end p-6 md:p-8">
            <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              {brand.english}
            </p>
            <h1 className="mt-5 max-w-xl text-balance text-4xl font-semibold leading-tight text-stone-50 md:text-6xl">
              邀请码注册
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-stone-300">
              进入战纪宇宙创作者工作台前，需要先完成邀请码校验。
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["01", "邀请码校验"],
                ["02", "创作者建档"],
                ["03", "进入生产线"]
              ].map(([step, label]) => (
                <div
                  className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 backdrop-blur"
                  key={step}
                >
                  <p className="text-xs font-semibold text-cyan-100">{step}</p>
                  <p className="mt-2 text-sm text-stone-200">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg border border-cyan-300/35 bg-cyan-300/10 text-cyan-100">
              <TicketCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xl font-semibold text-stone-50">{brand.name}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Invite Only
              </p>
            </div>
          </div>

          <form className="mt-8 grid gap-5" onSubmit={submit}>
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                <KeyRound aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                邀请码
              </span>
              <input
                autoComplete="one-time-code"
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-4 text-sm uppercase tracking-[0.08em] text-stone-100 outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-stone-600 focus:border-cyan-200/70"
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="请输入邀请码"
                value={inviteCode}
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                  <UserRound aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                  创作者名称
                </span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-4 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70"
                  onChange={(event) => setAccount(event.target.value)}
                  placeholder="战纪创作者"
                  value={account}
                />
              </label>

              <label className="block">
                <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                  手机号 / 微信号
                </span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-4 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70"
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="用于合作联系"
                  value={contact}
                />
              </label>
            </div>

            <div>
              <p className="text-sm font-medium text-stone-300">身份类型</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {profiles.map((item) => (
                  <button
                    className={cn(
                      "rounded-lg border px-4 py-3 text-sm transition",
                      profile === item
                        ? "border-cyan-200 bg-cyan-200 text-zinc-950"
                        : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-cyan-200/50 hover:text-white"
                    )}
                    key={item}
                    onClick={() => setProfile(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <p className="flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
                <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                {error}
              </p>
            ) : null}

            {success ? (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                {success}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-stone-50 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canSubmit}
                type="submit"
              >
                {loading ? "验证中" : "验证邀请码并注册"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
              <Link
                className="inline-flex h-12 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                href="/workflow"
              >
                已有账号，去登录
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
