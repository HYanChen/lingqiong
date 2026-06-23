import {
  BookOpen,
  Boxes,
  Building2,
  Clapperboard,
  Compass,
  Film,
  Flame,
  Layers3,
  PenTool,
  PlaySquare,
  Radio,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WandSparkles,
  type LucideIcon
} from "lucide-react";

import type { IconKey } from "@/content/site";

export const iconMap: Record<IconKey, LucideIcon> = {
  BookOpen,
  Boxes,
  Building2,
  Clapperboard,
  Compass,
  Film,
  Flame,
  Layers3,
  PenTool,
  PlaySquare,
  Radio,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WandSparkles
};

export function getIcon(icon: IconKey): LucideIcon {
  return iconMap[icon] ?? Sparkles;
}
