import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TeamMemberNotFound() {
  return (
    <section className="grid min-h-screen place-items-center px-5 pt-24">
      <div className="max-w-xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
          profile not found
        </p>
        <h1 className="mt-5 text-4xl font-semibold text-stone-50">
          人物资料不存在
        </h1>
        <p className="mt-5 text-base leading-8 text-stone-300">
          这位成员可能已调整公开状态或从团队名单中移除。
        </p>
        <Link
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
          href="/about#team"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          返回团队与顾问
        </Link>
      </div>
    </section>
  );
}
