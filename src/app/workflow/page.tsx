import type { Metadata } from "next";

import { WorkflowStudio } from "@/components/workflow/workflow-studio";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export const metadata: Metadata = {
  title: "AI 影视生产线",
  description: "战纪宇宙和灵穹的 AI 影视生产流程，从创意到交付。"
};

export default async function WorkflowPage() {
  const { media, pipelineSteps, services, works } = await getPlatformSiteData();

  return (
    <WorkflowStudio
      media={media}
      services={services}
      steps={pipelineSteps}
      works={works}
    />
  );
}
