import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PlaySquare } from "lucide-react";

import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { WorkGallery } from "@/components/work-gallery";
import { siteCopyValue } from "@/content/site";
import {
  getPlatformProjectTypeCategories,
  getPlatformSiteData
} from "@/lib/platform-api-client";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPlatformSiteData();
  return {
    title: siteCopyValue(data, "works.seoTitle", "作品"),
    description: siteCopyValue(data, "works.seoDescription")
  };
}

export default async function WorksPage() {
  const [data, categories] = await Promise.all([
    getPlatformSiteData(),
    getPlatformProjectTypeCategories()
  ]);
  const { media, works } = data;
  const featuredWork = works[0];

  return (
    <>
      <PageHero
        description={siteCopyValue(data, "works.hero.description")}
        eyebrow={siteCopyValue(data, "works.hero.eyebrow")}
        image={media.hero}
        title={siteCopyValue(data, "works.hero.title")}
        video={media.heroVideo}
      />
      {featuredWork ? (
        <section className="border-y border-white/10 bg-black/24 px-5 py-20 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-white/10">
              <Image
                alt={`${featuredWork.title} 重点展示图`}
                className="h-full w-full object-cover"
                fill
                sizes="(min-width: 1024px) 56vw, 100vw"
                src={featuredWork.image}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/18 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap gap-2">
                {featuredWork.tags.map((tag) => (
                  <span
                    className="rounded-lg border border-white/15 bg-zinc-950/62 px-3 py-1 text-xs text-stone-100 backdrop-blur"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
                {siteCopyValue(data, "works.featured.eyebrow", "featured")}
              </p>
              <h2 className="mt-5 text-balance text-4xl font-semibold leading-tight text-stone-50 md:text-6xl">
                {featuredWork.title}
              </h2>
              <p className="mt-5 text-sm font-semibold text-amber-100">
                {featuredWork.status} / {featuredWork.format}
              </p>
              <p className="mt-6 text-base leading-8 text-stone-300">
                {featuredWork.logline}
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {featuredWork.deliverables.map((item) => (
                  <div
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-stone-200"
                    key={item}
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
                  href="/universe"
                >
                  <PlaySquare aria-hidden="true" className="h-4 w-4" />
                  {siteCopyValue(data, "works.featured.primaryLabel", "进入世界观")}
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
                  href="/services#contact"
                >
                  {siteCopyValue(data, "works.featured.secondaryLabel", "商务咨询")}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            description={siteCopyValue(data, "works.library.description")}
            eyebrow={siteCopyValue(data, "works.library.eyebrow")}
            title={siteCopyValue(data, "works.library.title")}
          />
          <div className="mt-10">
            <WorkGallery categories={categories} works={works} />
          </div>
        </div>
      </section>
      <CtaBand data={data} />
    </>
  );
}
