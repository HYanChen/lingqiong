import type { Metadata } from "next";
import Image from "next/image";

import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { TeamMemberCard } from "@/components/team-member-card";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export const metadata: Metadata = {
  title: "关于",
  description: "战纪宇宙由灵穹打造，面向原创 AI 影视 IP 与商业影像服务。"
};

export default async function AboutPage() {
  const { brand, company, media, teamMembers } = await getPlatformSiteData();
  const groupedMembers = Array.from(
    teamMembers.reduce((groups, member) => {
      const members = groups.get(member.group) ?? [];
      members.push(member);
      groups.set(member.group, members);
      return groups;
    }, new Map<string, typeof teamMembers>())
  );

  return (
    <>
      <PageHero
        description="战纪宇宙是对外 IP 品牌，灵穹是背后的 AI 影视制作与 IP 孵化服务主体。两者分工清晰：一个负责出圈，一个负责交付。"
        eyebrow="about"
        image={media.hero}
        title="由灵穹打造的原创 AI 影视宇宙"
        video={media.heroVideo}
      />

      <section className="scroll-mt-24 px-5 py-24 md:px-8" id="brand">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionHeading
              description={
                brand.description ||
                `${brand.name} 面向观众、平台和合作方展示原创 IP 的长期价值；${company.name} 面向客户提供 AI 影像策划、资产库、分镜、提示词和样片交付。`
              }
              eyebrow="brand and company"
              title="品牌在前，公司在后"
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ["对外品牌", `${brand.name} / ${brand.english}`],
                ["公司主体", company.legalName],
                ["业务方向", company.role],
                ["合作入口", "商务咨询页统一承接"]
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

      <section className="scroll-mt-24 px-5 py-24 md:px-8" id="team">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            align="center"
            description="团队按内容、技术、运营与生产分工协作。公开信息只呈现已经确认的姓名、岗位与履历，避免用未核实资料包装团队。"
            eyebrow="team"
            title="团队与顾问"
          />

          {teamMembers.length ? (
            <div className="mt-12 grid gap-5 lg:grid-cols-2">
              {groupedMembers.map(([group, members], groupIndex) => (
                <div
                  className={
                    groupIndex === 0
                      ? "rounded-lg border border-cyan-200/20 bg-cyan-200/[0.06] p-6 lg:col-span-2"
                      : "rounded-lg border border-white/10 bg-white/[0.035] p-6"
                  }
                  key={group}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                    {group}
                  </p>
                  <div
                    className={
                      groupIndex === 0
                        ? "mt-6 grid gap-4 md:grid-cols-2"
                        : "mt-6 grid gap-4"
                    }
                  >
                    {members.map((member) => (
                      <TeamMemberCard
                        featured={groupIndex === 0}
                        key={member.slug}
                        member={member}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-12 rounded-lg border border-dashed border-white/15 bg-white/[0.025] p-10 text-center text-sm leading-7 text-stone-500">
              团队资料正在整理中。
            </div>
          )}
        </div>
      </section>

      <section className="bg-black/24 px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            align="center"
            description="灵穹把原创内容开发和商业制作服务放在同一条资产化生产线上：作品证明审美，流程保障交付，真实状态建立长期信任。"
            eyebrow="working principles"
            title="我们的工作方式"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-4">
            {[
              "原创 IP 长期开发",
              "制作资产持续沉淀",
              "服务交付可以复用",
              "作品状态真实透明"
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
