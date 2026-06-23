import type { Metadata } from "next";

import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { WorkGallery } from "@/components/work-gallery";
import { getSiteData } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "作品",
  description: "战纪宇宙概念作品、AI 影像样板和服务模板。"
};

export default async function WorksPage() {
  const { media, works } = await getSiteData();

  return (
    <>
      <PageHero
        description="作品页当前展示首版概念资产、开发中项目和服务模板。每张图都是可替换占位，用于先建立官网气质和招商表达。"
        eyebrow="works library"
        image={media.hero}
        title="作品展示与概念样板"
      />
      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            description="按战纪宇宙、概念预告、短剧漫剧、文旅宣传和品牌影像组织内容。状态标签会明确区分开发中、概念展示和服务模板。"
            eyebrow="filter"
            title="概念作品库"
          />
          <div className="mt-10">
            <WorkGallery works={works} />
          </div>
        </div>
      </section>
    </>
  );
}
