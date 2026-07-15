export type IconKey =
  | "BookOpen"
  | "Boxes"
  | "Building2"
  | "Clapperboard"
  | "Compass"
  | "Film"
  | "Flame"
  | "Layers3"
  | "PenTool"
  | "PlaySquare"
  | "Radio"
  | "ScrollText"
  | "ShieldCheck"
  | "Sparkles"
  | "UsersRound"
  | "WandSparkles";

export type Brand = {
  name: string;
  english: string;
  tagline: string;
  description: string;
};

export type Company = {
  name: string;
  legalName: string;
  role: string;
  contact: {
    email: string;
    phone: string;
    wechat: string;
  };
};

export type NavItem = {
  href: string;
  label: string;
};

export type MediaMap = {
  hero: string;
  heroVideo: string;
  spark: string;
  workflow: string;
  generations: string;
  services: string;
};

export type UniverseChapter = {
  title: string;
  period: string;
  summary: string;
  icon: IconKey;
};

export type Work = {
  slug: string;
  title: string;
  category: string;
  status: string;
  format: string;
  logline: string;
  image: string;
  tags: string[];
  deliverables: string[];
};

export type PipelineStep = {
  title: string;
  eyebrow: string;
  summary: string;
  output: string;
  icon: IconKey;
};

export type Service = {
  title: string;
  audience: string;
  summary: string;
  timeline: string;
  deliverables: string[];
  icon: IconKey;
};

export type TeamMember = {
  avatar: string;
  expertise: string[];
  highlights: string[];
  name: string;
  role: string;
  group: string;
  bio: string;
  slug: string;
};

export type SiteCopyEntry = {
  group: string;
  key: string;
  label: string;
  multiline?: boolean;
  value: string;
};

export type SiteData = {
  brand: Brand;
  company: Company;
  navItems: NavItem[];
  media: MediaMap;
  universeChapters: UniverseChapter[];
  works: Work[];
  pipelineSteps: PipelineStep[];
  services: Service[];
  teamMembers: TeamMember[];
  proofPoints: string[];
  siteCopy: SiteCopyEntry[];
};

const defaultMedia: MediaMap = {
  hero: "/media/hero-war-chronicle.png",
  heroVideo: "/media/hero-war-chronicle-loop.mp4",
  spark: "/media/work-spark.png",
  workflow: "/media/workflow-studio.png",
  generations: "/media/universe-generations.png",
  services: "/media/services-studio.png"
};

