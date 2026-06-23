"use client";

import { useMemo, useState } from "react";

import type { Work } from "@/content/site";
import { cn } from "@/lib/utils";
import { WorkCard } from "@/components/work-card";

export function WorkGallery({ works }: { works: Work[] }) {
  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(works.map((work) => work.category)))],
    [works]
  );
  const [active, setActive] = useState("全部");
  const filtered = useMemo(
    () => (active === "全部" ? works : works.filter((work) => work.category === active)),
    [active, works]
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            className={cn(
              "rounded-lg border px-4 py-2 text-sm transition",
              active === category
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
    </div>
  );
}
