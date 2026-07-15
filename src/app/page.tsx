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
import { siteCopyLines, siteCopyRows, siteCopyValue } from "@/content/site";
import { getIcon } from "@/lib/icon-map";
import { getPlatformSiteData } from "@/lib/platform-api-client";

const homeIcons = {
  BookOpen: BookOpenCheck,
  Boxes,
  Clapperboard,
  MonitorPlay,
  WandSparkles
};

function homeIcon(key?: string) {
  return homeIcons[key as keyof typeof homeIcons] ?? Sparkles;
}

export default async function Home() {
  const data = await getPlatformSiteData();
  const {
    brand,
    media,
    pipelineSteps,
    proofPoints,
    universeChapters,
    works
  } = data;
  const platformLayers = siteCopyRows(data, "home.gateway.layers").map(
    ([title, summary, href, label, icon]) => ({
      href,
      icon: homeIcon(icon),
      label,
      summary,
      title
    })
  );
  const platformProducts = siteCopyRows(data, "home.modules.products").map(
    ([title, summary, href, label, icon]) => ({
      href,
      icon: homeIcon(icon),
      label,
      summary,
      title
    })
  );
  const visitorPaths = siteCopyRows(data, "home.entries.items");
  const collaborationPath = siteCopyRows(data, "home.delivery.steps");
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
              href={siteCopyValue(data, "home.hero.primaryHref", "/works")}
            >
              <Play aria-hidden="true" className="h-4 w-4" />
              {siteCopyValue(data, "home.hero.primaryLabel", "查看概念作品")}
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-zinc-950/35 px-5 py-3 text-sm font-semibold text-stone-100 backdrop-blur transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
              href={siteCopyValue(data, "home.hero.secondaryHref", "/services#contact")}
            >
              {siteCopyValue(data, "home.hero.secondaryLabel", "商务咨询")}
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
              {siteCopyValue(data, "home.gateway.eyebrow", "unified gateway")}
            </p>
            <h2 className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-tight text-stone-50 md:text-6xl">
              {siteCopyValue(
                data,
                "home.gateway.title",
                "一个官网入口，承接 IP、生产线和模型能力"
              )}
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300 md:text-lg">
              {siteCopyValue(
                data,
                "home.gateway.description",
                "访客看到的是战纪宇宙的作品与审美；创作者进入项目、画布和技能工作台；灵穹 API 与知识库在底层支撑模型调用、内容沉淀和交付复用。"
              )}
            </p>
          </div>
          <div className="grid gap-3">
            {platformLayers.map((layer) => {
              const Icon = layer.icon;

              return (
                <Link
                  className="group grid gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-200/45 hover:bg-cyan-200/10 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                href={layer.href || "/"}
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
                description={siteCopyValue(data, "home.modules.description")}
                eyebrow={siteCopyValue(data, "home.modules.eyebrow")}
                title={siteCopyValue(data, "home.modules.title")}
              />
              <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <p className="text-sm font-semibold text-stone-50">
                  {siteCopyValue(data, "home.modules.noteTitle", "统一入口原则")}
                </p>
                <p className="mt-3 text-sm leading-7 text-stone-400">
                  {siteCopyValue(data, "home.modules.noteBody")}
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {platformProducts.map((product) => {
                const Icon = product.icon;

                return (
                  <Link
                    className="group min-h-56 rounded-lg border border-white/10 bg-white/[0.035] p-6 transition hover:border-cyan-200/45 hover:bg-cyan-200/10"
                    href={product.href || "/"}
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
            description={siteCopyValue(data, "home.position.description")}
            eyebrow={siteCopyValue(data, "home.position.eyebrow")}
            title={siteCopyValue(data, "home.position.title")}
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
            description={siteCopyValue(data, "home.entries.description")}
            eyebrow={siteCopyValue(data, "home.entries.eyebrow")}
            title={siteCopyValue(data, "home.entries.title")}
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {visitorPaths.map(([title, body, href, label], index) => (
              <Link
                className="group rounded-lg border border-white/10 bg-white/[0.035] p-6 transition hover:border-cyan-200/45 hover:bg-cyan-200/10"
                href={href || "/"}
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
                {siteCopyValue(data, "home.spark.kicker", "first project")}
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-stone-50">
                {siteCopyValue(data, "home.spark.imageTitle", "战纪宇宙001：《火种》")}
              </h2>
            </div>
          </div>
          <div>
            <SectionHeading
              description={siteCopyValue(data, "home.spark.description")}
              eyebrow={siteCopyValue(data, "home.spark.eyebrow")}
              title={siteCopyValue(data, "home.spark.title")}
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {siteCopyLines(data, "home.spark.deliverables").map(
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
              href={siteCopyValue(data, "home.spark.buttonHref", "/universe")}
            >
              {siteCopyValue(data, "home.spark.buttonLabel", "进入世界观")}
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
                description={siteCopyValue(data, "home.delivery.description")}
                eyebrow={siteCopyValue(data, "home.delivery.eyebrow")}
                title={siteCopyValue(data, "home.delivery.title")}
              />
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
                  href={siteCopyValue(data, "home.delivery.primaryHref", "/services#contact")}
                >
                  {siteCopyValue(data, "home.delivery.primaryLabel", "开始商务咨询")}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
                  href={siteCopyValue(data, "home.delivery.secondaryHref", "/projects")}
                >
                  {siteCopyValue(data, "home.delivery.secondaryLabel", "查看项目工作台")}
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
              description={siteCopyValue(data, "home.workflow.description")}
              eyebrow={siteCopyValue(data, "home.workflow.eyebrow")}
              title={siteCopyValue(data, "home.workflow.title")}
            />
            <Link
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
              href="/workflow"
            >
              {siteCopyValue(data, "home.workflow.buttonLabel", "查看完整流程")}
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
            description={siteCopyValue(data, "home.works.description")}
            eyebrow={siteCopyValue(data, "home.works.eyebrow")}
            title={siteCopyValue(data, "home.works.title")}
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
              {siteCopyValue(data, "home.works.buttonLabel", "查看灵穹知识库")}
            </Link>
          </div>
        </div>
      </section>

      <CtaBand data={data} />
    </>
  );
}
