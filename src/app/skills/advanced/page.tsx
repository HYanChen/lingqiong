import type { Metadata } from "next";

import { SkillWorkbench } from "@/components/skills/skill-workbench";

export const metadata: Metadata = {
  title: "Skill 高级工作区",
  description: "管理 Skill 会话、工作区文件、运行参数与自定义 Skill。"
};

export default function AdvancedSkillsPage() {
  return <SkillWorkbench />;
}
