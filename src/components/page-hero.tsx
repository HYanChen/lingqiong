import Image from "next/image";
import type { ReactNode } from "react";

import { HeroVideo } from "@/components/hero-video";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  video?: string;
  children?: ReactNode;
};

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  video,
  children
}: PageHeroProps) {
  return (
    <section className="relative isolate min-h-[70vh] overflow-hidden pt-32">
      <Image
        alt=""
        className="absolute inset-0 z-0 h-full w-full object-cover"
        fill
        priority
        sizes="100vw"
        src={image}
      />
      {video ? <HeroVideo poster={image} src={video} /> : null}
      <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_22%_74%,rgba(8,145,178,0.18),transparent_32rem),radial-gradient(circle_at_82%_76%,rgba(180,83,9,0.12),transparent_30rem)]" />
      <div className="absolute inset-0 z-[3] bg-[linear-gradient(90deg,rgba(9,9,11,0.78),rgba(9,9,11,0.28),rgba(9,9,11,0.68))]" />
      <div className="cinema-grid absolute inset-0 z-[4] opacity-35" />
      <div className="absolute inset-x-0 bottom-0 z-[5] h-40 bg-gradient-to-t from-zinc-950 to-transparent" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-end px-5 pb-16 pt-24 md:px-8">
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
