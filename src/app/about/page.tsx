import type { Metadata } from "next";
import Image from "next/image";

import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { getSiteData } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "关于",
  description: "战纪宇宙由灵穹打造，面向原创 AI 影视 IP 与商业影像服务。"
};

export default async function AboutPage() {
  const { brand, company, media } = await getSiteData();

  return (
    <>
      <PageHero
        description="战纪宇宙是对外 IP 品牌，灵穹是背后的 AI 影视制作与 IP 孵化服务主体。两者分工清晰：一个负责出圈，一个负责交付。"
        eyebrow="about"
        image={media.hero}
        title="由灵穹打造的原创 AI 影视宇宙"
      />

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionHeading
              description={`${brand.name} 面向观众、平台和合作方展示原创 IP 的长期价值；${company.name} 面向客户提供 AI 影像策划、资产库、分镜、提示词和样片交付。`}
              eyebrow="brand and company"
              title="品牌在前，公司在后"
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ["对外品牌", `${brand.name} / ${brand.english}`],
                ["公司主体", company.legalName],
                ["业务方向", company.role],
                ["上线信息", "联系方式与备案信息待填"]
              ].map(([label, value]) => (
                <div
                  className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
                  key={label}
                >
                  <p className="text-sm text-stone-400">{label}</p>
                  <p className="mt-3 text-lg font-semibold text-stone-50">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-white/10">
            <Image
              alt="灵穹 AI 影视制作场景概念图"
              className="h-full w-full object-cover"
              fill
              sizes="(min-width: 1024px) 52vw, 100vw"
              src={media.services}
            />
          </div>
        </div>
      </section>

      <section className="bg-black/24 px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            align="center"
            description="首版官网先解决可信度、审美、能力说明和商务转化。后续可以继续接入真实作品页、客户案例、媒体报道、表单系统和后台内容管理。"
            eyebrow="roadmap"
            title="官网首版的工作重点"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-4">
            {[
              "品牌识别清楚",
              "作品状态保守",
              "服务边界明确",
              "后续可继续扩展"
            ].map((item, index) => (
              <div
                className="rounded-lg border border-white/10 bg-white/[0.035] p-6"
                key={item}
              >
                <p className="font-mono text-sm text-amber-200">0{index + 1}</p>
                <p className="mt-4 text-xl font-semibold text-stone-50">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
