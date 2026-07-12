import Link from "next/link";

import type { SiteData } from "@/content/site";

type FooterSection = {
  title: string;
  links: Array<{
    direct?: boolean;
    href: string;
    label: string;
  }>;
};

export function SiteFooter({ data }: { data: SiteData }) {
  const { brand, company, navItems } = data;
  const sections: FooterSection[] = [
    {
      title: "探索",
      links: navItems
    },
    {
      title: "创作平台",
      links: [
        { href: "/projects", label: "我的项目" },
        { href: "/workflow", label: "生产管理" },
        { href: "/skills", label: "Skill 工作台" },
        { href: "/api", label: "灵穹 API" },
        { href: "/knowledge", label: "灵穹知识库" }
      ]
    },
    {
      title: "影视服务",
      links: [
        { href: "/services", label: "AI 概念预告片" },
        { href: "/services", label: "短剧漫剧生产包" },
        { href: "/services", label: "文旅宣传影像" },
        { href: "/services#contact", label: "商务咨询" }
      ]
    },
    {
      title: "作品与世界观",
      links: [
        { href: "/works", label: "概念作品库" },
        { href: "/universe", label: "五代叙事" },
        { href: "/workflow", label: "AI 影视生产线" },
        { href: "/about", label: "关于灵穹" }
      ]
    },
    {
      title: "合作与公司",
      links: [
        { href: "/about", label: "关于灵穹" },
        { href: "/services#contact", label: "商务咨询" },
        { href: "/about", label: company.legalName },
        { href: "/about", label: company.role }
      ]
    }
  ];

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#050506] text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.12),transparent_28rem),radial-gradient(circle_at_86%_24%,rgba(180,83,9,0.10),transparent_30rem),linear-gradient(180deg,rgba(9,9,11,0.86),#050506_58%)]" />
      <div className="cinema-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative mx-auto max-w-7xl px-5 py-10 md:px-8">
        <div className="grid gap-8 border-b border-white/10 pb-8 lg:grid-cols-[0.95fr_1.45fr]">
          <div>
            <p className="text-xl font-semibold text-stone-50">{brand.name}</p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/80">
              {brand.english}
            </p>
            <p className="mt-5 max-w-md text-sm leading-7 text-stone-400">
              原创 AI 影视宇宙与灵穹制作平台的统一入口，用于展示作品、承接项目并沉淀制作资产。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["概念展示", "页面中的概念图、样板和流程说明用于官网展示与招商沟通。"],
              ["状态保守", "《火种》及相关作品以页面标注状态为准，不伪造上线数据。"],
              ["统一平台", "项目、生产管理、灵穹 API 与知识库通过统一登录进入。"]
            ].map(([title, body]) => (
              <div
                className="rounded-lg border border-white/10 bg-white/[0.035] p-4"
                key={title}
              >
                <p className="text-sm font-semibold text-stone-100">{title}</p>
                <p className="mt-3 text-xs leading-6 text-stone-500">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-x-10 gap-y-8 border-b border-white/10 py-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-semibold text-stone-200">{section.title}</h2>
              <div className="mt-3 grid gap-2">
                {section.links.map((link) => (
                  link.direct ? (
                    <a
                      className="text-xs leading-5 text-stone-500 transition hover:text-cyan-100"
                      href={link.href}
                      key={`${section.title}-${link.label}`}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      className="text-xs leading-5 text-stone-500 transition hover:text-cyan-100"
                      href={link.href}
                      key={`${section.title}-${link.label}`}
                    >
                      {link.label}
                    </Link>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-5 text-xs leading-6 text-stone-500 md:flex-row md:items-center md:justify-between">
          <p>Copyright © 2026 {brand.name}. 保留所有权利。</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <span>公司主体：{company.legalName}</span>
            <span>{company.role}</span>
            <Link className="transition hover:text-cyan-100" href="/about">
              关于
            </Link>
            <Link className="transition hover:text-cyan-100" href="/services#contact">
              联系
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
