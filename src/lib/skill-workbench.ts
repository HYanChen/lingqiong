import { randomUUID } from "node:crypto";

import {
  getFirstRow,
  getRows,
  readDatabase,
  writeDatabase,
  type Database
} from "@/lib/database";
import {
  listModelApiConfigs,
  logModelApiCall,
  ModelApiUsageLimitError,
  releaseModelApiUsage,
  reserveModelApiUsage,
  type ModelApiConfig
} from "@/lib/model-apis";
import {
  beginModelBillingAudit,
  completeModelBillingAudit,
  LingqiongAccountError,
  requireLingqiongModelAccess
} from "@/lib/lingqiong-account";
import {
  sessionHasAdminPermission,
  type PlatformSessionUser
} from "@/lib/platform-auth";

export type SkillModuleStatus = "可继续生产" | "待补材料" | "初稿";
export type SkillSource = "内置" | "平台" | "用户上传";
export type SkillVisibility = "public" | "private";

export type SkillModule = {
  accent: "green" | "amber" | "blue" | "violet" | "slate";
  description: string;
  id: string;
  materials: string[];
  nextStep: string;
  order: string;
  outputs: string[];
  prompt: string;
  reference: string;
  shortTitle: string;
  status: SkillModuleStatus;
  title: string;
};

export type SkillPackageEntry = {
  content: string;
  id: string;
  path: string;
  type: "folder" | "file";
  updatedAt: string;
};

export type SkillTool = {
  active: boolean;
  category: string;
  createdAt: string;
  description: string;
  displayName: string;
  id: string;
  modules: SkillModule[];
  owner: string;
  packageFiles: SkillPackageEntry[];
  source: SkillSource;
  triggerName: string;
  updatedAt: string;
  visibility: SkillVisibility;
};

export type SkillRun = {
  createdAt: string;
  durationMs: number;
  error: string | null;
  id: string;
  inputText: string;
  model: string | null;
  moduleTitle: string;
  outputText: string | null;
  projectName: string | null;
  skillId: string | null;
  skillName: string;
  status: "success" | "error";
};

export type UpsertSkillInput = {
  active?: boolean;
  category?: string;
  description?: string;
  displayName?: string;
  id?: string;
  materials?: string[];
  modules?: SkillModule[];
  nextStep?: string;
  outputs?: string[];
  owner?: string;
  packageFiles?: SkillPackageEntry[];
  prompt?: string;
  reference?: string;
  source?: SkillSource;
  taskTitle?: string;
  triggerName?: string;
  visibility?: SkillVisibility;
};

export class SkillAccessError extends Error {
  constructor(message = "Skill 不存在或无权访问。") {
    super(message);
    this.name = "SkillAccessError";
  }
}

type SkillToolRow = {
  active: number;
  category: string;
  created_at: string;
  description: string;
  display_name: string;
  id: string;
  modules_json: string;
  owner: string;
  package_json: string | null;
  source: string;
  trigger_name: string;
  updated_at: string;
  visibility: string;
};

type SkillRunRow = {
  created_at: string;
  duration_ms: number;
  error: string | null;
  id: string;
  input_text: string;
  model: string | null;
  module_title: string;
  output_text: string | null;
  project_name: string | null;
  skill_id: string | null;
  skill_name: string;
  status: string;
};

type RunSkillInput = {
  generatedPrompt?: string;
  moduleId?: string;
  project?: {
    duration?: string;
    focus?: string;
    frame?: string;
    platform?: string;
    projectName?: string;
    sourcePath?: string;
  };
  runOptions?: {
    executionDepth?: string;
    outputFormat?: string;
  };
  skillId?: string;
  userInput?: string;
};