export const defaultSiteCopy: SiteCopyEntry[] = [
  { group: "全局", key: "global.header.worksLabel", label: "页头作品按钮", value: "查看作品" },
  { group: "全局", key: "global.cta.eyebrow", label: "全局合作条眉题", value: "cooperation" },
  { group: "全局", key: "global.cta.title", label: "全局合作条标题", multiline: true, value: "从一个故事，进入一条可交付的 AI 影视生产线" },
  { group: "全局", key: "global.cta.description", label: "全局合作条说明", multiline: true, value: "可先从概念预告、项目样片或资产库搭建开始，再推进短剧、文旅宣传片、品牌片和 IP 孵化。" },
  { group: "全局", key: "global.cta.primaryLabel", label: "全局合作主按钮", value: "商务咨询" },
  { group: "全局", key: "global.cta.primaryHref", label: "全局合作主按钮链接", value: "/services#contact" },
  { group: "全局", key: "global.cta.secondaryLabel", label: "全局合作次按钮", value: "查看生产线" },
  { group: "全局", key: "global.cta.secondaryHref", label: "全局合作次按钮链接", value: "/workflow" },
  { group: "全局", key: "global.footer.description", label: "页脚品牌说明", multiline: true, value: "原创 AI 影视宇宙与灵穹制作平台的统一入口，用于展示作品、承接项目并沉淀制作资产。" },
  { group: "全局", key: "global.footer.highlight1Title", label: "页脚亮点一标题", value: "概念展示" },
  { group: "全局", key: "global.footer.highlight1Body", label: "页脚亮点一说明", multiline: true, value: "页面中的概念图、样板和流程说明用于官网展示与招商沟通。" },
  { group: "全局", key: "global.footer.highlight2Title", label: "页脚亮点二标题", value: "状态保守" },
  { group: "全局", key: "global.footer.highlight2Body", label: "页脚亮点二说明", multiline: true, value: "《火种》及相关作品以页面标注状态为准，不伪造上线数据。" },
  { group: "全局", key: "global.footer.highlight3Title", label: "页脚亮点三标题", value: "统一平台" },
  { group: "全局", key: "global.footer.highlight3Body", label: "页脚亮点三说明", multiline: true, value: "项目、生产管理、灵穹 API 与知识库通过统一登录进入。" },

  { group: "首页", key: "home.hero.primaryLabel", label: "首屏主按钮", value: "查看概念作品" },
  { group: "首页", key: "home.hero.primaryHref", label: "首屏主按钮链接", value: "/works" },
  { group: "首页", key: "home.hero.secondaryLabel", label: "首屏次按钮", value: "商务咨询" },
  { group: "首页", key: "home.hero.secondaryHref", label: "首屏次按钮链接", value: "/services#contact" },
  { group: "首页", key: "home.gateway.eyebrow", label: "统一入口眉题", value: "unified gateway" },
  { group: "首页", key: "home.gateway.title", label: "统一入口标题", multiline: true, value: "一个官网入口，承接 IP、生产线和模型能力" },
  { group: "首页", key: "home.gateway.description", label: "统一入口说明", multiline: true, value: "访客看到的是战纪宇宙的作品与审美；创作者进入项目、画布和技能工作台；灵穹 API 与知识库在底层支撑模型调用、内容沉淀和交付复用。" },
  { group: "首页", key: "home.gateway.layers", label: "统一入口三层配置", multiline: true, value: "IP 官网层|用战纪宇宙承接对外传播，把世界观、作品状态和服务样板集中展示。|/works|查看作品|MonitorPlay\n创作生产层|把项目、剧集、资产、分镜、配音和合成收进同一个创作者工作台。|/projects|进入项目|Clapperboard\n模型知识层|灵穹 API、知识库和 Skill 工作台为生产线提供模型调用与经验沉淀。|/skills|进入工作台|WandSparkles" },
  { group: "首页", key: "home.modules.eyebrow", label: "平台模块眉题", value: "platform modules" },
  { group: "首页", key: "home.modules.title", label: "平台模块标题", multiline: true, value: "把官网、创作和模型能力收进一个平台" },
  { group: "首页", key: "home.modules.description", label: "平台模块说明", multiline: true, value: "官网不是孤立展示页，而是统一平台的对外入口。用户登录一次后，可以进入项目、生产管理、API、知识库和 Skill 工作台，所有能力围绕同一套影视生产资料流动。" },
  { group: "首页", key: "home.modules.noteTitle", label: "平台模块提示标题", value: "统一入口原则" },
  { group: "首页", key: "home.modules.noteBody", label: "平台模块提示说明", multiline: true, value: "官网面向展示与招商，登录面向创作者协作；各子系统通过统一会话进入。" },
  { group: "首页", key: "home.modules.products", label: "平台产品配置", multiline: true, value: "我的项目|创建、编辑、导出和管理个人 AI 影视项目，项目数据按用户归属保存。|/projects|进入项目|Clapperboard\n生产管理|在项目内完成剧集、素材、分镜、配音和合成的连续生产管理。|/workflow|查看生产线|Boxes\n灵穹 API|统一管理模型渠道、令牌和调用能力，供画布、Skill 和生产线使用。|/api|进入 API|WandSparkles\n灵穹知识库|沉淀世界观、制作规范、提示词经验和项目交付文档。|/knowledge|查看知识库|BookOpen" },
  { group: "首页", key: "home.position.eyebrow", label: "品牌定位眉题", value: "brand position" },
  { group: "首页", key: "home.position.title", label: "品牌定位标题", multiline: true, value: "以一个宇宙，承载一条 AI 影视生产线" },
  { group: "首页", key: "home.position.description", label: "品牌定位说明", multiline: true, value: "战纪宇宙不是单个短片项目，而是一套可持续更新的原创影像宇宙。IP 负责出圈与审美证明，灵穹的 AI 影视制作服务负责把策划、资产、分镜和视频交付变成可复用能力。" },
  { group: "首页", key: "home.entries.eyebrow", label: "访问路径眉题", value: "entry paths" },
  { group: "首页", key: "home.entries.title", label: "访问路径标题", value: "一套官网，三种进入方式" },
  { group: "首页", key: "home.entries.description", label: "访问路径说明", multiline: true, value: "不同访问者看到同一个品牌入口，但进入路径不同：公开页面负责展示，登录后的工作台负责创作，模型与知识库负责支撑生产。" },
  { group: "首页", key: "home.entries.items", label: "访问路径配置", multiline: true, value: "观众与合作方|先看世界观与概念作品，理解战纪宇宙的审美、题材和项目状态。|/works|查看作品\n创作者|登录后进入我的项目，选择类型、画面比例、风格和封面，继续进入生产工作台。|/projects|创建项目\n制作团队|用灵穹 API、Skill 工作台和知识库串联模型调用、流程复用和交付记录。|/skills|进入工作台" },
  { group: "首页", key: "home.spark.kicker", label: "火种图片眉题", value: "first project" },
  { group: "首页", key: "home.spark.imageTitle", label: "火种图片标题", value: "战纪宇宙001：《火种》" },
  { group: "首页", key: "home.spark.eyebrow", label: "火种内容眉题", value: "the spark" },
  { group: "首页", key: "home.spark.title", label: "火种内容标题", multiline: true, value: "先把第一部做成能展示、能发布、能招商的样片包" },
  { group: "首页", key: "home.spark.description", label: "火种内容说明", multiline: true, value: "一枚旧军功章，一本战地日记，一个后代的现实选择。《火种》是战纪宇宙的第一部代表项目，当前定位为开发中和概念样片阶段。" },
  { group: "首页", key: "home.spark.deliverables", label: "火种交付项", multiline: true, value: "IP 圣经 V1\n24 集分集大纲\n前 3 集剧本\n角色与场景资产库" },
  { group: "首页", key: "home.spark.buttonLabel", label: "火种按钮", value: "进入世界观" },
  { group: "首页", key: "home.spark.buttonHref", label: "火种按钮链接", value: "/universe" },
  { group: "首页", key: "home.delivery.eyebrow", label: "交付路径眉题", value: "delivery path" },
  { group: "首页", key: "home.delivery.title", label: "交付路径标题", multiline: true, value: "从一个想法，到一套可展示的交付包" },
  { group: "首页", key: "home.delivery.description", label: "交付路径说明", multiline: true, value: "每一次合作都先落到可验证的资产和样片上，避免只停留在概念口号里。官网展示、项目工作台、模型调用和知识沉淀会围绕同一套项目资料持续更新。" },
  { group: "首页", key: "home.delivery.primaryLabel", label: "交付路径主按钮", value: "开始商务咨询" },
  { group: "首页", key: "home.delivery.primaryHref", label: "交付路径主按钮链接", value: "/services#contact" },
  { group: "首页", key: "home.delivery.secondaryLabel", label: "交付路径次按钮", value: "查看项目工作台" },
  { group: "首页", key: "home.delivery.secondaryHref", label: "交付路径次按钮链接", value: "/projects" },
  { group: "首页", key: "home.delivery.steps", label: "交付路径步骤", multiline: true, value: "01|确定叙事资产|明确故事、受众、风格、画面比例和首批可交付物。\n02|搭建项目母档|沉淀人物、场景、物件、提示词和镜头表，形成可继续更新的资产库。\n03|生成概念样片|通过灵穹 API 与项目任务队列完成首轮图片、视频和修订回收。\n04|组织招商交付|输出作品页、概念预告、宣发切片和商务沟通材料。" },
  { group: "首页", key: "home.workflow.eyebrow", label: "生产线眉题", value: "workflow" },
  { group: "首页", key: "home.workflow.title", label: "生产线标题", value: "AI 影视生产线" },
  { group: "首页", key: "home.workflow.description", label: "生产线说明", multiline: true, value: "从策划、剧本、资产库、分镜到提示词和成片交付，每一步都留下可复用产物。" },
  { group: "首页", key: "home.workflow.buttonLabel", label: "生产线按钮", value: "查看完整流程" },
  { group: "首页", key: "home.works.eyebrow", label: "首页作品眉题", value: "works" },
  { group: "首页", key: "home.works.title", label: "首页作品标题", value: "概念作品与服务样板" },
  { group: "首页", key: "home.works.description", label: "首页作品说明", multiline: true, value: "这里展示当前已经整理的概念资产、开发中作品与服务样板；每个条目都明确标注真实状态。" },
  { group: "首页", key: "home.works.buttonLabel", label: "首页作品按钮", value: "查看灵穹知识库" },

  { group: "世界观", key: "universe.seoTitle", label: "SEO 标题", value: "世界观" },
  { group: "世界观", key: "universe.seoDescription", label: "SEO 描述", multiline: true, value: "战纪宇宙的五代叙事、第一部《火种》和长期更新结构。" },
  { group: "世界观", key: "universe.hero.eyebrow", label: "首屏眉题", value: "universe" },
  { group: "世界观", key: "universe.hero.title", label: "首屏标题", multiline: true, value: "五代叙事，一条可长期更新的影像宇宙" },
  { group: "世界观", key: "universe.hero.description", label: "首屏说明", multiline: true, value: "战纪宇宙以家族记忆、时代选择和新一代成长为主线，从《火种》开始，逐步扩展成可持续更新的原创 AI 影视宇宙。" },
  { group: "世界观", key: "universe.timeline.eyebrow", label: "时间线眉题", value: "timeline" },
  { group: "世界观", key: "universe.timeline.title", label: "时间线标题", value: "从火种到未来" },
  { group: "世界观", key: "universe.timeline.description", label: "时间线说明", multiline: true, value: "五代叙事不是简单年代划分，而是为了让每一部作品都有清晰的精神位置、人物压力和商业开发方向。" },
  { group: "世界观", key: "universe.spark.eyebrow", label: "首个项目眉题", value: "first project" },
  { group: "世界观", key: "universe.spark.title", label: "首个项目标题", value: "战纪宇宙001：《火种》" },
  { group: "世界观", key: "universe.spark.description", label: "首个项目说明", multiline: true, value: "《火种》以旧物作为叙事入口，用祖辈记忆和后代成长连接过去与当下。项目当前处于开发中和概念样片阶段，适合作为官网首个代表项目展示。" },
  { group: "世界观", key: "universe.spark.facts", label: "首个项目信息卡", multiline: true, value: "叙事锚点|军功章、战地日记、后代入伍选择\n内容形态|竖屏短剧、概念预告、宣发切片\n当前状态|开发中 / 概念样片阶段\n核心产物|世界观、人物关系、资产库、分镜提示词" },
  { group: "世界观", key: "universe.assets.eyebrow", label: "资产逻辑眉题", value: "asset logic" },
  { group: "世界观", key: "universe.assets.title", label: "资产逻辑标题", value: "让世界观成为可复用资产" },
  { group: "世界观", key: "universe.assets.description", label: "资产逻辑说明", multiline: true, value: "战纪宇宙的长期开发会把人物、时代、物件、场景和声音持续沉淀为资产，而不是每次从空白重新开始。" },
  { group: "世界观", key: "universe.assets.items", label: "资产逻辑卡片", multiline: true, value: "人物谱系|建立祖辈、父辈、当代青年和未来支线人物关系，保证系列更新时人物动机清晰。\n时代场景|把村庄、城市、展馆、训练场和虚拟影棚等场景沉淀成统一视觉语言。\n核心物件|用日记、奖章、照片、旧箱子和投影设备等物件承担叙事记忆。" },

  { group: "作品", key: "works.seoTitle", label: "SEO 标题", value: "作品" },
  { group: "作品", key: "works.seoDescription", label: "SEO 描述", multiline: true, value: "战纪宇宙概念作品、AI 影像样板和服务模板。" },
  { group: "作品", key: "works.hero.eyebrow", label: "首屏眉题", value: "works library" },
  { group: "作品", key: "works.hero.title", label: "首屏标题", value: "作品展示与概念样板" },
  { group: "作品", key: "works.hero.description", label: "首屏说明", multiline: true, value: "这里汇集战纪宇宙的开发中项目、概念作品与服务样板。每个条目都标注当前状态、内容形态和可交付范围。" },
  { group: "作品", key: "works.featured.eyebrow", label: "重点作品眉题", value: "featured" },
  { group: "作品", key: "works.featured.primaryLabel", label: "重点作品主按钮", value: "进入世界观" },
  { group: "作品", key: "works.featured.secondaryLabel", label: "重点作品次按钮", value: "商务咨询" },
  { group: "作品", key: "works.library.eyebrow", label: "作品库眉题", value: "filter" },
  { group: "作品", key: "works.library.title", label: "作品库标题", value: "概念作品库" },
  { group: "作品", key: "works.library.description", label: "作品库说明", multiline: true, value: "按战纪宇宙、概念预告、短剧漫剧、文旅宣传和品牌影像组织内容。点击作品卡片可查看状态、内容形态和可交付资产。" },

  { group: "服务", key: "services.seoTitle", label: "SEO 标题", value: "服务" },
  { group: "服务", key: "services.seoDescription", label: "SEO 描述", multiline: true, value: "灵穹承接 AI 影视制作、概念预告、短剧漫剧、文旅宣传和原创 IP 孵化。" },
  { group: "服务", key: "services.hero.eyebrow", label: "首屏眉题", value: "services" },
  { group: "服务", key: "services.hero.title", label: "首屏标题", value: "AI 影视制作与 IP 孵化服务" },
  { group: "服务", key: "services.hero.description", label: "首屏说明", multiline: true, value: "战纪宇宙负责展示原创 IP 与审美能力，灵穹负责把这套 AI 影视方法转化为可承接、可交付、可复用的商业服务。" },
  { group: "服务", key: "services.offers.eyebrow", label: "服务列表眉题", value: "offers" },
  { group: "服务", key: "services.offers.title", label: "服务列表标题", value: "可从这些服务切入" },
  { group: "服务", key: "services.offers.description", label: "服务列表说明", multiline: true, value: "从小样片开始，也可以从完整 IP 母档或商业项目交付包开始。所有服务都围绕可展示、可发布、可招商三个结果设计。" },
  { group: "服务", key: "services.route.eyebrow", label: "交付路径眉题", value: "service route" },
  { group: "服务", key: "services.route.title", label: "交付路径标题", multiline: true, value: "一条更适合商业项目的交付路径" },
  { group: "服务", key: "services.route.description", label: "交付路径说明", multiline: true, value: "服务不是单次出图，而是把可复用的制作资产交给项目继续生长。每个阶段都对应可检查的文档、画面或交付物。" },
  { group: "服务", key: "services.route.items", label: "交付路径步骤", multiline: true, value: "需求判断|确认是概念预告、短剧生产包、文旅影像、品牌片还是原创 IP 孵化。\n母档搭建|梳理故事、人物、资产、视觉风格、镜头结构和模型调用方式。\n样片生成|围绕关键镜头完成图片、视频、声音与剪辑节奏的首轮验证。\n交付复用|整理成片、提示词、资产库、修订记录和后续生产建议。" },
  { group: "服务", key: "services.contact.eyebrow", label: "联系区眉题", value: "contact" },
  { group: "服务", key: "services.contact.title", label: "联系区标题", value: "商务咨询与合作" },
  { group: "服务", key: "services.contact.description", label: "联系区说明", multiline: true, value: "可直接通过邮箱或电话说明项目类型、目标时长和首批交付物。已有制作资料的合作方，也可以先进入创作台整理项目母档。" },
  { group: "服务", key: "services.contact.emailLabel", label: "邮箱标签", value: "合作邮箱" },
  { group: "服务", key: "services.contact.phoneLabel", label: "电话标签", value: "电话" },
  { group: "服务", key: "services.contact.wechatLabel", label: "微信标签", value: "微信" },
  { group: "服务", key: "services.contact.wechatFallback", label: "微信未配置提示", value: "请先通过邮箱或电话联系" },
  { group: "服务", key: "services.contact.primaryLabel", label: "联系区主按钮", value: "先看作品样板" },
  { group: "服务", key: "services.contact.secondaryLabel", label: "联系区次按钮", value: "整理项目资料" },

  { group: "关于", key: "about.seoTitle", label: "SEO 标题", value: "关于" },
  { group: "关于", key: "about.seoDescription", label: "SEO 描述", multiline: true, value: "战纪宇宙由灵穹打造，面向原创 AI 影视 IP 与商业影像服务。" },
  { group: "关于", key: "about.hero.eyebrow", label: "首屏眉题", value: "about" },
  { group: "关于", key: "about.hero.title", label: "首屏标题", multiline: true, value: "由灵穹打造的原创 AI 影视宇宙" },
  { group: "关于", key: "about.hero.description", label: "首屏说明", multiline: true, value: "战纪宇宙是对外 IP 品牌，灵穹是背后的 AI 影视制作与 IP 孵化服务主体。两者分工清晰：一个负责出圈，一个负责交付。" },
  { group: "关于", key: "about.brand.eyebrow", label: "品牌公司眉题", value: "brand and company" },
  { group: "关于", key: "about.brand.title", label: "品牌公司标题", value: "品牌在前，公司在后" },
  { group: "关于", key: "about.brand.description", label: "品牌公司说明", multiline: true, value: "战纪宇宙面向观众、平台和合作方展示原创 IP 的长期价值；长沙灵穹数字科技有限公司面向客户提供 AI 影像策划、资产库、分镜、提示词和样片交付。" },
  { group: "关于", key: "about.brand.brandLabel", label: "对外品牌标签", value: "对外品牌" },
  { group: "关于", key: "about.brand.companyLabel", label: "公司主体标签", value: "公司主体" },
  { group: "关于", key: "about.brand.roleLabel", label: "业务方向标签", value: "业务方向" },
  { group: "关于", key: "about.brand.cooperationLabel", label: "合作入口标签", value: "合作入口" },
  { group: "关于", key: "about.brand.cooperationValue", label: "合作入口内容", value: "商务咨询页统一承接" },
  { group: "关于", key: "about.team.eyebrow", label: "团队眉题", value: "team" },
  { group: "关于", key: "about.team.title", label: "团队标题", value: "团队与顾问" },
  { group: "关于", key: "about.team.description", label: "团队说明", multiline: true, value: "团队按内容、技术、运营与生产分工协作。公开信息只呈现已经确认的姓名、岗位与履历，避免用未核实资料包装团队。" },
  { group: "关于", key: "about.team.empty", label: "团队空状态", value: "团队资料正在整理中。" },
  { group: "关于", key: "about.principles.eyebrow", label: "工作方式眉题", value: "working principles" },
  { group: "关于", key: "about.principles.title", label: "工作方式标题", value: "我们的工作方式" },
  { group: "关于", key: "about.principles.description", label: "工作方式说明", multiline: true, value: "灵穹把原创内容开发和商业制作服务放在同一条资产化生产线上：作品证明审美，流程保障交付，真实状态建立长期信任。" },
  { group: "关于", key: "about.principles.items", label: "工作方式卡片", multiline: true, value: "原创 IP 长期开发\n制作资产持续沉淀\n服务交付可以复用\n作品状态真实透明" },

  { group: "生产线", key: "workflow.seoTitle", label: "SEO 标题", value: "AI 影视生产线" },
  { group: "生产线", key: "workflow.seoDescription", label: "SEO 描述", multiline: true, value: "战纪宇宙和灵穹的 AI 影视生产流程，从创意到交付。" },
  { group: "生产线", key: "workflow.hero.badge", label: "大厅标签", value: "创作生产线大厅" },
  { group: "生产线", key: "workflow.hero.title", label: "大厅标题", value: "AI影视生产线" },
  { group: "生产线", key: "workflow.hero.description", label: "大厅说明", multiline: true, value: "像浏览作品库一样浏览生产流程。每一张卡片都是一个可复用的制作节点、服务模板或项目样板。" },
  { group: "生产线", key: "workflow.hero.primaryLabel", label: "大厅主按钮", value: "开始生产" },
  { group: "生产线", key: "workflow.hero.secondaryLabel", label: "大厅次按钮", value: "查看作品样板" },
  { group: "生产线", key: "workflow.categories", label: "生产线分类", multiline: true, value: "全部\nAI影视流程\n专业影视\n短剧漫剧\n文旅展陈\n商业广告\nTV工具箱" },
  { group: "生产线", key: "workflow.banners", label: "生产线横幅", multiline: true, value: "从创意到成片，一条 AI 影视生产线|Production Studio|资产库 / 分镜 / 提示词 / 结果回收|workflow\n战纪宇宙001：《火种》概念流程|The Spark|旧物线索 / 人物关系 / 竖屏短剧|spark\n商业项目也能按影视流程交付|Business Delivery|文旅 / 品牌片 / 概念预告|services" },
  { group: "生产线", key: "workflow.searchLabel", label: "搜索无障碍标签", value: "搜索生产流程、服务或作品" },
  { group: "生产线", key: "workflow.searchPlaceholder", label: "搜索框提示", value: "请输入搜索内容" },
  { group: "生产线", key: "workflow.listTitle", label: "卡片列表标题", value: "Production Show" },
  { group: "生产线", key: "workflow.empty", label: "搜索空状态", value: "没有找到匹配的生产卡片。" },
  { group: "生产线", key: "workflow.api.title", label: "API 节点标题", value: "灵穹 API 模型节点" },
  { group: "生产线", key: "workflow.api.description", label: "API 节点说明", multiline: true, value: "把灵穹 API 作为生产线里的模型能力节点，读取已配置渠道和模型，供画布节点直接调用。" },
  { group: "生产线", key: "workflow.api.process", label: "API 节点流程", value: "模型池同步 / 节点选择 / 服务端调用 / 日志回收" },
  { group: "生产线", key: "workflow.actions.process", label: "流程卡按钮", value: "用此流程创建项目" },
  { group: "生产线", key: "workflow.actions.service", label: "服务卡按钮", value: "咨询此服务" },
  { group: "生产线", key: "workflow.actions.work", label: "作品卡按钮", value: "查看作品详情" },
  { group: "生产线", key: "workflow.actions.api", label: "API 卡按钮", value: "进入模型网关" },
  { group: "生产线", key: "workflow.creator.pipeline", label: "生产线创建者", value: "战纪宇宙生产线" },
  { group: "生产线", key: "workflow.creator.service", label: "服务创建者", value: "灵穹商业制作" },
  { group: "生产线", key: "workflow.cardCountSuffix", label: "卡片计数后缀", value: "个生产卡片" }
];

