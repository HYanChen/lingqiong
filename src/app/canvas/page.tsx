import type { Metadata } from "next";

import { CanvasWorkspace } from "@/components/project/canvas-workspace";

export const metadata: Metadata = {
  title: "影视画布",
  description: "战纪宇宙 AI 影视项目画布。"
};

export default function CanvasPage() {
  return <CanvasWorkspace />;
}