const builtInModules: SkillModule[] = [
  {
    accent: "green",
    description: "从题材、人物关系、平台节奏到故事大纲，建立可生产的项目档案。",
    id: "creation",
    materials: ["题材或一句话灵感", "目标平台", "作品类型", "目标受众", "对标作品或禁区"],
    nextStep: "进入完整剧本写作，或先做剧本会诊。",
    order: "01",
    outputs: ["项目档案", "平台节奏档案", "故事大纲", "人物关系雏形"],
    prompt:
      "帮我从 0 到 1 开发一个竖屏短剧项目，先建立项目档案、平台节奏档案、故事大纲和人物小传。信息不足处请用【暂定】推进并标注待补。",
    reference: "references/01-script-creation.md",
    shortTitle: "从0到1",
    status: "可继续生产",
    title: "项目开发"
  },
  {
    accent: "amber",
    description: "诊断结构、节奏、爽点、人物弧光和可修范围，只会诊不擅自重写。",
    id: "doctor",
    materials: ["当前剧本正文或文件路径", "希望保留的结构", "最担心的问题", "目标平台", "是否允许改写"],
    nextStep: "按采纳项进入局部改稿，或进入台词精修。",
    order: "02",
    outputs: ["病灶优先级", "可修范围", "风险清单", "下一步改稿建议"],
    prompt:
      "下面是我的剧本，请先会诊。请只做诊断，不要直接重写；重点判断结构、节奏、人物动机、爽点兑现和可修范围。",
    reference: "references/02-script-doctor.md",
    shortTitle: "诊断已有剧本",
    status: "待补材料",
    title: "剧本会诊"
  },
  {
    accent: "green",
    description: "优化对白节奏、角色语言指纹、潜台词和强情绪停顿，不擅自改剧情。",
    id: "dialogue",
    materials: ["待修台词段落", "角色小传", "场景目标", "保留台词", "希望强化的情绪"],
    nextStep: "将台词回填剧本后，进入资产库或分镜。",
    order: "03",
    outputs: ["逐句诊断", "台词修改稿", "语言指纹说明", "表演停顿建议"],
    prompt:
      "下面这场戏只做台词诊断和精修，不改剧情、不改场次。请拉开角色语言差异，补足潜台词和停顿。",
    reference: "references/03-dialogue-expert.md",
    shortTitle: "对白更像人说话",
    status: "可继续生产",
    title: "台词精修"
  },
  {
    accent: "blue",
    description: "把定稿剧本转成镜头语言，锁定景别、机位、动作、段末状态和首尾帧。",
    id: "storyboard",
    materials: ["定稿剧本", "@图N 映射", "平台节奏档案", "资产库", "高风险连续段说明"],
    nextStep: "进入 Seedance/豆包/火山方舟提示词适配。",
    order: "04",
    outputs: ["10秒大分镜", "5小分镜结构", "21:9 故事版", "首帧与连续性建议"],
    prompt:
      "根据定稿剧本、@图N 映射和平台节奏档案，转成 AI 视频分镜；默认每个大分镜 10 秒、5 个小分镜，并输出 21:9、6x6 故事版连续性结构。",
    reference: "references/04-ai-video-storyboard.md",
    shortTitle: "镜头转译",
    status: "初稿",
    title: "AI 视频分镜"
  },
  {
    accent: "green",
    description: "建立角色、场景、道具、服装、风格资产库，并输出 @图N 映射。",
    id: "asset",
    materials: ["定稿或接近定稿剧本", "角色表", "场景表", "参考图", "需要映射的 @图N 规则"],
    nextStep: "用资产库进入 AI 视频分镜。",
    order: "05",
    outputs: ["资产总表", "asset_index.json", "@图N 映射", "连续性资产交接包"],
    prompt:
      "根据定稿剧本建立 AI 视频项目资产库，并建立 @图N 映射。请输出角色、场景、道具、服装、风格参考、连续性风险和分镜前检查。",
    reference: "references/05-asset-library.md",
    shortTitle: "角色场景道具",
    status: "可继续生产",
    title: "资产库"
  },
  {
    accent: "amber",
    description: "把分镜和素材映射转成可投喂 Seedance / 豆包 / 火山方舟的字段化提示词。",
    id: "seedance",
    materials: ["分镜", "@图N 映射", "画幅", "每段时长", "是否启用导演执行型增强"],
    nextStep: "生成测试后做漂移回查，或粗剪后进入声音设计。",
    order: "06",
    outputs: ["字段化提示词包", "Must Keep", "Avoid", "段末状态", "参数建议"],
    prompt:
      "把这段分镜转成 Seedance 提示词包，按 9:16、每段 4-15 秒输出。默认使用标准字段化纯净版，保留 Must Keep、Avoid 和段末状态。",
    reference: "references/06-seedance2-adapter.md",
    shortTitle: "视频生成投喂",
    status: "待补材料",
    title: "Seedance 提示词"
  },
  {
    accent: "blue",
    description: "为粗剪或发布前版本设计 BGM、音效、静默点、Cue Sheet 和版权检查。",
    id: "sound",
    materials: ["粗剪视频或分镜时间轴", "情绪曲线", "对白密度", "平台与版权要求", "参考音乐"],
    nextStep: "进入剪辑混音、授权检查和发布前声音体检。",
    order: "07",
    outputs: ["BGM 情绪曲线", "音效清单", "Cue Sheet", "音乐搜索词", "AI 音乐提示词"],
    prompt:
      "基于当前视频/分镜时间轴做后期声音设计。请输出 BGM 情绪曲线、音效点、静默点、Cue Sheet、音乐搜索词和版权风险提醒。",
    reference: "references/07-post-music-sound-design.md",
    shortTitle: "BGM/音效/Cue",
    status: "初稿",
    title: "后期声音"
  }
];

const defaultSkill: SkillTool = {
  active: true,
  category: "中文剧本与 AI 视频",
  createdAt: "2026-06-26",
  description: "端到端中文剧本、短剧开发、资产库、分镜、Seedance 提示词和声音设计。",
  displayName: "剧本创作工作室",
  id: "script-writing-studio",
  modules: builtInModules,
  owner: "内置 Skill",
  packageFiles: [
    {
      content: "# 剧本创作工作室\n\n用于中文剧本、AI 视频资产库、分镜与声音生产。",
      id: "built-in-skill-md",
      path: "SKILL.md",
      type: "file",
      updatedAt: "2026-06-26"
    }
  ],
  source: "内置",
  triggerName: "script-writing-studio",
  updatedAt: "2026-07-01",
  visibility: "public"
};

