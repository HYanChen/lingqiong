import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clapperboard, Play, Sparkles } from "lucide-react";

import { CtaBand } from "@/components/cta-band";
import { PipelineList } from "@/components/pipeline-list";
import { SectionHeading } from "@/components/section-heading";
import { WorkCard } from "@/components/work-card";
import { getIcon } from "@/lib/icon-map";
import { getSiteData } from "@/lib/site-data";

export default async function Home() {
  const {
    brand,
    media,
    pipelineSteps,
    proofPoints,
    universeChapters,
    works
  } = await getSiteData();
  const featuredWorks = works.slice(0, 3);

  return (
    <>
      <section className="relative min-h-screen overflow-hidden pt-24">
        <Image
          alt="战纪宇宙电影棚概念视觉"
          className="absolute inset-0 -z-30 h-full w-full object-cover"
          fill
          priority
          sizes="100vw"
          src={media.hero}
        />
        <div className="soft-vignette absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(9,9,11,0.84),rgba(9,9,11,0.18),rgba(9,9,11,0.62))]" />
        <div className="cinema-grid absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-7xl flex-col justify-end px-5 pb-14 md:px-8">
          <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-cyan-200/30 bg-cyan-200/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            {brand.english}
          </p>
          <h1 className="mt-7 max-w-5xl text-balance text-6xl font-semibold leading-[0.9] text-stone-50 md:text-8xl">
            {brand.name}
          </h1>
          <p className="mt-6 max-w-3xl text-pretty text-xl leading-9 text-stone-200 md:text-2xl">
            {brand.tagline}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
              href="/works"
            >
              <Play aria-hidden="true" className="h-4 w-4" />
              查看概念作品
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-zinc-950/35 px-5 py-3 text-sm font-semibold text-stone-100 backdrop-blur transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
              href="/services#contact"
            >
              商务咨询
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {proofPoints.map((point) => (
              <div
                className="rounded-lg border border-white/10 bg-zinc-950/48 px-4 py-3 text-sm text-stone-200 backdrop-blur"
                key={point}
              >
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionHeading
            description="战纪宇宙不是单个短片项目，而是一套可持续更新的原创影像宇宙。IP 负责出圈与审美证明，灵穹的 AI 影视制作服务负责把策划、资产、分镜和视频交付变成可复用能力。"
            eyebrow="brand position"
            title="以一个宇宙，承载一条 AI 影视生产线"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {universeChapters.slice(0, 3).map((chapter) => {
              const Icon = getIcon(chapter.icon);

              return (
                <article
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-5"
                  key={chapter.title}
                >
                  <Icon aria-hidden="true" className="h-6 w-6 text-cyan-100" />
                  <h3 className="mt-5 text-lg font-semibold text-stone-50">
                    {chapter.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-stone-300">
                    {chapter.summary}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-black/24 px-5 py-24 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-white/10">
            <Image
              alt="战纪宇宙001火种概念视觉"
              className="h-full w-full object-cover"
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              src={media.spark}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-100">
                first project
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-stone-50">
                战纪宇宙001：《火种》
              </h2>
            </div>
          </div>
          <div>
            <SectionHeading
              description="一枚旧军功章，一本战地日记，一个后代的现实选择。《火种》是战纪宇宙的第一部代表项目，当前定位为开发中和概念样片阶段。"
              eyebrow="the spark"
              title="先把第一部做成能展示、能发布、能招商的样片包"
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {["IP 圣经 V1", "24 集分集大纲", "前 3 集剧本", "角色与场景资产库"].map(
                (item) => (
                  <div
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-stone-200"
                    key={item}
                  >
                    {item}
                  </div>
                )
              )}
            </div>
            <Link
              className="mt-8 inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
              href="/universe"
            >
              进入世界观
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              description="从策划、剧本、资产库、分镜到提示词和成片交付，每一步都留下可复用产物。"
              eyebrow="workflow"
              title="AI 影视生产线"
            />
            <Link
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
              href="/workflow"
            >
              查看完整流程
              <Clapperboard aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10">
            <PipelineList compact steps={pipelineSteps} />
          </div>
        </div>
      </section>

      <section className="bg-black/24 px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            align="center"
            description="这里展示的是首版概念资产与服务模板，正式上线前可继续替换为真实样片、预告片和客户案例。"
            eyebrow="works"
            title="概念作品与服务样板"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {featuredWorks.map((work) => (
              <WorkCard key={work.slug} work={work} />
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
