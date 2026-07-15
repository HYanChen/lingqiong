import type { Metadata } from "next";

import { WorkflowStudio } from "@/components/workflow/workflow-studio";
import { siteCopyValue } from "@/content/site";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPlatformSiteData();
  return {
    title: siteCopyValue(data, "workflow.seoTitle", "AI 影视生产线"),
    description: siteCopyValue(data, "workflow.seoDescription")
  };
}

export default async function WorkflowPage() {
  const data = await getPlatformSiteData();

  return <WorkflowStudio data={data} />;
}
