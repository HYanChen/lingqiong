import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-screen items-center justify-center px-5 pt-24">
      <div className="max-w-xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
          404
        </p>
        <h1 className="mt-5 text-4xl font-semibold text-stone-50">
          这个镜头还没有生成
        </h1>
        <p className="mt-5 text-base leading-8 text-stone-300">
          当前页面不存在，回到首页继续浏览战纪宇宙。
        </p>
        <Link
          className="mt-8 inline-flex rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
          href="/"
        >
          回到首页
        </Link>
      </div>
    </section>
  );
}
