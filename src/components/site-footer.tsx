import Link from "next/link";

import type { SiteData } from "@/content/site";

export function SiteFooter({ data }: { data: SiteData }) {
  const { brand, company, navItems } = data;

  return (
    <footer className="border-t border-white/10 bg-zinc-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div>
          <p className="text-2xl font-semibold text-stone-50">{brand.name}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.28em] text-stone-500">
            {brand.english}
          </p>
          <p className="mt-5 max-w-xl text-sm leading-7 text-stone-400">
            {brand.description}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-100">导航</p>
          <div className="mt-4 grid gap-3">
            {navItems.map((item) => (
              <Link
                className="text-sm text-stone-400 transition hover:text-cyan-100"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-100">公司主体</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-stone-400">
            <p>{company.legalName}</p>
            <p>{company.role}</p>
            <p>合作邮箱：{company.contact.email}</p>
            <p>备案信息：待填</p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-stone-500">
        概念图为 AI 生成占位资产，正式上线前可替换为真实样片与项目案例。© 2026 {brand.name}
      </div>
    </footer>
  );
}
