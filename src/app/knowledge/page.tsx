import type { Metadata } from "next";

import { KnowledgeWorkspace } from "@/components/knowledge/knowledge-workspace";

export const metadata: Metadata = {
  description: "以知识空间、页面树和多维表格沉淀灵穹的项目知识与制作资产。",
  title: "灵穹知识库"
};

export default function KnowledgePage() {
  return <KnowledgeWorkspace />;
}
