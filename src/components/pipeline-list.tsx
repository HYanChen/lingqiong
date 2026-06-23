import type { PipelineStep } from "@/content/site";
import { getIcon } from "@/lib/icon-map";

export function PipelineList({
  compact = false,
  steps
}: {
  compact?: boolean;
  steps: PipelineStep[];
}) {
  const visibleSteps = compact ? steps.slice(0, 6) : steps;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {visibleSteps.map((step) => {
        const Icon = getIcon(step.icon);

        return (
          <article
            className="rounded-lg border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-200/45 hover:bg-white/[0.055]"
            key={step.title}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold tracking-[0.28em] text-amber-200">
                {step.eyebrow}
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-200/10 text-cyan-100">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
            </div>
            <h3 className="mt-5 text-xl font-semibold text-stone-50">
              {step.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-stone-300">{step.summary}</p>
            <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-6 text-stone-400">
              产物：{step.output}
            </p>
          </article>
        );
      })}
    </div>
  );
}