const productionCommandModules: SkillModule[] = [
  {
    accent: "green",
    description: "把一个项目从想法、素材、剧本、资产、分镜到视频生成拆成可执行排期。",
    id: "command-map",
    materials: ["项目类型", "已有材料", "目标平台", "交付时间", "当前卡点"],
    nextStep: "按排期进入剧本、资产或分镜专科模块。",
    order: "01",
    outputs: ["生产路线图", "材料缺口", "优先级", "今日可执行任务"],
    prompt:
      "你是战纪宇宙 AI 影视制片总控。请把用户项目拆成从故事、剧本、资产、分镜、提示词、视频生成、交付检查的生产路线图，并明确今天应该先做哪一步。",
    reference: "workflow/production-command.md",
    shortTitle: "总控拆解",
    status: "可继续生产",
    title: "生产总控"
  },
  {
    accent: "blue",
    description: "为已有项目做生产体检，判断最早缺失环节，避免跳步导致下游返工。",
    id: "command-diagnosis",
    materials: ["项目简介", "当前文件", "希望产出", "已完成节点", "失败记录"],
    nextStep: "补齐最早缺口，再进入对应专科 Skill。",
    order: "02",
    outputs: ["生产体检", "返工风险", "缺口排序", "下一步调用语"],
    prompt:
      "请诊断当前 AI 影视项目为什么不能继续生产。先找最早缺失环节，再给出修复顺序、需要材料和可直接复制给下一个 Skill 的调用语。",
    reference: "workflow/production-diagnosis.md",
    shortTitle: "缺口体检",
    status: "可继续生产",
    title: "生产体检"
  },
  {
    accent: "amber",
    description: "把服务项目整理成商务可读的交付范围、里程碑和验收口径。",
    id: "command-delivery",
    materials: ["客户需求", "预算或周期", "交付物范围", "风格要求", "验收标准"],
    nextStep: "进入服务报价、样片生产或合同资料准备。",
    order: "03",
    outputs: ["交付范围", "里程碑", "验收标准", "风险条款"],
    prompt:
      "请把这个商业 AI 影视项目整理成可对客户沟通的交付方案，包含范围、阶段、验收口径、客户需提供材料和风险边界。",
    reference: "workflow/business-delivery.md",
    shortTitle: "商务交付",
    status: "初稿",
    title: "交付方案"
  }
];

const assetFactoryModules: SkillModule[] = [
  {
    accent: "green",
    description: "抽取角色、场景、道具、服装、风格锁和负面词，形成可复用资产库。",
    id: "asset-index",
    materials: ["剧本或大纲", "角色设定", "参考图", "画幅", "风格方向"],
    nextStep: "把资产库交给分镜导演台或项目生产工作台。",
    order: "01",
    outputs: ["资产总表", "角色/场景/道具编号", "@图N 映射", "连续性风险"],
    prompt:
      "请根据材料建立 AI 影视资产库。输出角色、场景、道具、服装、风格锁、色彩光影、负面词和 @图N 映射，状态保持保守，不要把待生成资产写成已定稿。",
    reference: "references/05-asset-library.md",
    shortTitle: "资产总表",
    status: "可继续生产",
    title: "资产库抽取"
  },
  {
    accent: "violet",
    description: "为主角、反派、核心配角生成统一外观设定与多视图提示词。",
    id: "asset-character",
    materials: ["人物小传", "年龄气质", "时代背景", "服装要求", "禁忌"],
    nextStep: "进入角色图生成或分镜资产绑定。",
    order: "02",
    outputs: ["角色设定卡", "四视图提示词", "表情/动作参考", "一致性锁定"],
    prompt:
      "请为核心人物建立角色资产卡，包含外观、服装、表情、动作、人物语言/表演指纹、四视图提示词和一致性负面词。",
    reference: "references/05-style-character.md",
    shortTitle: "角色卡",
    status: "初稿",
    title: "角色资产"
  },
  {
    accent: "blue",
    description: "整理高频场景、空间关系、机位可行性和高穿帮风险。",
    id: "asset-scene",
    materials: ["场景描述", "人物动线", "关键道具", "时代/地域", "镜头需求"],
    nextStep: "将场景母版交给 AI 视频分镜。",
    order: "03",
    outputs: ["场景母版", "空间点位", "镜头限制", "穿帮风险"],
    prompt:
      "请把场景整理成 AI 视频可用的场景母版，包含空间结构、入口出口、主体站位、道具点位、光线、可用机位和高穿帮提醒。",
    reference: "references/05-scene-continuity.md",
    shortTitle: "场景母版",
    status: "可继续生产",
    title: "场景资产"
  }
];

const directorBoardModules: SkillModule[] = [
  {
    accent: "blue",
    description: "把定稿剧本拆成每组 10 秒、5 个小分镜的连续性蓝图。",
    id: "board-10s",
    materials: ["定稿剧本", "资产库", "@图N 映射", "平台节奏档案", "画幅"],
    nextStep: "把分镜交给视频提示词或项目生成任务。",
    order: "01",
    outputs: ["10 秒大分镜", "5 小分镜", "段末状态", "下一段衔接"],
    prompt:
      "请把剧本拆成 AI 视频分镜。默认每个大分镜 10 秒、内部 5 个小分镜，先估算台词自然语速，再安排镜头密度、动作、景别、运镜和段末状态。",
    reference: "references/04-ai-video-storyboard.md",
    shortTitle: "10秒分镜",
    status: "可继续生产",
    title: "10 秒分镜"
  },
  {
    accent: "green",
    description: "输出 21:9、6x6 导演故事板结构，服务后续视频连续生成。",
    id: "board-visual",
    materials: ["分镜文本", "角色/场景图", "关键动作", "画幅", "参考风格"],
    nextStep: "进入图片生成、首帧图或视频生成。",
    order: "02",
    outputs: ["6x6 故事板", "首帧建议", "连续性锁", "镜头检查"],
    prompt:
      "请生成 21:9 导演故事板方案。按 6x6 面板描述每格画面，强调镜头连续性、人物站位、动作衔接和首尾帧，不做装饰性概念图。",
    reference: "references/04-ai-video-storyboard.md",
    shortTitle: "故事板",
    status: "初稿",
    title: "导演故事板"
  },
  {
    accent: "amber",
    description: "专门处理打斗、追逐、战场、异能和复杂运镜段落。",
    id: "board-action",
    materials: ["动作段剧本", "人物能力", "空间关系", "动作禁区", "目标节奏"],
    nextStep: "回填主分镜，再转视频提示词。",
    order: "03",
    outputs: ["动作链条", "接触点", "受力结果", "战线变化"],
    prompt:
      "请把动作戏拆成可拍、可生成的视频动作链。必须写清接触点、受力结果、战线变化、镜头功能和节奏档位，避免只写抽象打斗词。",
    reference: "references/04b-camera-action-cheatsheet.md",
    shortTitle: "动作戏",
    status: "待补材料",
    title: "动作分镜"
  }
];

