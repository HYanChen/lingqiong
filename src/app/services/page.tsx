import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MessageCircle, Phone } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { getIcon } from "@/lib/icon-map";
import { getSiteData } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "服务",
  description: "灵穹承接 AI 影视制作、概念预告、短剧漫剧、文旅宣传和原创 IP 孵化。"
};

export default async function ServicesPage() {
  const { company, media, services } = await getSiteData();

  return (
    <>
      <PageHero
        description="战纪宇宙负责展示原创 IP 与审美能力，灵穹负责把这套 AI 影视方法转化为可承接、可交付、可复用的商业服务。"
        eyebrow="services"
        image={media.services}
        title="AI 影视制作与 IP 孵化服务"
      />

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            description="从小样片开始，也可以从完整 IP 母档或商业项目交付包开始。所有服务都围绕可展示、可发布、可招商三个结果设计。"
            eyebrow="offers"
            title="可从这些服务切入"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => {
              const Icon = getIcon(service.icon);

              return (
                <article
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-6 transition hover:border-cyan-200/45 hover:bg-white/[0.055]"
                  key={service.title}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-cyan-200/10 text-cyan-100">
                      <Icon aria-hidden="true" className="h-6 w-6" />
                    </span>
                    <span className="rounded-lg border border-amber-200/20 px-3 py-1 text-xs text-amber-100">
                      {service.timeline}
                    </span>
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold text-stone-50">
                    {service.title}
                  </h2>
                  <p className="mt-2 text-sm text-cyan-100">{service.audience}</p>
                  <p className="mt-4 text-sm leading-7 text-stone-300">
                    {service.summary}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {service.deliverables.map((item) => (
                      <span
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-stone-300"
                        key={item}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-black/24 px-5 py-24 md:px-8" id="contact">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <SectionHeading
            description="这里先保留真实联系方式占位，正式上线前填入邮箱、电话或微信二维码。建议首版咨询入口承接到一个表单或企业微信。"
            eyebrow="contact"
            title="商务咨询与合作"
          />
          <div className="grid gap-4">
            {[
              ["合作邮箱", company.contact.email, Mail],
              ["电话", company.contact.phone, Phone],
              ["微信", company.contact.wechat, MessageCircle]
            ].map(([label, value, Icon]) => (
              <div
                className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5"
                key={label as string}
              >
                <div className="flex items-center gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-200/10 text-cyan-100">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm text-stone-400">{label as string}</p>
                    <p className="mt-1 text-lg font-semibold text-stone-50">
                      {value as string}
                    </p>
                  </div>
                </div>
                <ArrowRight aria-hidden="true" className="h-5 w-5 text-stone-500" />
              </div>
            ))}
            <Link
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
              href="/works"
            >
              先看作品样板
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
