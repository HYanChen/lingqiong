import { AppShellBoundary } from "@/components/app-shell-boundary";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteCopyValue, type SiteData } from "@/content/site";

type AppShellProps = {
  children: React.ReactNode;
  data: SiteData;
};

export function AppShell({ children, data }: AppShellProps) {
  return (
    <AppShellBoundary
      footer={<SiteFooter data={data} />}
      header={
        <SiteHeader
          brand={data.brand}
          navItems={data.navItems}
          worksLabel={siteCopyValue(data, "global.header.worksLabel", "查看作品")}
        />
      }
    >
      {children}
    </AppShellBoundary>
  );
}
