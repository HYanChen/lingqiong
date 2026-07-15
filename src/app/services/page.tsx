import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail, MessageCircle, Phone } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { siteCopyRows, siteCopyValue } from "@/content/site";
import { getIcon } from "@/lib/icon-map";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPlatformSiteData();
  return {
    title: siteCopyValue(data, "services.seoTitle", "服务"),
    description: siteCopyValue(data, "services.seoDescription")
  };
}

export default async function ServicesPage() {
  const data = await getPlatformSiteData();
  const { company, media, services } = data;
  const servicePath = siteCopyRows(data, "services.route.items");
  const contactItems = [
    {
      href:
        company.contact.email && !company.contact.email.includes("待填")
          ? `mailto:${company.contact.email}?subject=${encodeURIComponent("AI 影视项目合作咨询")}`
          : null,
      icon: Mail,
      label: siteCopyValue(data, "services.contact.emailLabel", "合作邮箱"),
      value: company.contact.email
    },
    {
      href:
        company.contact.phone && !company.contact.phone.includes("待填")
          ? `tel:${company.contact.phone.replace(/[^\d+]/g, "")}`
          : null,
      icon: Phone,
      label: siteCopyValue(data, "services.contact.phoneLabel", "电话"),
      value: company.contact.phone
    },
    {
      href: null,
      icon: MessageCircle,
      label: siteCopyValue(data, "services.contact.wechatLabel", "微信"),
      value:
        company.contact.wechat && !company.contact.wechat.includes("待填")
          ? company.contact.wechat
          : siteCopyValue(data, "services.contact.wechatFallback", "请先通过邮箱或电话联系")
    }
  ];

  return (
    <>
      <PageHero
        description={siteCopyValue(data, "services.hero.description")}
        eyebrow={siteCopyValue(data, "services.hero.eyebrow")}
        image={media.services}
        title={siteCopyValue(data, "services.hero.title")}
        video={media.heroVideo}
      />

      <section className="px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            description={siteCopyValue(data, "services.offers.description")}
            eyebrow={siteCopyValue(data, "services.offers.eyebrow")}
            title={siteCopyValue(data, "services.offers.title")}
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

      <section className="border-y border-white/10 bg-[#07090a] px-5 py-20 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <SectionHeading
              description={siteCopyValue(data, "services.route.description")}
              eyebrow={siteCopyValue(data, "services.route.eyebrow")}
              title={siteCopyValue(data, "services.route.title")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {servicePath.map(([title, body], index) => (
                <article
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-6"
                  key={title}
                >
                  <div className="flex items-center justify-between gap-4">
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-6 w-6 text-cyan-100"
                    />
                    <span className="font-mono text-sm text-amber-200">
                      0{index + 1}
                    </span>
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-stone-50">
                    {title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-stone-300">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-black/24 px-5 py-24 md:px-8" id="contact">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <SectionHeading
            description={siteCopyValue(data, "services.contact.description")}
            eyebrow={siteCopyValue(data, "services.contact.eyebrow")}
            title={siteCopyValue(data, "services.contact.title")}
          />
          <div className="grid gap-4">
            {contactItems.map(({ href, icon: Icon, label, value }) => {
              const className =
                "flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5 transition" +
                (href ? " hover:border-cyan-200/45 hover:bg-cyan-200/10" : "");
              const content = (
                <>
                <div className="flex items-center gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-200/10 text-cyan-100">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm text-stone-400">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-stone-50">
                      {value}
                    </p>
                  </div>
                </div>
                {href ? (
                  <ArrowRight aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                ) : null}
                </>
              );

              return href ? (
                <a className={className} href={href} key={label}>
                  {content}
                </a>
              ) : (
                <div className={className} key={label}>
                  {content}
                </div>
              );
            })}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
                href="/works"
              >
                {siteCopyValue(data, "services.contact.primaryLabel", "先看作品样板")}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-cyan-200/60 hover:bg-cyan-200/10"
                href="/projects"
              >
                {siteCopyValue(data, "services.contact.secondaryLabel", "整理项目资料")}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
