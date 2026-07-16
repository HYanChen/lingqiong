"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  Plus,
  Search,
  Sparkles
} from "lucide-react";

import {
  siteCopyLines,
  siteCopyRows,
  siteCopyValue,
  type SiteData
} from "@/content/site";
import { getIcon } from "@/lib/icon-map";
import { cn } from "@/lib/utils";

type StudioCard = {
  actionLabel: string;
  id: string;
  title: string;
  creator: string;
  category: string;
  href: string;
  image: string;
  summary: string;
  process: string;
  badge: string;
  tags: string[];
};

function buildCards(data: SiteData): StudioCard[] {
  const { media, services, pipelineSteps: steps, works } = data;
  const stepImages = [
    media.workflow,
    media.spark,
    media.services,
    media.workflow,
    media.generations,
    media.workflow,
    media.hero,
    media.services
  ];
  const stepCategories = [
    "AI影视流程",
    "专业影视",
    "专业影视",
    "TV工具箱",
    "AI影视流程",
    "TV工具箱",
    "AI影视流程",
    "专业影视"
  ];

  const workflowCards = steps.map((step, index) => ({
    actionLabel: siteCopyValue(data, "workflow.actions.process", "用此流程创建项目"),
    id: `step-${step.eyebrow}`,
    title: `${step.eyebrow} ${step.title}`,
    creator: siteCopyValue(data, "workflow.creator.pipeline", "战纪宇宙生产线"),
    category: stepCategories[index] ?? "AI影视流程",
    href: "/projects",
    image: stepImages[index] ?? media.workflow,
    summary: step.summary,
    process: step.output,
    badge: "查看创作过程",
    tags: ["流程节点", step.title]
  }));
  const apiNodeCard = {
    actionLabel: siteCopyValue(data, "workflow.actions.api", "进入模型网关"),
    id: "new-api-model-node",
    title: siteCopyValue(data, "workflow.api.title", "灵穹 API 模型节点"),
    creator: siteCopyValue(data, "workflow.creator.pipeline", "战纪宇宙生产线"),
    category: "AI影视流程",
    href: "/api",
    image: media.workflow,
    summary: siteCopyValue(data, "workflow.api.description"),
    process: siteCopyValue(data, "workflow.api.process"),
    badge: "模型网关",
    tags: ["灵穹 API", "模型节点", "统一网关"]
  };

  const serviceCards = services.map((service, index) => ({
    actionLabel: siteCopyValue(data, "workflow.actions.service", "咨询此服务"),
    id: `service-${index}`,
    title: service.title,
    creator: siteCopyValue(data, "workflow.creator.service", "灵穹商业制作"),
    category:
      service.title.includes("短剧") || service.title.includes("漫剧")
        ? "短剧漫剧"
        : service.title.includes("文旅") || service.title.includes("展陈")
          ? "文旅展陈"
          : service.title.includes("品牌")
            ? "商业广告"
            : "专业影视",
    href: "/services#contact",
    image: [media.services, media.workflow, media.generations, media.hero, media.spark][
      index % 5
    ],
    summary: service.summary,
    process: service.deliverables.join(" / "),
    badge: service.timeline,
    tags: service.deliverables.slice(0, 3)
  }));

  const workCards = works.slice(0, 4).map((work) => ({
    actionLabel: siteCopyValue(data, "workflow.actions.work", "查看作品详情"),
    id: `work-${work.slug}`,
    title: work.title,
    creator: work.category,
    category:
      work.category === "文旅宣传"
        ? "文旅展陈"
        : work.category === "品牌影像"
          ? "商业广告"
          : work.category === "短剧漫剧"
            ? "短剧漫剧"
            : "专业影视",
    href: `/works/${encodeURIComponent(work.slug)}`,
    image: work.image,
    summary: work.logline,
    process: work.deliverables.join(" / "),
    badge: work.status,
    tags: work.tags.slice(0, 3)
  }));

  return [apiNodeCard, ...workflowCards, ...serviceCards, ...workCards];
}

