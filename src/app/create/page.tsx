import type { Metadata } from "next";

import { ProjectCreatePage } from "@/components/project/project-create-page";

export const metadata: Metadata = {
  description: "创建灵穹 AI 影视项目，设置项目类型、素材、制作目标、视觉风格与交付产物。",
  title: "创建项目"
};

export default function CreatePage() {
  return <ProjectCreatePage />;
}
