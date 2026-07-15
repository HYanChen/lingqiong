import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  UserRound
} from "lucide-react";
import { notFound } from "next/navigation";

import { CtaBand } from "@/components/cta-band";
import { getPlatformSiteData } from "@/lib/platform-api-client";

type TeamDetailPageProps = {
  params: Promise<{ slug: string }>;
};

async function loadMember(slug: string) {
  const data = await getPlatformSiteData();
  const decodedSlug = decodeURIComponent(slug);

  return {
    data,
    member: data.teamMembers.find((item) => item.slug === decodedSlug)
  };
}

export async function generateMetadata({
  params
}: TeamDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data, member } = await loadMember(slug);

  if (!member) {
    return { title: "人物资料未找到" };
  }

  const description =
    member.bio || `${member.name}，${member.role}，${data.company.name}团队成员。`;

  return {
    title: `${member.name} · ${member.role}`,
    description,
    openGraph: {
      description,
      images: [
        {
          alt: `${member.name}人物资料`,
          url: member.avatar || data.media.services
        }
      ],
      title: `${member.name} · ${member.role}`,
      type: "profile"
    }
  };
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const { slug } = await params;
  const { data, member } = await loadMember(slug);

  if (!member) {
    notFound();
  }

  const otherMembers = data.teamMembers
    .filter((item) => item.slug !== member.slug)
    .slice(0, 4);

  return (
    <>
      <article>
        <section className="relative isolate overflow-hidden px-5 pb-20 pt-36 md:px-8">
          <Image
            alt=""
            className="absolute inset-0 -z-30 h-full w-full object-cover opacity-35"
            fill
            priority
            sizes="100vw"
            src={data.media.services}
          />
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(5,5,6,0.98),rgba(5,5,6,0.72),rgba(5,5,6,0.9))]" />
          <div className="cinema-grid absolute inset-0 -z-10 opacity-30" />

          <div className="mx-auto max-w-7xl">
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 transition hover:text-cyan-50"
              href="/about#team"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              返回团队与顾问
            </Link>

            <div className="mt-10 grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
              <div className="relative aspect-[4/5] max-w-md overflow-hidden rounded-lg border border-white/10 bg-cyan-200/10">
                {member.avatar ? (
                  <div
                    aria-label={`${member.name}人物照片`}
                    className="absolute inset-0 bg-cover bg-center"
                    role="img"
                    style={{ backgroundImage: `url(${JSON.stringify(member.avatar)})` }}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-cyan-100/70">
                    <UserRound aria-hidden="true" className="h-24 w-24" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
                <p className="absolute bottom-5 left-5 right-5 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                  {member.group}
                </p>
              </div>

              <div>
                <p className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  team profile
                </p>
                <h1 className="mt-7 text-balance text-6xl font-semibold leading-[0.92] text-stone-50 md:text-8xl">
                  {member.name}
                </h1>
                <p className="mt-6 text-xl font-semibold text-amber-100 md:text-2xl">
                  {member.role}
                </p>
                <p className="mt-7 max-w-3xl whitespace-pre-line text-base leading-8 text-stone-300 md:text-lg">
                  {member.bio || "人物详细资料将在本人确认后公开。"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                expertise
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-stone-50">专业方向</h2>
              {member.expertise.length ? (
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {member.expertise.map((item) => (
                    <div
                      className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/25 p-4 text-sm leading-7 text-stone-300"
                      key={item}
                    >
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-1 h-4 w-4 shrink-0 text-cyan-100"
                      />
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-sm leading-7 text-stone-500">
                  专业方向资料待确认。
                </p>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                highlights
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-stone-50">履历亮点</h2>
              {member.highlights.length ? (
                <ol className="mt-7 grid gap-4">
                  {member.highlights.map((item, index) => (
                    <li
                      className="grid grid-cols-[auto_1fr] gap-4 rounded-lg border border-white/10 bg-black/25 p-4"
                      key={item}
                    >
                      <span className="font-mono text-sm text-amber-200">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm leading-7 text-stone-300">{item}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-6 text-sm leading-7 text-stone-500">
                  履历亮点将在完成核实后更新。
                </p>
              )}
            </div>
          </div>
        </section>

        {otherMembers.length ? (
          <section className="border-y border-white/10 bg-black/24 px-5 py-16 md:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                    more profiles
                  </p>
                  <h2 className="mt-4 text-3xl font-semibold text-stone-50">
                    查看其他团队成员
                  </h2>
                </div>
                <Link
                  className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-cyan-100"
                  href="/about#team"
                >
                  查看完整团队
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {otherMembers.map((item) => (
                  <Link
                    className="rounded-lg border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-200/45 hover:bg-cyan-200/[0.06]"
                    href={`/about/team/${encodeURIComponent(item.slug)}`}
                    key={item.slug}
                  >
                    <p className="text-xs text-cyan-100">{item.role}</p>
                    <h3 className="mt-3 text-xl font-semibold text-stone-50">
                      {item.name}
                    </h3>
                    <p className="mt-3 text-xs text-stone-500">{item.group}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </article>

      <CtaBand data={data} />
    </>
  );
}
