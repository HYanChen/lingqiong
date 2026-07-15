import type { Metadata } from "next";
import Image from "next/image";

import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { siteCopyRows, siteCopyValue } from "@/content/site";
import { getIcon } from "@/lib/icon-map";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPlatformSiteData();
  return {
    title: siteCopyValue(data, "universe.seoTitle", "世界观"),
    description: siteCopyValue(data, "universe.seoDescription")
  };
}

export default async function UniversePage() {
  const data = await getPlatformSiteData();
  const { media, universeChapters } = data;
  const sparkFacts = siteCopyRows(data, "universe.spark.facts");
  const assetItems = siteCopyRows(data, "universe.assets.items");

  return (
    <>
      <PageHero
        description={siteCopyValue(data, "universe.hero.description")}
        eyebrow={siteCopyValue(data, "universe.hero.eyebrow")}
        image={media.generations}
        title={siteCopyValue(data, "universe.hero.title")}
        video={media.heroVideo}
      />

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            description={siteCopyValue(data, "universe.timeline.description")}
            eyebrow={siteCopyValue(data, "universe.timeline.eyebrow")}
            title={siteCopyValue(data, "universe.timeline.title")}
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
              description={siteCopyValue(data, "universe.spark.description")}
              eyebrow={siteCopyValue(data, "universe.spark.eyebrow")}
              title={siteCopyValue(data, "universe.spark.title")}
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {sparkFacts.map(([title, body]) => (
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
            description={siteCopyValue(data, "universe.assets.description")}
            eyebrow={siteCopyValue(data, "universe.assets.eyebrow")}
            title={siteCopyValue(data, "universe.assets.title")}
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {assetItems.map(([title, body], index) => (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.035] p-6"
                key={title}
              >
                <p className="font-mono text-sm text-amber-200">0{index + 1}</p>
                <h2 className="mt-4 text-2xl font-semibold text-stone-50">
                  {title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-stone-300">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CtaBand data={data} />
    </>
  );
}
