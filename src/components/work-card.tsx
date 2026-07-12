import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { Work } from "@/content/site";

export function WorkCard({ work }: { work: Work }) {
  return (
    <article className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] transition hover:border-cyan-200/40 focus-within:border-cyan-200/60">
      <Link
        aria-label={`查看作品：${work.title}`}
        className="block h-full"
        href={`/works/${encodeURIComponent(work.slug)}`}
      >
        <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          alt={`${work.title} 概念图`}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          src={work.image}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/84 via-zinc-950/14 to-transparent" />
        <div className="absolute left-4 top-4 rounded-lg border border-white/15 bg-zinc-950/72 px-3 py-1 text-xs text-stone-100 backdrop-blur">
          {work.status}
        </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                {work.category}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-stone-50">
                {work.title}
              </h3>
            </div>
            <ArrowUpRight
              aria-hidden="true"
              className="mt-1 h-5 w-5 shrink-0 text-stone-400 transition group-hover:text-cyan-100"
            />
          </div>
          <p className="mt-4 text-sm leading-7 text-stone-300">{work.logline}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {work.tags.map((tag) => (
              <span
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-stone-300"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}
