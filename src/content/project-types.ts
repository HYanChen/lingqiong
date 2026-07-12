export type ProjectType = {
  active: boolean;
  category: string;
  createdAt: string;
  description: string;
  id: string;
  label: string;
  slug: string;
  sortOrder: number;
  updatedAt: string;
};

export type ProjectTypeSeed = Omit<ProjectType, "createdAt" | "updatedAt">;

export const defaultProjectTypes: ProjectTypeSeed[] = [
  {
    active: true,
    category: "战纪宇宙",
    description: "原创 AI 影视宇宙主线项目。",
    id: "project-type-war-chronicle",
    label: "战纪宇宙",
    slug: "war-chronicle",
    sortOrder: 10
  },
  {
    active: true,
    category: "短剧漫剧",
    description: "短剧、漫剧和连续内容生产项目。",
    id: "project-type-short-series",
    label: "短剧漫剧",
    slug: "short-series",
    sortOrder: 20
  },
  {
    active: true,
    category: "概念预告",
    description: "概念预告片、样片和招商视觉项目。",
    id: "project-type-trailer",
    label: "概念预告",
    slug: "concept-trailer",
    sortOrder: 30
  },
  {
    active: true,
    category: "文旅宣传",
    description: "文旅、展陈和城市叙事影像项目。",
    id: "project-type-culture-tourism",
    label: "文旅宣传",
    slug: "culture-tourism",
    sortOrder: 40
  },
  {
    active: true,
    category: "品牌影像",
    description: "企业品牌片、商业广告和精神叙事项目。",
    id: "project-type-brand-film",
    label: "品牌影像",
    slug: "brand-film",
    sortOrder: 50
  }
];
