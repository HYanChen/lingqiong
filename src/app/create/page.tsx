import type { Metadata } from "next";

import { ProjectCreator } from "@/components/project/project-creator";

export const metadata: Metadata = {
  title: "创建项目",
  description: "创建战纪宇宙 AI 影视项目并进入画布。"
};

export default function CreatePage() {
  return <ProjectCreator />;
}
