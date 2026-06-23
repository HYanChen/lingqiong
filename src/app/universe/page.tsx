import type { Metadata } from "next";
import Image from "next/image";

import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { getIcon } from "@/lib/icon-map";
import { getSiteData } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "世界观",
  description: "战纪宇宙的五代叙事、第一部《火种》和长期更新结构。"
};

export default async function UniversePage() {
  const { media, universeChapters } = await getSiteData();

  return (
    <>
      <PageHero
        description="战纪宇宙以家族记忆、时代选择和新一代成长为主线，从《火种》开始，逐步扩展成可持续更新的原创 AI 影视宇宙。"
        eyebrow="universe"
        image={media.generations}
        title="五代叙事，一条可长期更新的影像宇宙"
      />

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            description="五代叙事不是简单年代划分，而是为了让每一部作品都有清晰的精神位置、人物压力和商业开发方向。"
            eyebrow="timeline"
            title="从火种到未来"
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-5">
            {universeChapters.map((chapter) => {
              const Icon = getIcon(chapter.icon);

              return (
                <article
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-5"
                  key={chapter.title}
                >
                  <div className="flex items-center justify-between gap-4">
                    <Icon aria-hidden="true" className="h-6 w-6 text-cyan-100" />
                    <span className="text-xs text-stone-500">{chapter.period}</span>
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-stone-50">
                    {chapter.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-stone-300">
                    {chapter.summary}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-black/24 px-5 py-24 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <SectionHeading
              description="《火种》以旧物作为叙事入口，用祖辈记忆和后代成长连接过去与当下。项目当前处于开发中和概念样片阶段，适合作为官网首个代表项目展示。"
              eyebrow="first project"
              title="战纪宇宙001：《火种》"
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ["叙事锚点", "军功章、战地日记、后代入伍选择"],
                ["内容形态", "竖屏短剧、概念预告、宣发切片"],
                ["当前状态", "开发中 / 概念样片阶段"],
                ["核心产物", "世界观、人物关系、资产库、分镜提示词"]
              ].map(([title, body]) => (
                <div
                  className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
                  key={title}
                >
                  <p className="text-sm font-semibold text-cyan-100">{title}</p>
                  <p className="mt-3 text-sm leading-7 text-stone-300">{body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-white/10">
            <Image
              alt="火种概念图"
              className="h-full w-full object-cover"
              fill
              sizes="(min-width: 1024px) 52vw, 100vw"
              src={media.spark}
            />
          </div>
        </div>
      </section>

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            align="center"
            description="战纪宇宙的长期开发会把人物、时代、物件、场景和声音持续沉淀为资产，而不是每次从空白重新开始。"
            eyebrow="asset logic"
            title="让世界观成为可复用资产"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {["人物谱系", "时代场景", "核心物件"].map((title, index) => (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.035] p-6"
                key={title}
              >
                <p className="font-mono text-sm text-amber-200">0{index + 1}</p>
                <h2 className="mt-4 text-2xl font-semibold text-stone-50">
                  {title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-stone-300">
                  {index === 0
                    ? "建立祖辈、父辈、当代青年和未来支线人物关系，保证系列更新时人物动机清晰。"
                    : index === 1
                      ? "把村庄、城市、展馆、训练场和虚拟影棚等场景沉淀成统一视觉语言。"
                      : "用日记、奖章、照片、旧箱子和投影设备等物件承担叙事记忆。"}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
