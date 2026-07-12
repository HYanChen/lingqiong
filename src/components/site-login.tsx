"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BriefcaseBusiness, CircleUserRound, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import type { Brand } from "@/content/site";
import {
  clearFrontUser,
  fetchFrontUser,
  frontAuthChangedEvent,
  readFrontUser,
  type FrontUser
} from "@/lib/front-auth";

export function SiteLogin({ brand }: { brand: Brand }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<FrontUser | null>(null);

  useEffect(() => {
    let active = true;

    function syncLocalUser() {
      if (active) {
        setUser(readFrontUser());
      }
    }

    syncLocalUser();
    window.addEventListener(frontAuthChangedEvent, syncLocalUser);
    void fetchFrontUser().then((nextUser) => {
      if (active) {
        setUser(nextUser);
      }
    });

    return () => {
      active = false;
      window.removeEventListener(frontAuthChangedEvent, syncLocalUser);
    };
  }, []);

  if (pathname.startsWith("/admin")) {
    return null;
  }

  async function logout() {
    await fetch("/_wcu-api/auth/logout", { method: "POST" }).catch(() => null);
    clearFrontUser();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  if (user) {
    return (
      <div className="flex min-w-0 items-center rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-cyan-50">
        <Link
          className="inline-flex h-11 min-w-0 items-center gap-2 px-4 text-sm font-semibold transition hover:bg-cyan-200/10"
          href="/account"
          title={`${user.account} · ${brand.name} 用户中心`}
        >
          <CircleUserRound aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="max-w-32 truncate">{user.account}</span>
        </Link>
        <Link
          aria-label="进入创作者工作台"
          className="grid h-11 w-11 shrink-0 place-items-center border-l border-cyan-200/20 transition hover:bg-cyan-200/12"
          href="/projects"
          title="项目工作台"
        >
          <BriefcaseBusiness aria-hidden="true" className="h-4 w-4" />
        </Link>
        <button
          aria-label={`退出登录：${user.account}`}
          className="grid h-11 w-11 shrink-0 place-items-center border-l border-cyan-200/20 transition hover:bg-cyan-200/12"
          onClick={() => void logout()}
          title="退出登录"
          type="button"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <Link
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18"
      href="/projects"
      title={`${brand.name} 创作者工作台`}
    >
      <BriefcaseBusiness aria-hidden="true" className="h-4 w-4" />
      创作者工作台
    </Link>
  );
}
