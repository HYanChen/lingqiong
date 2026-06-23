"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Search,
  Sparkles
} from "lucide-react";

import type { MediaMap, PipelineStep, Service, Work } from "@/content/site";
import { getIcon } from "@/lib/icon-map";
import { cn } from "@/lib/utils";

type StudioCard = {
  id: string;
  title: string;
  creator: string;
  category: string;
  image: string;
  summary: string;
  process: string;
  badge: string;
  tags: string[];
};

const categories = [
  "全部",
  "AI影视流程",
  "专业影视",
  "短剧漫剧",
  "文旅展陈",
  "商业广告",
  "TV工具箱"
];

function buildCards({
  media,
  services,
  steps,
  works
}: {
  media: MediaMap;
  services: Service[];
  steps: PipelineStep[];
  works: Work[];
}): StudioCard[] {
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
    id: `step-${step.eyebrow}`,
    title: `${step.eyebrow} ${step.title}`,
    creator: "战纪宇宙生产线",
    category: stepCategories[index] ?? "AI影视流程",
    image: stepImages[index] ?? media.workflow,
    summary: step.summary,
    process: step.output,
    badge: "查看创作过程",
    tags: ["流程节点", step.title]
  }));

  const serviceCards = services.map((service, index) => ({
    id: `service-${index}`,
    title: service.title,
    creator: "灵穹商业制作",
    category:
      service.title.includes("短剧") || service.title.includes("漫剧")
        ? "短剧漫剧"
        : service.title.includes("文旅") || service.title.includes("展陈")
          ? "文旅展陈"
          : service.title.includes("品牌")
            ? "商业广告"
            : "专业影视",
    image: [media.services, media.workflow, media.generations, media.hero, media.spark][
      index % 5
    ],
    summary: service.summary,
    process: service.deliverables.join(" / "),
    badge: service.timeline,
    tags: service.deliverables.slice(0, 3)
  }));

  const workCards = works.slice(0, 4).map((work) => ({
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
    image: work.image,
    summary: work.logline,
    process: work.deliverables.join(" / "),
    badge: work.status,
    tags: work.tags.slice(0, 3)
  }));

  return [...workflowCards, ...serviceCards, ...workCards];
}

export function WorkflowStudio({
  media,
  services,
  steps,
  works
}: {
  media: MediaMap;
  services: Service[];
  steps: PipelineStep[];
  works: Work[];
}) {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const cards = useMemo(
    () => buildCards({ media, services, steps, works }),
    [media, services, steps, works]
  );

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return cards.filter((card) => {
      const categoryMatch =
        activeCategory === "全部" || card.category === activeCategory;
      const text = `${card.title} ${card.creator} ${card.summary} ${card.process} ${card.tags.join(
        " "
      )}`.toLowerCase();
      const queryMatch = !normalizedQuery || text.includes(normalizedQuery);

      return categoryMatch && queryMatch;
    });
  }, [activeCategory, cards, query]);

  const banners = [
    {
      title: "从创意到成片，一条 AI 影视生产线",
      kicker: "Production Studio",
      image: media.workflow,
      caption: "资产库 / 分镜 / 提示词 / 结果回收"
    },
    {
      title: "战纪宇宙001：《火种》概念流程",
      kicker: "The Spark",
      image: media.spark,
      caption: "旧物线索 / 人物关系 / 竖屏短剧"
    },
    {
      title: "商业项目也能按影视流程交付",
      kicker: "Business Delivery",
      image: media.services,
      caption: "文旅 / 品牌片 / 概念预告"
    }
  ];

  return (
    <section className="min-h-screen bg-[#050505] px-4 pb-20 pt-24 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200/20 bg-amber-200/8 px-3 py-2 text-xs font-semibold text-amber-100">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              创作生产线大厅
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold text-stone-50 md:text-6xl">
              AI影视生产线
            </h1>
            <p className="mt-4 max-w-3xl text-pretty text-base leading-8 text-stone-300">
              像浏览作品库一样浏览生产流程。每一张卡片都是一个可复用的制作节点、服务模板或项目样板。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-200/35 bg-cyan-200/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18"
              href="/create"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              开始生产
            </Link>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              href="/admin"
            >
              快速编辑生产线
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
                  priority={index === 1}
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  src={banner.image}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/28 to-transparent" />
                <div className="absolute left-5 right-5 top-5 flex items-center justify-between">
                  <span className="rounded-lg border border-white/15 bg-black/40 px-3 py-1 text-xs font-medium text-stone-100 backdrop-blur">
                    {banner.kicker}
                  </span>
                  <div className="hidden gap-2 text-stone-200 lg:flex">
                    <button
                      aria-label="上一张"
                      className="grid h-8 w-8 place-items-center rounded-lg bg-black/35"
                      type="button"
                    >
                      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="下一张"
                      className="grid h-8 w-8 place-items-center rounded-lg bg-black/35"
                      type="button"
                    >
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
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
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
            />
            <input
              className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-10 pr-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/60"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="请输入搜索内容"
              value={query}
            />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-stone-50">Production Show</h2>
          <p className="text-sm text-stone-500">{filteredCards.length} 个生产卡片</p>
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
                    href="/services#contact"
                  >
                    <Eye aria-hidden="true" className="h-4 w-4" />
                    查看创作过程
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {!filteredCards.length ? (
          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.035] p-8 text-center text-sm text-stone-400">
            没有找到匹配的生产卡片。
          </div>
        ) : null}
      </div>
    </section>
  );
}
