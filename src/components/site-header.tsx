"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { SiteLogin } from "@/components/site-login";
import type { Brand, NavItem } from "@/content/site";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  brand: Brand;
  navItems: NavItem[];
  worksLabel?: string;
};

export function SiteHeader({ brand, navItems, worksLabel = "查看作品" }: SiteHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-zinc-950/68 backdrop-blur-2xl"
      data-site-shell="header"
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link
          aria-label="战纪宇宙首页"
          className="group flex min-w-0 items-center gap-3"
          href="/"
          onClick={() => setOpen(false)}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-cyan-300/35 bg-cyan-300/10 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.24)]">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-semibold text-stone-50">
              {brand.name}
            </span>
            <span className="block truncate text-[11px] uppercase tracking-[0.24em] text-stone-400">
              {brand.english}
            </span>
          </span>
        </Link>

        <nav aria-label="主导航" className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                className={cn(
                  "rounded-lg px-4 py-2 text-sm text-stone-300 transition hover:bg-white/8 hover:text-white",
                  active && "bg-white/10 text-white"
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
            href="/works"
          >
            {worksLabel}
          </Link>
          <SiteLogin brand={brand} />
        </div>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={open}
          aria-label={open ? "关闭导航" : "打开导航"}
          className="grid h-11 w-11 place-items-center rounded-lg border border-white/15 text-stone-100 lg:hidden"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {open ? (
        <div
          className="border-t border-white/10 bg-zinc-950/95 px-5 py-4 lg:hidden"
          id="mobile-navigation"
        >
          <nav aria-label="移动端主导航" className="grid gap-2">
            {navItems.map((item) => (
              <Link
                className="rounded-lg px-4 py-3 text-base text-stone-100 transition hover:bg-white/10"
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <SiteLogin brand={brand} />
          </nav>
        </div>
      ) : null}
    </header>
  );
}
