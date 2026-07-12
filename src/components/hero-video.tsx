"use client";

import { useEffect, useRef } from "react";

type HeroVideoProps = {
  poster: string;
  src: string;
};

export function HeroVideo({ poster, src }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!video || reduceMotion.matches) {
      video?.pause();
      return;
    }

    function play() {
      if (!video) {
        return;
      }

      void video.play().catch(() => {
        // Some browser states can pause autoplay; the poster image remains as the fallback.
      });
    }

    play();
    window.addEventListener("focus", play);
    document.addEventListener("visibilitychange", play);

    return () => {
      window.removeEventListener("focus", play);
      document.removeEventListener("visibilitychange", play);
    };
  }, [src]);

  return (
    <video
      aria-hidden="true"
      className="hero-motion-video absolute inset-0 z-[1] h-full w-full object-cover opacity-[0.76] saturate-[0.95] brightness-[0.72] contrast-110"
      key={src}
      loop
      muted
      playsInline
      poster={poster}
      preload="metadata"
      ref={videoRef}
    >
      <source src={src} />
    </video>
  );
}
