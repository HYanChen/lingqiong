import { AccountShell } from "@/components/account/account-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export default async function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const data = await getPlatformSiteData();

  return <><SiteHeader brand={data.brand} navItems={data.navItems} /><div className="pt-20"><AccountShell>{children}</AccountShell></div><SiteFooter data={data} /></>;
}
