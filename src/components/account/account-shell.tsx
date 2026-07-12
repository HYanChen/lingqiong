"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, ReceiptText, UserRound, WalletCards } from "lucide-react";

import { cn } from "@/lib/utils";

const accountLinks = [
  { href: "/account", icon: UserRound, label: "账户概览", native: false },
  { href: "/account/billing", icon: WalletCards, label: "充值与账单", native: false },
  { href: "/usage-logs/common", icon: ReceiptText, label: "使用记录", native: true },
  { href: "/keys", icon: KeyRound, label: "API 凭证", native: true }
] as const;

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_82%_0%,rgba(20,126,128,0.15),transparent_30rem),radial-gradient(circle_at_8%_42%,rgba(8,145,178,0.08),transparent_26rem),#04070b] text-stone-100">
      <div className="mx-auto grid w-full max-w-[1680px] gap-5 px-4 pb-20 pt-5 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:pt-8">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-white/10 bg-[#0b1119]/90 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl">
            <div className="hidden px-3 pb-3 pt-2 lg:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/70">
                Creator Account
              </p>
              <p className="mt-2 text-sm text-stone-400">资料、资源与账单</p>
            </div>
            <nav aria-label="用户中心导航" className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:grid [&::-webkit-scrollbar]:hidden">
              {accountLinks.map((item) => {
                const active =
                  item.href === "/account"
                    ? pathname === "/account"
                    : pathname.startsWith(item.href);
                const className = cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium transition lg:w-full",
                  active
                    ? "bg-cyan-200/12 text-cyan-50 shadow-[inset_0_0_0_1px_rgba(165,243,252,0.14)]"
                    : "text-stone-400 hover:bg-white/6 hover:text-stone-100"
                );
                const content = (
                  <>
                    <item.icon aria-hidden="true" className="h-4 w-4" />
                    {item.label}
                  </>
                );

                return item.native ? (
                  <a className={className} href={item.href} key={item.href}>
                    {content}
                  </a>
                ) : (
                  <Link className={className} href={item.href} key={item.href}>
                    {content}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
