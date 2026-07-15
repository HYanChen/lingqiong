import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";

import { siteCopyValue, type SiteData } from "@/content/site";

export function CtaBand({ data }: { data: SiteData }) {
  return (
    <section className="border-y border-white/10 bg-[linear-gradient(120deg,rgba(8,47,73,0.42),rgba(24,24,27,0.96),rgba(120,53,15,0.28))]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-14 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
            {siteCopyValue(data, "global.cta.eyebrow", "cooperation")}
          </p>
          <h2 className="mt-4 text-balance text-3xl font-semibold text-stone-50 md:text-5xl">
            {siteCopyValue(
              data,
              "global.cta.title",
              "从一个故事，进入一条可交付的 AI 影视生产线"
            )}
          </h2>
          <p className="mt-5 text-base leading-8 text-stone-300">
            {siteCopyValue(
              data,
              "global.cta.description",
              "可先从概念预告、项目样片或资产库搭建开始，再推进短剧、文旅宣传片、品牌片和 IP 孵化。"
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
            href={siteCopyValue(data, "global.cta.primaryHref", "/services#contact")}
          >
            <MessageSquareText aria-hidden="true" className="h-4 w-4" />
            {siteCopyValue(data, "global.cta.primaryLabel", "商务咨询")}
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
            href={siteCopyValue(data, "global.cta.secondaryHref", "/workflow")}
          >
            {siteCopyValue(data, "global.cta.secondaryLabel", "查看生产线")}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
