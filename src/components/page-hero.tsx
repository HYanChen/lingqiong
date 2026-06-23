import Image from "next/image";
import type { ReactNode } from "react";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  children?: ReactNode;
};

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  children
}: PageHeroProps) {
  return (
    <section className="relative min-h-[70vh] overflow-hidden pt-32">
      <Image
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover"
        fill
        priority
        sizes="100vw"
        src={image}
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(9,9,11,0.94),rgba(9,9,11,0.62),rgba(9,9,11,0.86))]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-zinc-950 to-transparent" />
      <div className="mx-auto flex max-w-7xl flex-col justify-end px-5 pb-16 pt-24 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.36em] text-cyan-200">
          {eyebrow}
        </p>
        <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold leading-[0.95] text-stone-50 md:text-7xl">
          {title}
        </h1>
        <p className="mt-7 max-w-3xl text-pretty text-lg leading-8 text-stone-200 md:text-xl">
          {description}
        </p>
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
