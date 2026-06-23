import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSiteData } from "@/lib/site-data";

import "@xyflow/react/dist/style.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await getSiteData();

  return {
    title: {
      default: `${brand.name} | ${brand.english}`,
      template: `%s | ${brand.name}`
    },
    description: brand.tagline,
    metadataBase: new URL("https://war-chronicle-universe.local"),
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
  const data = await getSiteData();

  return (
    <html data-scroll-behavior="smooth" lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SiteHeader brand={data.brand} navItems={data.navItems} />
        <main>{children}</main>
        <SiteFooter data={data} />
      </body>
    </html>
  );
}
