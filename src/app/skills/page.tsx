import type { Metadata } from "next";

import { SkillWorkbench } from "@/components/skills/skill-workbench";

export const metadata: Metadata = {
  title: "灵穹 Skill 工作台",
  description: "在战纪宇宙主平台内选择、上传并运行 Skill，直接调用灵穹 API。"
};

export default function SkillsPage() {
  return <SkillWorkbench />;
}
