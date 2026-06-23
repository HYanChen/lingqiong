import type { Metadata } from "next";

import { WorkflowStudio } from "@/components/workflow/workflow-studio";
import { getSiteData } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "AI 影视生产线",
  description: "战纪宇宙和灵穹的 AI 影视生产流程，从创意到交付。"
};

export default async function WorkflowPage() {
  const { media, pipelineSteps, services, works } = await getSiteData();

  return (
    <WorkflowStudio
      media={media}
      services={services}
      steps={pipelineSteps}
      works={works}
    />
  );
}
