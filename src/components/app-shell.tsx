import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { SiteData } from "@/content/site";

type AppShellProps = {
  children: React.ReactNode;
  data: SiteData;
};

export function AppShell({ children, data }: AppShellProps) {
  return (
    <>
      <SiteHeader brand={data.brand} navItems={data.navItems} />
      <main>{children}</main>
      <SiteFooter data={data} />
    </>
  );
}
