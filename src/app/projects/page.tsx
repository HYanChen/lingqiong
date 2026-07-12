import type { Metadata } from "next";

import { ProjectCreator } from "@/components/project/project-creator";

export const metadata: Metadata = {
  description: "管理灵穹漫剧项目、复刻示例并进入生产工作台。",
  title: "我的项目"
};

export default function ProjectsPage() {
  return <ProjectCreator />;
}