const promptRouterModules: SkillModule[] = [
  {
    accent: "green",
    description: "把分镜转成 Seedance、豆包、火山方舟等视频模型可投喂提示词。",
    id: "prompt-seedance",
    materials: ["分镜", "@图N 映射", "时长", "画幅", "模板偏好"],
    nextStep: "生成测试后回查漂移，必要时回到分镜或资产库。",
    order: "01",
    outputs: ["纯净提示词", "Must Keep", "Avoid", "参数建议"],
    prompt:
      "请把分镜转成视频生成提示词。默认使用导演轨纯净版，继承节奏档位，控制字数，保留素材锚定、镜头轨、声音轨、硬锁和段末状态。",
    reference: "references/06-seedance2-adapter.md",
    shortTitle: "视频提示词",
    status: "可继续生产",
    title: "视频模型提示词"
  },
  {
    accent: "blue",
    description: "把普通需求改写成灵穹 API 模型调用可读的结构化任务。",
    id: "prompt-api",
    materials: ["用户需求", "上下文", "输出格式", "限制条件", "失败样例"],
    nextStep: "直接调用灵穹 API 或保存为平台 Skill。",
    order: "03",
    outputs: ["系统提示词", "用户提示词", "输出 Schema", "错误处理建议"],
    prompt:
      "请把这个需求整理成可直接交给灵穹 API 的结构化提示词，包含系统角色、用户任务、输入变量、输出格式、禁止项和失败兜底。",
    reference: "workflow/lingqiong-api-prompt.md",
    shortTitle: "API Prompt",
    status: "可继续生产",
    title: "灵穹 API 调用提示词"
  }
];

const knowledgeOpsModules: SkillModule[] = [
  {
    accent: "slate",
    description: "把一次项目生产过程整理成知识库页面，可复盘、可复用、可交接。",
    id: "knowledge-page",
    materials: ["项目记录", "生成结果", "失败原因", "最终采用方案", "可复用规则"],
    nextStep: "同步到灵穹知识库或沉淀为新 Skill。",
    order: "01",
    outputs: ["知识库页面大纲", "操作步骤", "注意事项", "可复用模板"],
    prompt:
      "请把这次 AI 影视生产过程整理成灵穹知识库文章，包含背景、输入、步骤、关键决策、失败经验、最终模板和下次复用方式。",
    reference: "knowledge/project-retrospective.md",
    shortTitle: "经验沉淀",
    status: "初稿",
    title: "知识库沉淀"
  },
  {
    accent: "green",
    description: "把重复流程提炼成后台可配置的 Skill 工具。",
    id: "knowledge-to-skill",
    materials: ["复盘文章", "稳定流程", "输入输出", "边界", "示例"],
    nextStep: "在后台保存为平台 Skill。",
    order: "02",
    outputs: ["Skill 名称", "触发名", "模块列表", "默认提示词"],
    prompt:
      "请把这套可复用流程提炼成一个战纪宇宙 Skill 配置，输出 displayName、triggerName、category、description、modules、materials、outputs 和 prompt。",
    reference: "knowledge/skill-extraction.md",
    shortTitle: "沉淀 Skill",
    status: "可继续生产",
    title: "知识转 Skill"
  }
];

const builtInSkills: SkillTool[] = [
  {
    active: true,
    category: "生产总控",
    createdAt: "2026-07-01",
    description: "把 AI 影视项目拆成可执行路线图、缺口体检和商务交付方案。",
    displayName: "战纪制片总控",
    id: "wcu-production-command",
    modules: productionCommandModules,
    owner: "内置 Skill",
    packageFiles: [],
    source: "内置",
    triggerName: "wcu-production-command",
    updatedAt: "2026-07-01",
    visibility: "public"
  },
  defaultSkill,
  {
    active: true,
    category: "资产与视觉",
    createdAt: "2026-07-01",
    description: "建立角色、场景、道具、风格锁和 @图N 映射，给分镜与画布复用。",
    displayName: "AI 影视资产工厂",
    id: "wcu-asset-factory",
    modules: assetFactoryModules,
    owner: "内置 Skill",
    packageFiles: [],
    source: "内置",
    triggerName: "wcu-asset-factory",
    updatedAt: "2026-07-01",
    visibility: "public"
  },
  {
    active: true,
    category: "分镜导演",
    createdAt: "2026-07-01",
    description: "把剧本和资产转成 10 秒分镜、6x6 故事板和动作戏镜头方案。",
    displayName: "分镜导演台",
    id: "wcu-director-board",
    modules: directorBoardModules,
    owner: "内置 Skill",
    packageFiles: [],
    source: "内置",
    triggerName: "wcu-director-board",
    updatedAt: "2026-07-01",
    visibility: "public"
  },
  {
    active: true,
    category: "模型提示词",
    createdAt: "2026-07-01",
    description: "把分镜、画面需求和普通任务转成灵穹 API 与视频模型可执行提示词。",
    displayName: "模型提示词路由器",
    id: "wcu-prompt-router",
    modules: promptRouterModules,
    owner: "内置 Skill",
    packageFiles: [],
    source: "内置",
    triggerName: "wcu-prompt-router",
    updatedAt: "2026-07-01",
    visibility: "public"
  },
  {
    active: true,
    category: "知识沉淀",
    createdAt: "2026-07-01",
    description: "把项目复盘、失败经验和稳定流程整理成灵穹知识库文章或新 Skill。",
    displayName: "知识库运营助手",
    id: "wcu-knowledge-ops",
    modules: knowledgeOpsModules,
    owner: "内置 Skill",
    packageFiles: [],
    source: "内置",
    triggerName: "wcu-knowledge-ops",
    updatedAt: "2026-07-01",
    visibility: "public"
  }
];

