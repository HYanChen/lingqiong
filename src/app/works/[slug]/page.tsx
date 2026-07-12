import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Clapperboard } from "lucide-react";
import { notFound } from "next/navigation";

import { CtaBand } from "@/components/cta-band";
import { getPlatformSiteData } from "@/lib/platform-api-client";

type WorkDetailPageProps = {
  params: Promise<{ slug: string }>;
};

async function findWork(slug: string) {
  const data = await getPlatformSiteData();
  const decodedSlug = decodeURIComponent(slug);

  return {
    data,
    work: data.works.find((item) => item.slug === decodedSlug)
  };
}

export async function generateMetadata({
  params
}: WorkDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { work } = await findWork(slug);

  if (!work) {
    return { title: "作品未找到" };
  }

  return {
    title: work.title,
    description: work.logline,
    openGraph: {
      description: work.logline,
      images: [{ alt: `${work.title} 概念图`, url: work.image }],
      title: work.title,
      type: "article"
    }
  };
}

export default async function WorkDetailPage({ params }: WorkDetailPageProps) {
  const { slug } = await params;
  const { work } = await findWork(slug);

  if (!work) {
    notFound();
  }

  return (
    <>
      <article>
        <section className="relative isolate min-h-[72vh] overflow-hidden px-5 pb-16 pt-36 md:px-8">
          <Image
            alt={`${work.title} 概念视觉`}
            className="absolute inset-0 -z-20 h-full w-full object-cover"
            fill
            priority
            sizes="100vw"
            src={work.image}
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(9,9,11,0.94),rgba(9,9,11,0.48),rgba(9,9,11,0.78))]" />
          <div className="cinema-grid absolute inset-0 -z-10 opacity-35" />
          <div className="mx-auto flex min-h-[56vh] max-w-7xl flex-col justify-end">
            <Link
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-cyan-100 transition hover:text-cyan-50"
              href="/works"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              返回作品库
            </Link>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
              {work.category}
            </p>
            <h1 className="mt-5 max-w-5xl text-balance text-5xl font-semibold leading-[0.95] text-stone-50 md:text-7xl">
              {work.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-9 text-stone-200">
              {work.logline}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <span className="rounded-lg border border-amber-200/25 bg-amber-200/10 px-4 py-2 text-amber-100">
                {work.status}
              </span>
              <span className="rounded-lg border border-white/15 bg-black/25 px-4 py-2 text-stone-200">
                {work.format}
              </span>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
                project status
              </p>
              <h2 className="mt-5 text-balance text-3xl font-semibold text-stone-50 md:text-5xl">
                当前开发范围与可交付资产
              </h2>
              <p className="mt-5 text-base leading-8 text-stone-300">
                页面按当前真实状态展示，不把概念样板写成已上线成片。合作可从其中一个交付物开始，再逐步扩展为完整生产包。
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {work.tags.map((tag) => (
                  <span
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-stone-300"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {work.deliverables.map((item, index) => (
                <div
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-6"
                  key={item}
                >
                  <div className="flex items-center justify-between gap-4">
                    <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-cyan-100" />
                    <span className="font-mono text-sm text-amber-200">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-stone-50">{item}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-black/24 px-5 py-16 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-100">下一步</p>
              <h2 className="mt-3 text-3xl font-semibold text-stone-50">
                让这套概念资产进入实际制作
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
                href="/services#contact"
              >
                商务咨询
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
                href="/projects"
              >
                <Clapperboard aria-hidden="true" className="h-4 w-4" />
                进入创作台
              </Link>
            </div>
          </div>
        </section>
      </article>
      <CtaBand />
    </>
  );
}
