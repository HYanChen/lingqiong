"use client";

import { useMemo, useState } from "react";

import type { Work } from "@/content/site";
import { cn } from "@/lib/utils";
import { WorkCard } from "@/components/work-card";

export function WorkGallery({
  categories: configuredCategories = [],
  works
}: {
  categories?: string[];
  works: Work[];
}) {
  const categories = useMemo(
    () => [
      "全部",
      ...Array.from(
        new Set(
          [...configuredCategories, ...works.map((work) => work.category)]
            .map((category) => category.trim())
            .filter(Boolean)
        )
      )
    ],
    [configuredCategories, works]
  );
  const [active, setActive] = useState("全部");
  const selectedCategory = categories.includes(active) ? active : "全部";
  const filtered = useMemo(
    () =>
      selectedCategory === "全部"
        ? works
        : works.filter((work) => work.category === selectedCategory),
    [selectedCategory, works]
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            aria-pressed={selectedCategory === category}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm transition",
              selectedCategory === category
                ? "border-cyan-200 bg-cyan-200 text-zinc-950"
                : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-cyan-200/50 hover:text-white"
            )}
            key={category}
            onClick={() => setActive(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((work) => (
          <WorkCard key={work.slug} work={work} />
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-white/12 bg-white/[0.025] px-6 py-12 text-center">
          <p className="text-base font-semibold text-stone-200">当前分类暂无作品</p>
          <p className="mt-2 text-sm text-stone-500">
            可切换到“全部”，或等待平台运营人员发布该分类作品。
          </p>
        </div>
      ) : null}
    </div>
  );
}
