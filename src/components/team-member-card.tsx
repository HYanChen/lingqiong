import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";

import type { TeamMember } from "@/content/site";
import { cn } from "@/lib/utils";

export function TeamMemberCard({
  featured = false,
  member
}: {
  featured?: boolean;
  member: TeamMember;
}) {
  return (
    <Link
      aria-label={`查看${member.name}的详细资料`}
      className="group block rounded-lg border border-white/10 bg-black/25 p-5 transition hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-200/[0.06] focus-visible:border-cyan-200/70"
      href={`/about/team/${encodeURIComponent(member.slug)}`}
    >
      <div className="flex items-start gap-4">
        {member.avatar ? (
          <div
            aria-label={`${member.name}人物照片`}
            className="h-20 w-16 shrink-0 rounded-lg border border-white/10 bg-cover bg-center"
            role="img"
            style={{ backgroundImage: `url(${JSON.stringify(member.avatar)})` }}
          />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
            <UserRound aria-hidden="true" className="h-7 w-7" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm text-cyan-100">{member.role}</span>
              <span
                className={cn(
                  "mt-2 block font-semibold text-stone-50",
                  featured ? "text-3xl" : "text-2xl"
                )}
              >
                {member.name}
              </span>
            </span>
            <ArrowUpRight
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-stone-500 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-cyan-100"
            />
          </span>
          <span className="mt-3 block text-xs text-stone-500">{member.group}</span>
        </span>
      </div>

      {member.bio ? (
        <p className="mt-5 line-clamp-3 text-sm leading-7 text-stone-400">
          {member.bio}
        </p>
      ) : (
        <p className="mt-5 text-sm leading-7 text-stone-500">
          点击查看人物资料页
        </p>
      )}

      {member.expertise.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {member.expertise.slice(0, 3).map((item) => (
            <span
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-stone-300"
              key={item}
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
