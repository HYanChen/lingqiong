import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteCopyValue, type SiteData } from "@/content/site";

type AppShellProps = {
  children: React.ReactNode;
  data: SiteData;
};

export function AppShell({ children, data }: AppShellProps) {
  return (
    <>
      <SiteHeader
        brand={data.brand}
        navItems={data.navItems}
        worksLabel={siteCopyValue(data, "global.header.worksLabel", "查看作品")}
      />
      <main>{children}</main>
      <SiteFooter data={data} />
    </>
  );
}
