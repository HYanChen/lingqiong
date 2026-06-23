import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  children?: ReactNode;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  children
}: SectionHeadingProps) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto max-w-3xl text-center"
          : "max-w-3xl text-left"
      }
    >
      {eyebrow ? (
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.34em] text-cyan-200">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-balance text-3xl font-semibold text-stone-50 md:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-pretty text-base leading-8 text-stone-300 md:text-lg">
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}