export type SkillModelStatus = {
  baseUrl: string | null;
  configured: boolean;
  hasToken: boolean;
  message: string;
  model: string | null;
  name: string | null;
};

let seedPromise: Promise<void> | null = null;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeSource(value?: string): SkillSource {
  return value === "用户上传" || value === "平台" || value === "内置" ? value : "平台";
}

function normalizeVisibility(value?: string): SkillVisibility {
  return value === "private" ? "private" : "public";
}

function normalizeTriggerName(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return normalized || fallback;
}

function normalizeLines(values?: string[]) {
  return (values ?? []).map((item) => item.trim()).filter(Boolean);
}

function mapSkill(row: SkillToolRow): SkillTool {
  return {
    active: Boolean(row.active),
    category: row.category,
    createdAt: row.created_at,
    description: row.description,
    displayName: row.display_name,
    id: row.id,
    modules: parseJson<SkillModule[]>(row.modules_json, []),
    owner: row.owner,
    packageFiles: parseJson<SkillPackageEntry[]>(row.package_json, []),
    source: normalizeSource(row.source),
    triggerName: row.trigger_name,
    updatedAt: row.updated_at,
    visibility: normalizeVisibility(row.visibility)
  };
}

function mapRun(row: SkillRunRow): SkillRun {
  return {
    createdAt: row.created_at,
    durationMs: Number(row.duration_ms),
    error: row.error,
    id: row.id,
    inputText: row.input_text,
    model: row.model,
    moduleTitle: row.module_title,
    outputText: row.output_text,
    projectName: row.project_name,
    skillId: row.skill_id,
    skillName: row.skill_name,
    status: row.status === "error" ? "error" : "success"
  };
}

function defaultModuleFromInput(input: UpsertSkillInput, id: string): SkillModule {
  const title = input.taskTitle?.trim() || input.displayName?.trim() || "启动任务";

  return {
    accent: input.source === "用户上传" ? "slate" : "violet",
    description: input.description?.trim() || "按当前 Skill 规则执行任务。",
    id: `${id}-default`,
    materials: normalizeLines(input.materials),
    nextStep: input.nextStep?.trim() || "继续按该 Skill 的交付物进入下一步生产。",
    order: "自定义",
    outputs: normalizeLines(input.outputs),
    prompt: input.prompt?.trim() || "请按这个 Skill 的规则直接执行，并输出可交付结果。",
    reference: input.reference?.trim() || "SKILL.md",
    shortTitle: input.source === "用户上传" ? "用户上传" : "平台配置",
    status: "可继续生产",
    title
  };
}

