import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Clapperboard,
  MonitorPlay,
  Play,
  Sparkles,
  WandSparkles
} from "lucide-react";

import { CtaBand } from "@/components/cta-band";
import { HeroVideo } from "@/components/hero-video";
import { PipelineList } from "@/components/pipeline-list";
import { SectionHeading } from "@/components/section-heading";
import { WorkCard } from "@/components/work-card";
import { getIcon } from "@/lib/icon-map";
import { getPlatformSiteData } from "@/lib/platform-api-client";

const platformLayers = [
  {
    title: "IP 官网层",
    summary: "用战纪宇宙承接对外传播，把世界观、作品状态和服务样板集中展示。",
    href: "/works",
    label: "查看作品",
    icon: MonitorPlay
  },
  {
    title: "创作生产层",
    summary: "把项目、剧集、资产、分镜、配音和合成收进同一个创作者工作台。",
    href: "/projects",
    label: "进入项目",
    icon: Clapperboard
  },
  {
    title: "模型知识层",
    summary: "灵穹 API、知识库和 Skill 工作台为生产线提供模型调用与经验沉淀。",
    href: "/skills",
    label: "进入工作台",
    icon: WandSparkles
  }
];

const platformProducts = [
  {
    title: "我的项目",
    summary: "创建、编辑、导出和管理个人 AI 影视项目，项目数据按用户归属保存。",
    href: "/projects",
    label: "进入项目",
    icon: Clapperboard
  },
  {
    title: "生产管理",
    summary: "在项目内完成剧集、素材、分镜、配音和合成的连续生产管理。",
    href: "/workflow",
    label: "查看生产线",
    icon: Boxes
  },
  {
    title: "灵穹 API",
    summary: "统一管理模型渠道、令牌和调用能力，供画布、Skill 和生产线使用。",
    href: "/api",
    label: "进入 API",
    icon: WandSparkles
  },
  {
    title: "灵穹知识库",
    summary: "沉淀世界观、制作规范、提示词经验和项目交付文档。",
    href: "/knowledge",
    label: "查看知识库",
    icon: BookOpenCheck
  }
];

const visitorPaths = [
  ["观众与合作方", "先看世界观与概念作品，理解战纪宇宙的审美、题材和项目状态。", "/works", "查看作品"],
  ["创作者", "登录后进入我的项目，选择类型、画面比例、风格和封面，继续进入生产工作台。", "/projects", "创建项目"],
  ["制作团队", "用灵穹 API、Skill 工作台和知识库串联模型调用、流程复用和交付记录。", "/skills", "进入工作台"]
];

const collaborationPath = [
  ["01", "确定叙事资产", "明确故事、受众、风格、画面比例和首批可交付物。"],
  ["02", "搭建项目母档", "沉淀人物、场景、物件、提示词和镜头表，形成可继续更新的资产库。"],
  ["03", "生成概念样片", "通过灵穹 API 与项目任务队列完成首轮图片、视频和修订回收。"],
  ["04", "组织招商交付", "输出作品页、概念预告、宣发切片和商务沟通材料。"]
];

