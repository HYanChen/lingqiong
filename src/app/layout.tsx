import type { Metadata } from "next";
import { headers } from "next/headers";

import { AppShell } from "@/components/app-shell";
import { getPlatformSiteData } from "@/lib/platform-api-client";

import "./globals.css";

export const dynamic = "force-dynamic";

async function requestPathname() {
  const headerStore = await headers();
  return headerStore.get("x-wcu-pathname") ?? "";
}

function isSeparatedRoute(pathname: string) {
  return (
    pathname.startsWith("/account") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/create") ||
    pathname.startsWith("/knowledge") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/wechat-login")
  );
}

export async function generateMetadata(): Promise<Metadata> {
  if (isSeparatedRoute(await requestPathname())) {
    return {
      title: "战纪宇宙"
    };
  }

  const { brand } = await getPlatformSiteData();

  return {
    title: {
      default: `${brand.name} | ${brand.english}`,
      template: `%s | ${brand.name}`
    },
    description: brand.tagline,
    metadataBase: new URL(
      process.env.WCU_PUBLIC_BASE_URL || "https://pla.wiki"
    ),
    openGraph: {
      title: brand.name,
      description: brand.tagline,
      images: [
        {
          url: "/media/hero-war-chronicle.png",
          width: 1792,
          height: 1024,
          alt: "战纪宇宙概念视觉"
        }
      ],
      locale: "zh_CN",
      type: "website"
    }
  };
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const data = await getPlatformSiteData();

  return (
    <html data-scroll-behavior="smooth" lang="zh-CN">
      <body className="antialiased">
        <AppShell data={data}>{children}</AppShell>
      </body>
    </html>
  );
}
