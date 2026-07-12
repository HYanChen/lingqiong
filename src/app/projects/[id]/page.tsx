import type { Metadata } from "next";

import { ProjectProductionStudio } from "@/components/project/project-production-studio";

export const metadata: Metadata = {
  description: "灵穹 AI 影视项目生产工作台。",
  title: "项目生产工作台"
};

export default async function ProjectProductionPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ProjectProductionStudio projectId={id} />;
}
