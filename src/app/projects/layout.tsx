import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export default async function ProjectsLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const data = await getPlatformSiteData();

  return <><SiteHeader brand={data.brand} navItems={data.navItems} /><div className="min-h-screen bg-[#050506] pt-20 text-stone-100">{children}</div><SiteFooter data={data} /></>;
}
