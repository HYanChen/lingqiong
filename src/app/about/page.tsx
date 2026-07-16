import type { Metadata } from "next";
import Image from "next/image";

import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { TeamMemberCard } from "@/components/team-member-card";
import { siteCopyLines, siteCopyValue } from "@/content/site";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPlatformSiteData();
  return {
    title: siteCopyValue(data, "about.seoTitle", "关于"),
    description: siteCopyValue(data, "about.seoDescription")
  };
}

export default async function AboutPage() {
  const data = await getPlatformSiteData();
  const { brand, company, media, teamMembers } = data;
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
        description={siteCopyValue(data, "about.hero.description")}
        eyebrow={siteCopyValue(data, "about.hero.eyebrow")}
        image={media.hero}
        title={siteCopyValue(data, "about.hero.title")}
        video={media.heroVideo}
      />

      <section className="scroll-mt-24 px-5 py-24 md:px-8" id="brand">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionHeading
              description={brand.description || siteCopyValue(data, "about.brand.description")}
              eyebrow={siteCopyValue(data, "about.brand.eyebrow")}
              title={siteCopyValue(data, "about.brand.title")}
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                [siteCopyValue(data, "about.brand.brandLabel", "对外品牌"), `${brand.name} / ${brand.english}`],
                [siteCopyValue(data, "about.brand.companyLabel", "公司主体"), company.legalName],
                [siteCopyValue(data, "about.brand.roleLabel", "业务方向"), company.role],
                [siteCopyValue(data, "about.brand.cooperationLabel", "合作入口"), siteCopyValue(data, "about.brand.cooperationValue", "商务咨询页统一承接")]
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

      <section className="scroll-mt-24 px-5 py-16 md:px-8 md:py-20" id="team">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            align="center"
            description={siteCopyValue(data, "about.team.description")}
            eyebrow={siteCopyValue(data, "about.team.eyebrow")}
            title={siteCopyValue(data, "about.team.title")}
          />

          {teamMembers.length ? (
            <div className="mt-10 space-y-4">
              {groupedMembers.map(([group, members], groupIndex) => (
                <section
                  className={
                    groupIndex === 0
                      ? "rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.055] p-4 sm:p-5"
                      : "rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
                  }
                  key={group}
                >
                  <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                        {group}
                      </p>
                      <p className="mt-1 text-xs text-stone-600">
                        {members.length} 位成员
                      </p>
                    </div>
                    <span className="font-mono text-xs text-stone-600">
                      {String(groupIndex + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div
                    className={
                      members.length >= 3
                        ? "mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                        : members.length === 2
                          ? "mt-4 grid gap-3 md:grid-cols-2"
                          : "mt-4 grid gap-3"
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
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-12 rounded-lg border border-dashed border-white/15 bg-white/[0.025] p-10 text-center text-sm leading-7 text-stone-500">
              {siteCopyValue(data, "about.team.empty", "团队资料正在整理中。")}
            </div>
          )}
        </div>
      </section>

      <section className="bg-black/24 px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            align="center"
            description={siteCopyValue(data, "about.principles.description")}
            eyebrow={siteCopyValue(data, "about.principles.eyebrow")}
            title={siteCopyValue(data, "about.principles.title")}
          />
          <div className="mt-12 grid gap-5 md:grid-cols-4">
            {siteCopyLines(data, "about.principles.items").map((item, index) => (
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

      <CtaBand data={data} />
    </>
  );
}