async function uniqueTriggerName(db: Database, triggerName: string, currentId: string) {
  const base = normalizeTriggerName(triggerName, `skill-${randomUUID().slice(0, 8)}`);

  for (let index = 0; index < 30; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const row = await getFirstRow<{ id: string }>(
      db,
      "SELECT id FROM skill_tools WHERE trigger_name = ? AND id <> ?",
      [candidate, currentId]
    );

    if (!row) {
      return candidate;
    }
  }

  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function insertSkill(db: Database, skill: SkillTool) {
  await db.execute(
    `INSERT INTO skill_tools (
      id, display_name, trigger_name, category, owner, description, source,
      visibility, active, modules_json, package_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       trigger_name = VALUES(trigger_name),
       category = VALUES(category),
       owner = VALUES(owner),
       description = VALUES(description),
       source = VALUES(source),
       visibility = VALUES(visibility),
       active = VALUES(active),
       modules_json = VALUES(modules_json),
       package_json = VALUES(package_json),
       updated_at = VALUES(updated_at)`,
    [
      skill.id,
      skill.displayName,
      skill.triggerName,
      skill.category,
      skill.owner,
      skill.description,
      skill.source,
      skill.visibility,
      skill.active ? 1 : 0,
      JSON.stringify(skill.modules),
      JSON.stringify(skill.packageFiles),
      skill.createdAt,
      skill.updatedAt
    ]
  );
}

export async function ensureSkillWorkbenchSeeded() {
  seedPromise ??= writeDatabase(async (db) => {
    for (const skill of builtInSkills) {
      const existing = await getFirstRow<{ source: string; updated_at: string }>(
        db,
        "SELECT source, updated_at FROM skill_tools WHERE id = ?",
        [skill.id]
      );

      if (
        !existing ||
        (normalizeSource(existing.source) === "内置" && existing.updated_at < skill.updatedAt)
      ) {
        await insertSkill(db, skill);
      }
    }
  });

  return seedPromise;
}

export async function getSkillModelStatus(): Promise<SkillModelStatus> {
  const configs = await listModelApiConfigs();
  const config = configs.find((item) => item.enabled && item.provider === "new-api") ?? null;

  if (!config) {
    return {
      baseUrl: null,
      configured: false,
      hasToken: false,
      message: "未启用灵穹 API 网关配置",
      model: null,
      name: null
    };
  }

  return {
    baseUrl: modelBaseUrl(config),
    configured: true,
    hasToken: true,
    message: "已连接灵穹 API；模型调用按当前用户账户结算",
    model: config.model,
    name: config.name
  };
}

export async function listSkillTools(options: { activeOnly?: boolean } = {}) {
  await ensureSkillWorkbenchSeeded();

  return readDatabase(async (db) => {
    const where = options.activeOnly ? "WHERE active = 1" : "";
    const rows = await getRows<SkillToolRow>(
      db,
      `SELECT id, display_name, trigger_name, category, owner, description,
        source, visibility, active, modules_json, package_json, created_at, updated_at
       FROM skill_tools
       ${where}
       ORDER BY active DESC, updated_at DESC`
    );

    return rows.map(mapSkill);
  });
}

export function canAccessSkillTool(skill: SkillTool, session: PlatformSessionUser) {
  return (
    sessionHasAdminPermission(session, "skills.read") ||
    skill.visibility === "public" ||
    skill.owner === session.account
  );
}

export async function listSkillToolsForSession(
  session: PlatformSessionUser,
  options: { activeOnly?: boolean } = {}
) {
  if (sessionHasAdminPermission(session, "skills.read")) {
    return listSkillTools(options);
  }

  await ensureSkillWorkbenchSeeded();

  return readDatabase(async (db) => {
    const activeWhere = options.activeOnly ? "active = 1 AND " : "";
    const rows = await getRows<SkillToolRow>(
      db,
      `SELECT id, display_name, trigger_name, category, owner, description,
        source, visibility, active, modules_json, package_json, created_at, updated_at
       FROM skill_tools
       WHERE ${activeWhere}(visibility = 'public' OR owner = ?)
       ORDER BY active DESC, updated_at DESC`,
      [session.account]
    );

    return rows.map(mapSkill);
  });
}

export async function getSkillTool(id: string) {
  await ensureSkillWorkbenchSeeded();

  return readDatabase(async (db) => {
    const row = await getFirstRow<SkillToolRow>(
      db,
      `SELECT id, display_name, trigger_name, category, owner, description,
        source, visibility, active, modules_json, package_json, created_at, updated_at
       FROM skill_tools
       WHERE id = ?`,
      [id]
    );

    return row ? mapSkill(row) : null;
  });
}

export async function getSkillToolForSession(id: string, session: PlatformSessionUser) {
  const skill = await getSkillTool(id);
  return skill && canAccessSkillTool(skill, session) ? skill : null;
}

async function upsertSkillToolInternal(
  input: UpsertSkillInput,
  ownerSession?: PlatformSessionUser
) {
  const now = new Date().toISOString();

  return writeDatabase(async (db) => {
    const requestedId = input.id?.trim();
    const existing = requestedId
      ? await getFirstRow<SkillToolRow>(
          db,
          `SELECT id, display_name, trigger_name, category, owner, description,
            source, visibility, active, modules_json, package_json, created_at, updated_at
           FROM skill_tools
           WHERE id = ?${ownerSession ? " FOR UPDATE" : ""}`,
          [requestedId]
        )
      : null;
    const current = existing ? mapSkill(existing) : null;

    if (
      ownerSession &&
      current &&
      (current.source !== "用户上传" || current.owner !== ownerSession.account)
    ) {
      throw new SkillAccessError("不能覆盖内置 Skill 或其他用户的 Skill。");
    }

    const id = ownerSession
      ? current?.id ?? randomUUID()
      : requestedId?.startsWith("draft-") || !requestedId
        ? randomUUID()
        : requestedId;
    const effectiveInput: UpsertSkillInput = ownerSession
      ? {
          ...input,
          active: true,
          id,
          owner: ownerSession.account,
          source: "用户上传"
        }
      : input;
    const displayName =
      effectiveInput.displayName?.trim() || current?.displayName || "新 Skill";
    const triggerName = await uniqueTriggerName(
      db,
      effectiveInput.triggerName || current?.triggerName || displayName,
      id
    );
    const modules =
      effectiveInput.modules && effectiveInput.modules.length > 0
        ? effectiveInput.modules
        : current?.modules.length
          ? current.modules
          : [defaultModuleFromInput(effectiveInput, id)];
    const skill: SkillTool = {
      active: effectiveInput.active ?? current?.active ?? true,
      category: effectiveInput.category?.trim() || current?.category || "通用 Skill",
      createdAt: current?.createdAt || now,
      description:
        effectiveInput.description?.trim() ||
        current?.description ||
        "用于战纪宇宙生产线的 Skill 工具。",
      displayName,
      id,
      modules,
      owner:
        effectiveInput.owner?.trim() ||
        current?.owner ||
        (effectiveInput.source === "用户上传" ? "本机用户" : "平台团队"),
      packageFiles: effectiveInput.packageFiles ?? current?.packageFiles ?? [],
      source: effectiveInput.source ?? current?.source ?? "平台",
      triggerName,
      updatedAt: now,
      visibility: effectiveInput.visibility ?? current?.visibility ?? "public"
    };

    await insertSkill(db, skill);

    return skill;
  });
}

export async function upsertSkillTool(input: UpsertSkillInput) {
  return upsertSkillToolInternal(input);
}

export async function upsertUserSkillTool(
  input: UpsertSkillInput,
  session: PlatformSessionUser
) {
  return upsertSkillToolInternal(input, session);
}

export async function deleteSkillTool(id: string) {
  await ensureSkillWorkbenchSeeded();

  return writeDatabase(async (db) => {
    const result = await db.execute("DELETE FROM skill_tools WHERE id = ?", [id]);
    return Number(result.affectedRows) > 0;
  });
}

export async function listSkillRuns(limit = 50) {
  await ensureSkillWorkbenchSeeded();

  return readDatabase(async (db) => {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rows = await getRows<SkillRunRow>(
      db,
      `SELECT id, skill_id, skill_name, module_title, project_name, input_text,
        output_text, status, error, model, duration_ms, created_at
       FROM skill_runs
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`
    );

    return rows.map(mapRun);
  });
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function modelBaseUrl(config: ModelApiConfig) {
  const internalBaseUrl =
    config.provider === "new-api" ? process.env.NEW_API_INTERNAL_BASE_URL?.trim() : "";

  return trimTrailingSlash(internalBaseUrl || config.baseUrl);
}

function completionEndpoint(config: ModelApiConfig) {
  const baseUrl = modelBaseUrl(config);

  if (baseUrl.endsWith("/chat/completions")) {
    return baseUrl;
  }

  if (config.provider === "new-api" && !baseUrl.endsWith("/v1")) {
    return `${baseUrl}/v1/chat/completions`;
  }

  return `${baseUrl}/chat/completions`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contentToText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (isRecord(item) && typeof item.text === "string") {
          return item.text;
        }

        if (isRecord(item) && typeof item.content === "string") {
          return item.content;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractModelText(result: unknown) {
  if (!isRecord(result)) {
    return "";
  }

  const choices = Array.isArray(result.choices) ? result.choices : [];
  const firstChoice = choices[0];

  if (isRecord(firstChoice)) {
    const message = firstChoice.message;

    if (isRecord(message)) {
      const content = contentToText(message.content);

      if (content) {
        return content;
      }
    }

    const choiceText = contentToText(firstChoice.text);

    if (choiceText) {
      return choiceText;
    }
  }

  return contentToText(result.output_text);
}

function buildSkillInput(skill: SkillTool, skillModule: SkillModule, input: RunSkillInput) {
  const project = input.project ?? {};
  const runOptions = input.runOptions ?? {};

  return [
    "请直接运行以下 Skill 任务。",
    "",
    "【项目参数】",
    `项目名：${project.projectName || "未命名项目"}`,
    `平台：${project.platform || "通用"}`,
    `画幅：${project.frame || "不限"}`,
    `目标时长：${project.duration || "未填写"} 分钟`,
    `源文件路径：${project.sourcePath || "未填写"}`,
    `特别约束：${project.focus || "无"}`,
    "",
    "【Skill】",
    `名称：${skill.displayName}`,
    `触发名：${skill.triggerName}`,
    `分类：${skill.category}`,
    `说明：${skill.description}`,
    "",
    "【任务模块】",
    `模块：${skillModule.order} ${skillModule.title}`,
    `参考：${skillModule.reference || "无"}`,
    `模块要求：${skillModule.prompt}`,
    "",
    "【所需材料】",
    skillModule.materials.map((item) => `- ${item}`).join("\n") || "无",
    "",
    "【运行设置】",
    `执行深度：${runOptions.executionDepth || "完整执行"}`,
    `输出格式：${runOptions.outputFormat || "结构化正文"}`,
    "",
    "【用户补充输入】",
    input.userInput || "无",
    "",
    "【启动语】",
    input.generatedPrompt || skillModule.prompt,
    "",
    "请输出可以直接交付给用户的结果。不要解释你是模型；如果材料不足，请先给出可执行的最小结果，再列出缺口。"
  ].join("\n");
}

async function saveSkillRun(input: {
  durationMs: number;
  error?: string;
  inputText: string;
  model?: string;
  moduleTitle: string;
  outputText?: string;
  projectName?: string;
  skillId?: string;
  skillName: string;
  status: "success" | "error";
}) {
  const run: SkillRun = {
    createdAt: new Date().toISOString(),
    durationMs: input.durationMs,
    error: input.error ?? null,
    id: randomUUID(),
    inputText: input.inputText,
    model: input.model ?? null,
    moduleTitle: input.moduleTitle,
    outputText: input.outputText ?? null,
    projectName: input.projectName ?? null,
    skillId: input.skillId ?? null,
    skillName: input.skillName,
    status: input.status
  };

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO skill_runs (
        id, skill_id, skill_name, module_title, project_name, input_text,
        output_text, status, error, model, duration_ms, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.id,
        run.skillId,
        run.skillName,
        run.moduleTitle,
        run.projectName,
        run.inputText,
        run.outputText,
        run.status,
        run.error,
        run.model,
        run.durationMs,
        run.createdAt
      ]
    );
  });

  return run;
}

function normalizeSkillApiError(message: string) {
  if (/Authentication Fails|api key.*invalid|invalid/i.test(message)) {
    return "灵穹 API 用户凭证无效，请重新进入用户中心连接账户。";
  }

  if (/quota|insufficient_quota|exceeded/i.test(message)) {
    return "灵穹 API 账户余额不足，请充值后再运行。";
  }

  if (/No available channel|available channel/i.test(message)) {
    return "灵穹 API 没有匹配当前模型的可用渠道。请在 API 网关为当前模型开启渠道。";
  }

  return message;
}

export async function runSkill(input: RunSkillInput, session: PlatformSessionUser) {
  if (!input.skillId) {
    throw new Error("请选择要运行的 Skill。");
  }

  const skill = await getSkillToolForSession(input.skillId, session);

  if (!skill || !skill.active) {
    throw new SkillAccessError("Skill 不存在、已停用或无权访问。");
  }

  const skillModule = skill.modules.find((item) => item.id === input.moduleId) ?? skill.modules[0];

  if (!skillModule) {
    throw new Error("当前 Skill 没有可运行的任务模块。");
  }

  const configs = await listModelApiConfigs();
  const config = configs.find((item) => item.enabled && item.provider === "new-api") ?? null;
  const prompt = buildSkillInput(skill, skillModule, input);
  const startedAt = Date.now();

  if (!config) {
    const error = "Skill 工作台只允许直接调用灵穹 API，请联系平台运营人员完成 API 网关配置。";
    await saveSkillRun({
      durationMs: Date.now() - startedAt,
      error,
      inputText: prompt,
      moduleTitle: skillModule.title,
      projectName: input.project?.projectName,
      skillId: skill.id,
      skillName: skill.displayName,
      status: "error"
    });
    throw new Error(error);
  }

  const access = await requireLingqiongModelAccess(session);
  const actor = {
    account: session.account,
    id: session.id,
    role: session.adminRole ?? session.role
  };
  const billingAudit = await beginModelBillingAudit({
    access,
    capability: "skills.run",
    model: config.model
  });
  let reservation;

  try {
    reservation = await reserveModelApiUsage(config.id, actor);
  } catch (error) {
    await completeModelBillingAudit(billingAudit.id, {
      errorCode:
        error instanceof ModelApiUsageLimitError
          ? error.code
          : "MODEL_USAGE_GUARD_UNAVAILABLE",
      newApiUserId: access.account.id,
      status: "failed"
    }).catch((auditError) => {
      console.error("Failed to complete Skill billing audit", auditError);
    });
    throw error;
  }

  let billingStatus: "failed" | "succeeded" = "failed";
  let billingErrorCode: string | undefined = "SKILL_REQUEST_FAILED";

  try {
    const response = await fetch(completionEndpoint(config), {
      body: JSON.stringify({
        max_tokens: config.maxTokens,
        messages: [
          { content: config.systemPrompt, role: "system" },
          { content: prompt, role: "user" }
        ],
        model: config.model,
        temperature: config.temperature
      }),
      headers: {
        Authorization: `Bearer ${access.apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const rawMessage =
        typeof result?.error?.message === "string"
          ? result.error.message
          : `灵穹 API 请求失败：${response.status}`;
      const message = normalizeSkillApiError(rawMessage);

      await logModelApiCall({
        actor,
        configId: config.id,
        error: message,
        nodeTitle: `Skill: ${skill.displayName}`,
        prompt,
        status: "error"
      });
      await saveSkillRun({
        durationMs: Date.now() - startedAt,
        error: message,
        inputText: prompt,
        model: config.model,
        moduleTitle: skillModule.title,
        projectName: input.project?.projectName,
        skillId: skill.id,
        skillName: skill.displayName,
        status: "error"
      });

      billingErrorCode = "SKILL_UPSTREAM_ERROR";

      if (/quota|insufficient|余额不足|额度不足|exceeded/iu.test(rawMessage)) {
        billingErrorCode = "API_BALANCE_REQUIRED";
        throw new LingqiongAccountError(
          "API_BALANCE_REQUIRED",
          "灵穹 API 账户余额不足，请充值后再运行。",
          402
        );
      }

      throw new Error(message);
    }

    const text = extractModelText(result) || "模型返回为空。";

    billingStatus = "succeeded";
    billingErrorCode = undefined;
    await logModelApiCall({
      actor,
      configId: config.id,
      nodeTitle: `Skill: ${skill.displayName}`,
      prompt,
      responseText: text,
      status: "success"
    });

    return saveSkillRun({
      durationMs: Date.now() - startedAt,
      inputText: prompt,
      model: config.model,
      moduleTitle: skillModule.title,
      outputText: text,
      projectName: input.project?.projectName,
      skillId: skill.id,
      skillName: skill.displayName,
      status: "success"
    });
  } catch (error) {
    if (
      error instanceof LingqiongAccountError ||
      error instanceof ModelApiUsageLimitError
    ) {
      throw error;
    }

    if (error instanceof Error) {
      throw new Error(normalizeSkillApiError(error.message));
    }

    throw new Error("Skill 运行失败。");
  } finally {
    await releaseModelApiUsage(reservation.id).catch((error) => {
      console.error("Failed to release Skill model concurrency lease", error);
    });
    await completeModelBillingAudit(billingAudit.id, {
      errorCode: billingErrorCode,
      newApiUserId: access.account.id,
      status: billingStatus
    }).catch((error) => {
      console.error("Failed to complete Skill billing audit", error);
    });
  }
}