export default async function Home() {
  const {
    brand,
    media,
    pipelineSteps,
    proofPoints,
    universeChapters,
    works
  } = await getPlatformSiteData();
  const featuredWorks = works.slice(0, 3);

  return (
    <>
      <section className="relative isolate min-h-screen overflow-hidden pt-24">
        <Image
          alt="战纪宇宙电影棚概念视觉"
          className="absolute inset-0 z-0 h-full w-full object-cover"
          fill
          priority
          sizes="100vw"
          src={media.hero}
        />
        {media.heroVideo ? <HeroVideo poster={media.hero} src={media.heroVideo} /> : null}
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_24%_78%,rgba(8,145,178,0.16),transparent_32rem),radial-gradient(circle_at_82%_78%,rgba(180,83,9,0.12),transparent_30rem)]" />
        <div className="soft-vignette absolute inset-0 z-[3] bg-[linear-gradient(90deg,rgba(9,9,11,0.72),rgba(9,9,11,0.18),rgba(9,9,11,0.62))]" />
        <div className="cinema-grid absolute inset-0 z-[4] opacity-40" />
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-7xl flex-col justify-end px-5 pb-14 md:px-8">
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

      <section className="relative overflow-hidden border-y border-white/10 bg-[#07090a] px-5 py-20 md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(34,211,238,0.12),transparent_24rem),radial-gradient(circle_at_88%_72%,rgba(217,119,6,0.10),transparent_26rem)]" />
        <div className="cinema-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
              unified gateway
            </p>
            <h2 className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-tight text-stone-50 md:text-6xl">
              一个官网入口，承接 IP、生产线和模型能力
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300 md:text-lg">
              访客看到的是战纪宇宙的作品与审美；创作者进入项目、画布和技能工作台；灵穹 API 与知识库在底层支撑模型调用、内容沉淀和交付复用。
            </p>
          </div>
          <div className="grid gap-3">
            {platformLayers.map((layer) => {
              const Icon = layer.icon;

              return (
                <Link
                  className="group grid gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-200/45 hover:bg-cyan-200/10 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  href={layer.href}
                  key={layer.title}
                >
                  <span className="grid h-12 w-12 place-items-center rounded-lg border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
                    <Icon aria-hidden="true" className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-lg font-semibold text-stone-50">
                      {layer.title}
                    </span>
                    <span className="mt-2 block text-sm leading-7 text-stone-300">
                      {layer.summary}
                    </span>
                  </span>
                  <span className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-cyan-100">
                    {layer.label}
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <SectionHeading
                description="官网不是孤立展示页，而是统一平台的对外入口。用户登录一次后，可以进入项目、生产管理、API、知识库和 Skill 工作台，所有能力围绕同一套影视生产资料流动。"
                eyebrow="platform modules"
                title="把官网、创作和模型能力收进一个平台"
              />
              <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <p className="text-sm font-semibold text-stone-50">统一入口原则</p>
                <p className="mt-3 text-sm leading-7 text-stone-400">
                  官网面向展示与招商，登录面向创作者协作；各子系统通过统一会话进入。
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {platformProducts.map((product) => {
                const Icon = product.icon;

                return (
                  <Link
                    className="group min-h-56 rounded-lg border border-white/10 bg-white/[0.035] p-6 transition hover:border-cyan-200/45 hover:bg-cyan-200/10"
                    href={product.href}
                    key={product.title}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid h-12 w-12 place-items-center rounded-lg border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
                        <Icon aria-hidden="true" className="h-6 w-6" />
                      </span>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">
                        {product.label}
                        <ArrowRight
                          aria-hidden="true"
                          className="h-4 w-4 transition group-hover:translate-x-1"
                        />
                      </span>
                    </div>
                    <h3 className="mt-7 text-2xl font-semibold text-stone-50">
                      {product.title}
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-stone-300">
                      {product.summary}
                    </p>
                  </Link>
                );
              })}
            </div>
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

      <section className="border-y border-white/10 bg-[#080808] px-5 py-20 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            align="center"
            description="不同访问者看到同一个品牌入口，但进入路径不同：公开页面负责展示，登录后的工作台负责创作，模型与知识库负责支撑生产。"
            eyebrow="entry paths"
            title="一套官网，三种进入方式"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {visitorPaths.map(([title, body, href, label], index) => (
              <Link
                className="group rounded-lg border border-white/10 bg-white/[0.035] p-6 transition hover:border-cyan-200/45 hover:bg-cyan-200/10"
                href={href}
                key={title}
              >
                <p className="font-mono text-sm text-amber-200">0{index + 1}</p>
                <h3 className="mt-5 text-2xl font-semibold text-stone-50">
                  {title}
                </h3>
                <p className="mt-4 min-h-24 text-sm leading-7 text-stone-300">
                  {body}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">
                  {label}
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition group-hover:translate-x-1"
                  />
                </span>
              </Link>
            ))}
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
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <SectionHeading
                description="每一次合作都先落到可验证的资产和样片上，避免只停留在概念口号里。官网展示、项目工作台、模型调用和知识沉淀会围绕同一套项目资料持续更新。"
                eyebrow="delivery path"
                title="从一个想法，到一套可展示的交付包"
              />
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
                  href="/services#contact"
                >
                  开始商务咨询
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
                  href="/projects"
                >
                  查看项目工作台
                  <Boxes aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {collaborationPath.map(([step, title, body]) => (
                <article
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-6"
                  key={step}
                >
                  <p className="font-mono text-sm text-amber-200">{step}</p>
                  <h3 className="mt-5 text-2xl font-semibold text-stone-50">
                    {title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-stone-300">{body}</p>
                </article>
              ))}
            </div>
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
            description="这里展示当前已经整理的概念资产、开发中作品与服务样板；每个条目都明确标注真实状态。"
            eyebrow="works"
            title="概念作品与服务样板"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {featuredWorks.map((work) => (
              <WorkCard key={work.slug} work={work} />
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Link
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
              href="/knowledge"
            >
              <BookOpenCheck aria-hidden="true" className="h-4 w-4" />
              查看灵穹知识库
            </Link>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