export const defaultSiteData: SiteData = {
  brand: {
    name: "战纪宇宙",
    english: "War Chronicle Universe",
    tagline: "用 AI 影像重燃时代故事，打造可持续更新的原创影视宇宙。",
    description:
      "战纪宇宙是一个原创 AI 影视宇宙和影像 IP 厂牌，聚焦家族记忆、时代选择与新一代成长，以工业化资产库和 AI 影像流程持续开发可展示、可招商、可扩展的作品。"
  },
  company: {
    name: "灵穹",
    legalName: "长沙灵穹数字科技有限公司",
    role: "AI 影视制作与 IP 孵化服务主体",
    contact: {
      email: "待填",
      phone: "待填",
      wechat: "待填"
    }
  },
  navItems: [
    { href: "/", label: "首页" },
    { href: "/universe", label: "世界观" },
    { href: "/works", label: "作品" },
    { href: "/workflow", label: "生产线" },
    { href: "/services", label: "服务" },
    { href: "/about", label: "关于" }
  ],
  media: defaultMedia,
  universeChapters: [
    {
      title: "火种一代",
      period: "记忆的起点",
      summary: "以旧物、日记和家族口述打开第一段故事，建立战纪宇宙的情感根。",
      icon: "Flame"
    },
    {
      title: "守土一代",
      period: "信念的延续",
      summary:
        "在家园、职责和集体记忆之间推进人物选择，让精神传承不只停留在口号。",
      icon: "ShieldCheck"
    },
    {
      title: "转折一代",
      period: "城市与时代",
      summary: "把历史线推进到现实生活，呈现普通家庭面对时代变化时的取舍。",
      icon: "Compass"
    },
    {
      title: "新兵一代",
      period: "当下的选择",
      summary: "以后代成长作为现实线，用入伍、创作和自我确认连接过去与现在。",
      icon: "UsersRound"
    },
    {
      title: "未来一代",
      period: "影像化宇宙",
      summary: "用 AI 影像资产持续扩展短剧、概念预告、纪录化短片和互动内容。",
      icon: "Sparkles"
    }
  ],
  works: [
    {
      slug: "the-spark",
      title: "战纪宇宙001：《火种》",
      category: "战纪宇宙",
      status: "开发中 / 概念样片阶段",
      format: "竖屏短剧 / 概念预告",
      logline:
        "一枚旧军功章和一本战地日记，把年轻人的现实选择与祖辈记忆重新接通。",
      image: defaultMedia.spark,
      tags: ["家族传承", "时代记忆", "第一部"],
      deliverables: ["IP 圣经 V1", "24 集大纲", "概念预告脚本", "角色资产库"]
    },
    {
      slug: "chronicle-trailer",
      title: "战纪宇宙概念预告",
      category: "概念预告",
      status: "概念展示",
      format: "90 秒预告片",
      logline: "以电影棚、投影和时代剪影构建战纪宇宙的第一视觉印象。",
      image: defaultMedia.hero,
      tags: ["品牌首屏", "AI 概念图", "招商素材"],
      deliverables: ["视觉基调", "预告分镜", "概念海报"]
    },
    {
      slug: "five-generations",
      title: "五代叙事视觉档案",
      category: "战纪宇宙",
      status: "设定开发中",
      format: "世界观视觉包",
      logline: "用五段时代影像连接火种、守土、转折、新兵与未来五条叙事支线。",
      image: defaultMedia.generations,
      tags: ["世界观", "五代叙事", "长期更新"],
      deliverables: ["时代分层", "人物关系", "主题线"]
    },
    {
      slug: "culture-tourism",
      title: "红色文旅 AI 影像样板",
      category: "文旅宣传",
      status: "服务模板",
      format: "宣传片 / 短视频矩阵",
      logline: "把地方故事、展馆动线和人物记忆转化为可传播的 AI 影像内容。",
      image: defaultMedia.services,
      tags: ["文旅", "展陈", "短视频"],
      deliverables: ["策划案", "分镜", "提示词", "样片"]
    },
    {
      slug: "brand-film",
      title: "企业精神品牌片样板",
      category: "品牌影像",
      status: "服务模板",
      format: "品牌片 / 概念片",
      logline: "以军旅风、奋斗史或创业史为核心，形成兼具情绪与执行力的品牌短片。",
      image: defaultMedia.workflow,
      tags: ["企业品牌", "精神叙事", "制作交付"],
      deliverables: ["故事策划", "视觉方案", "成片提示词"]
    },
    {
      slug: "aigc-short-series",
      title: "AI 短剧漫剧生产包",
      category: "短剧漫剧",
      status: "服务模板",
      format: "连续剧集 / 角色资产",
      logline: "围绕角色稳定、资产复用和集钩子，搭建适合持续更新的 AI 短剧流程。",
      image: defaultMedia.spark,
      tags: ["短剧", "漫剧", "资产库"],
      deliverables: ["大纲", "分集剧本", "角色表", "镜头提示词"]
    }
  ],
  pipelineSteps: [
    {
      title: "项目定位",
      eyebrow: "01",
      summary: "确认项目类型、受众、调性、商业目标和合规边界。",
      output: "项目简报 / 类型定位 / 成本范围",
      icon: "Compass"
    },
    {
      title: "故事策划",
      eyebrow: "02",
      summary: "从创意、小说、采访资料或品牌需求中提炼可拍故事。",
      output: "大纲 / 人物关系 / 主题线",
      icon: "PenTool"
    },
    {
      title: "剧本与节奏",
      eyebrow: "03",
      summary: "按短剧、预告、宣传片或文旅片的格式组织镜头化文本。",
      output: "剧本 / 旁白 / 分集钩子",
      icon: "ScrollText"
    },
    {
      title: "资产库沉淀",
      eyebrow: "04",
      summary: "沉淀人物、场景、道具、服装、声音参考与视觉风格。",
      output: "CH / SC / PR / AU / LOOK",
      icon: "Boxes"
    },
    {
      title: "分镜拆解",
      eyebrow: "05",
      summary: "拆出景别、机位、运镜、光影、表演、音效和转场。",
      output: "镜头表 / 分镜板 / 时长表",
      icon: "Clapperboard"
    },
    {
      title: "全能提示词",
      eyebrow: "06",
      summary: "把分镜转成视频模型更容易执行的影像提示词。",
      output: "图像提示词 / 视频提示词 / 参考图清单",
      icon: "WandSparkles"
    },
    {
      title: "生成与回收",
      eyebrow: "07",
      summary: "提交视频生成任务，回收结果并标注可复用镜头和问题。",
      output: "视频素材 / 修订记录 / 资产回流",
      icon: "PlaySquare"
    },
    {
      title: "成片交付",
      eyebrow: "08",
      summary: "完成剪辑、包装、字幕、声音和多平台版本整理。",
      output: "成片 / 宣发切片 / 交付包",
      icon: "Film"
    }
  ],
  services: [
    {
      title: "AI 概念预告片",
      audience: "IP 方、导演、制片、招商项目",
      summary: "把项目卖点快速变成可展示的电影感预告和视觉样片。",
      timeline: "7-15 天",
      deliverables: ["故事卖点", "概念海报", "预告分镜", "视频提示词", "样片交付"],
      icon: "Radio"
    },
    {
      title: "短剧 / 漫剧生产包",
      audience: "短剧团队、内容厂牌、账号矩阵",
      summary: "围绕角色稳定、集钩子和资产复用，完成可持续更新的制作包。",
      timeline: "10-30 天",
      deliverables: ["平台节奏", "分集剧本", "角色资产", "分镜", "全量提示词"],
      icon: "Layers3"
    },
    {
      title: "文旅与展陈影像",
      audience: "文旅项目、展馆、教育活动",
      summary: "把地方历史、人物故事和展陈动线转成影像化传播素材。",
      timeline: "15-45 天",
      deliverables: ["策划案", "旁白稿", "分镜", "概念样片", "短视频切片"],
      icon: "Building2"
    },
    {
      title: "企业精神品牌片",
      audience: "企业、园区、机构宣传",
      summary: "从企业发展史、人物精神和行业场景中提炼品牌影像表达。",
      timeline: "10-25 天",
      deliverables: ["创意方案", "脚本", "视觉设定", "提示词", "成片建议"],
      icon: "BookOpen"
    },
    {
      title: "原创 IP 孵化",
      audience: "创业团队、影视创作者、内容公司",
      summary: "从 0 到 1 搭建可招商、可发布、可继续开发的 IP 母档。",
      timeline: "30 天起",
      deliverables: ["IP 圣经", "世界观", "剧本", "资产库", "招商材料"],
      icon: "Sparkles"
    }
  ],
  teamMembers: [
    {
      avatar: "",
      expertise: [],
      highlights: [],
      name: "周戈",
      role: "领军人物",
      group: "领军人物",
      bio: "",
      slug: "zhou-ge"
    },
    {
      avatar: "",
      expertise: [],
      highlights: [],
      name: "杨开井",
      role: "战略投资顾问",
      group: "战略投资顾问",
      bio: "",
      slug: "yang-kai-jing"
    },
    {
      avatar: "",
      expertise: [],
      highlights: [],
      name: "瞿烁",
      role: "战略投资顾问",
      group: "战略投资顾问",
      bio: "",
      slug: "qu-shuo"
    },
    {
      avatar: "",
      expertise: [],
      highlights: [],
      name: "胡砚尘",
      role: "执行董事",
      group: "核心团队",
      bio: "",
      slug: "hu-yan-chen"
    },
    {
      avatar: "",
      expertise: [],
      highlights: [],
      name: "孙超",
      role: "总经理",
      group: "核心团队",
      bio: "",
      slug: "sun-chao"
    },
    {
      avatar: "",
      expertise: [],
      highlights: [],
      name: "廖文基",
      role: "技术总监",
      group: "核心团队",
      bio: "",
      slug: "liao-wen-ji"
    },
    {
      avatar: "",
      expertise: [],
      highlights: [],
      name: "申家铭",
      role: "运营总监",
      group: "核心团队",
      bio: "",
      slug: "shen-jia-ming"
    },
    {
      avatar: "",
      expertise: [],
      highlights: [],
      name: "谢欣阳",
      role: "生产总监",
      group: "核心团队",
      bio: "",
      slug: "xie-xin-yang"
    }
  ],
  proofPoints: [
    "原创 AI 影视宇宙",
    "作品开发与服务现金流分离",
    "资产库驱动的持续更新",
    "概念样片到商务交付"
  ],
  siteCopy: defaultSiteCopy
};

export function siteCopyValue(
  data: Pick<SiteData, "siteCopy">,
  key: string,
  fallback = ""
) {
  return data.siteCopy.find((entry) => entry.key === key)?.value ?? fallback;
}

export function siteCopyLines(
  data: Pick<SiteData, "siteCopy">,
  key: string,
  fallback: string[] = []
) {
  const value = siteCopyValue(data, key);

  return value
    ? value
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
    : fallback;
}

export function siteCopyRows(
  data: Pick<SiteData, "siteCopy">,
  key: string,
  fallback: string[][] = []
) {
  const lines = siteCopyLines(data, key);

  return lines.length
    ? lines.map((line) => line.split("|").map((part) => part.trim()))
    : fallback;
}

export const { brand, company, navItems, proofPoints } = defaultSiteData;
export const media = defaultSiteData.media;
export const universeChapters = defaultSiteData.universeChapters;
export const works = defaultSiteData.works;
export const pipelineSteps = defaultSiteData.pipelineSteps;
export const services = defaultSiteData.services;
export const teamMembers = defaultSiteData.teamMembers;