export function WorkflowStudio({ data }: { data: SiteData }) {
  const { media, pipelineSteps: steps } = data;
  const categories = siteCopyLines(data, "workflow.categories");
  const allCategory = categories[0] || "全部";
  const [activeCategory, setActiveCategory] = useState(allCategory);
  const [query, setQuery] = useState("");
  const cards = buildCards(data);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCards = cards.filter((card) => {
    const categoryMatch =
      activeCategory === allCategory || card.category === activeCategory;
    const text = `${card.title} ${card.creator} ${card.summary} ${card.process} ${card.tags.join(
      " "
    )}`.toLowerCase();
    const queryMatch = !normalizedQuery || text.includes(normalizedQuery);

    return categoryMatch && queryMatch;
  });

  const bannerImages = {
    workflow: media.workflow,
    spark: media.spark,
    services: media.services
  };
  const banners = siteCopyRows(data, "workflow.banners").map(
    ([title, kicker, caption, imageKey]) => ({
      title,
      kicker,
      caption,
      image: bannerImages[imageKey as keyof typeof bannerImages] || media.workflow
    })
  );

  return (
    <section className="min-h-screen bg-[#050505] px-4 pb-20 pt-24 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200/20 bg-amber-200/8 px-3 py-2 text-xs font-semibold text-amber-100">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              {siteCopyValue(data, "workflow.hero.badge", "创作生产线大厅")}
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold text-stone-50 md:text-6xl">
              {siteCopyValue(data, "workflow.hero.title", "AI影视生产线")}
            </h1>
            <p className="mt-4 max-w-3xl text-pretty text-base leading-8 text-stone-300">
              {siteCopyValue(data, "workflow.hero.description")}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-200/35 bg-cyan-200/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18"
              href="/projects"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {siteCopyValue(data, "workflow.hero.primaryLabel", "开始生产")}
            </Link>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              href="/works"
            >
              {siteCopyValue(data, "workflow.hero.secondaryLabel", "查看作品样板")}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative mt-6 overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
          <div className="grid gap-px bg-white/10 lg:grid-cols-3">
            {banners.map((banner, index) => (
              <article
                className={cn(
                  "group relative min-h-[250px] overflow-hidden bg-zinc-950",
                  index === 1 && "lg:scale-[1.035] lg:shadow-2xl"
                )}
                key={banner.title}
              >
                <Image
                  alt={`${banner.title} 概念图`}
                  className="h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-105 group-hover:opacity-85"
                  fill
                  loading="eager"
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  src={banner.image}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/28 to-transparent" />
                <div className="absolute left-5 right-5 top-5 flex items-center justify-between">
                  <span className="rounded-lg border border-white/15 bg-black/40 px-3 py-1 text-xs font-medium text-stone-100 backdrop-blur">
                    {banner.kicker}
                  </span>
                </div>
                <div className="absolute bottom-5 left-5 right-5">
                  <h2 className="text-balance text-2xl font-semibold text-stone-50">
                    {banner.title}
                  </h2>
                  <p className="mt-3 text-sm text-stone-300">{banner.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                aria-pressed={activeCategory === category}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm transition",
                  activeCategory === category
                    ? "border-cyan-200 bg-cyan-200 text-zinc-950"
                    : "border-white/10 bg-white/[0.035] text-stone-300 hover:border-cyan-200/50 hover:text-white"
                )}
                key={category}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
          <label className="relative block w-full lg:w-80">
            <span className="sr-only">
              {siteCopyValue(data, "workflow.searchLabel", "搜索生产流程、服务或作品")}
            </span>
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
            />
            <input
              className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-10 pr-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/60"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={siteCopyValue(data, "workflow.searchPlaceholder", "请输入搜索内容")}
              value={query}
            />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-stone-50">
            {siteCopyValue(data, "workflow.listTitle", "Production Show")}
          </h2>
          <p className="text-sm text-stone-500">
            {filteredCards.length} {siteCopyValue(data, "workflow.cardCountSuffix", "个生产卡片")}
          </p>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCards.map((card) => {
            const step = steps.find((item) => card.title.includes(item.title));
            const Icon = step ? getIcon(step.icon) : Sparkles;

            return (
              <article
                className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] transition hover:border-cyan-200/35 hover:bg-white/[0.055]"
                key={card.id}
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    alt={`${card.title} 生产卡片`}
                    className="h-full w-full object-cover opacity-86 transition duration-700 group-hover:scale-105"
                    fill
                    sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                    src={card.image}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/8 to-transparent" />
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <span className="rounded-lg border border-white/15 bg-black/45 px-3 py-1 text-xs text-stone-100 backdrop-blur">
                      {card.category}
                    </span>
                    <span className="rounded-lg border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-xs text-amber-100 backdrop-blur">
                      {card.badge}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-stone-300">{card.creator}</p>
                      <h3 className="mt-1 text-xl font-semibold text-stone-50">
                        {card.title}
                      </h3>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-200 text-zinc-950">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm leading-7 text-stone-300">{card.summary}</p>
                  <p className="mt-4 line-clamp-2 text-xs leading-6 text-stone-500">
                    {card.process}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {card.tags.map((tag) => (
                      <span
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-stone-300"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 transition hover:text-cyan-50"
                    href={card.href}
                  >
                    <Eye aria-hidden="true" className="h-4 w-4" />
                    {card.actionLabel}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {!filteredCards.length ? (
          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.035] p-8 text-center text-sm text-stone-400">
            {siteCopyValue(data, "workflow.empty", "没有找到匹配的生产卡片。")}
          </div>
        ) : null}
      </div>
    </section>
  );
}
