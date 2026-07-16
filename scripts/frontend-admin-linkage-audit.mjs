#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const results = [];

function source(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function check(label, condition, detail = "") {
  const passed = Boolean(condition);
  results.push({ label, passed });
  console.log(`${passed ? "PASS" : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
}

const nativeAdminFiles = [
  "src/app/admin/page.tsx",
  "src/components/admin/admin-dashboard.tsx",
  "src/components/admin/admin-login.tsx",
  "src/components/admin/admin-security-admin.tsx",
  "src/components/admin/model-api-admin.tsx",
  "src/components/admin/new-api-console.tsx",
  "src/components/admin/skill-admin.tsx"
];
const nativeAdminRoutes = [
  "src/app/api/admin/audit/route.ts",
  "src/app/api/admin/content/route.ts",
  "src/app/api/admin/database/route.ts",
  "src/app/api/admin/login-settings/route.ts",
  "src/app/api/admin/login/route.ts",
  "src/app/api/admin/logout/route.ts",
  "src/app/api/admin/me/route.ts",
  "src/app/api/admin/media/route.ts",
  "src/app/api/admin/model-api-calls/route.ts",
  "src/app/api/admin/model-apis/route.ts",
  "src/app/api/admin/project-types/route.ts",
  "src/app/api/admin/skills/route.ts",
  "src/app/api/admin/users/route.ts"
];

const adminPage = source("src/app/admin/page.tsx");
const adminDashboard = source("src/components/admin/admin-dashboard.tsx");
const adminLogin = source("src/components/admin/admin-login.tsx");
const adminAuth = source("src/lib/admin-auth.ts");
const adminLoginRoute = source("src/app/api/admin/login/route.ts");
const adminLogoutRoute = source("src/app/api/admin/logout/route.ts");
const contentRoute = source("src/app/api/admin/content/route.ts");
const publicContentRoute = source("src/app/api/v1/site-content/route.ts");
const projectTypesRoute = source("src/app/api/admin/project-types/route.ts");
const publicProjectTypesRoute = source("src/app/api/v1/project-types/route.ts");
const skillRoute = source("src/app/api/admin/skills/route.ts");
const skillAdmin = source("src/components/admin/skill-admin.tsx");
const skillUi = source("src/components/skills/user-skill-workbench.tsx");
const projectUi = source("src/components/project/project-creator.tsx");
const platformClient = source("src/lib/platform-api-client.ts");
const database = source("src/lib/database.ts");
const appShellBoundary = source("src/components/app-shell-boundary.tsx");
const siteHeader = source("src/components/site-header.tsx");
const siteFooter = source("src/components/site-footer.tsx");
const nginx = source("infra/nginx/default.conf");

check(
  "原生战纪宇宙后台页面与功能组件完整",
  nativeAdminFiles.every((path) => existsSync(resolve(root, path)))
);
check(
  "原生后台 API 覆盖会话、内容、业务、权限与审计",
  nativeAdminRoutes.every((path) => existsSync(resolve(root, path)))
);
check(
  "/admin 直接渲染原生 AdminDashboard",
  adminPage.includes('import { AdminDashboard } from "@/components/admin/admin-dashboard"') &&
    adminPage.includes("<AdminDashboard />") &&
    !adminPage.includes("Jeecg") &&
    !adminPage.includes("redirect(")
);
check(
  "后台使用原生登录页与原生会话 API",
  adminDashboard.includes("<AdminLogin") &&
    adminLogin.includes('fetch("/_wcu-api/admin/login"') &&
    adminLogin.includes('window.location.replace("/admin")') &&
    adminDashboard.includes('fetch("/_wcu-api/admin/me"') &&
    adminDashboard.includes('fetch("/_wcu-api/admin/logout"')
);
check(
  "原生管理员登录仅建立独立后台会话",
  adminLoginRoute.includes("authenticateAdminUser") &&
    adminLoginRoute.includes("setAdminSession(user)") &&
    !adminLoginRoute.includes("setPlatformSession")
);
check(
  "原生管理员退出不会清理前台创作者会话",
  adminLogoutRoute.includes("revokeAdminSession") &&
    !adminLogoutRoute.includes("clearPlatformSession")
);
check(
  "部署 smoke 使用通用内部服务身份而非 Jeecg 身份",
  adminAuth.includes("WCU_INTERNAL_SERVICE_SECRET") &&
    adminAuth.includes('x-wcu-internal-service-secret') &&
    adminAuth.includes("wcu-internal-service") &&
    !adminAuth.includes("JEECG_SERVICE_SECRET") &&
    !adminAuth.includes("x-lingqiong-service-secret")
);
check(
  "官网内容 API 使用权限校验并写入安全审计",
  contentRoute.includes('authorizeAdmin("content.read")') &&
    contentRoute.includes('authorizeAdmin("content.write")') &&
    contentRoute.includes('action: "content.update"')
);
check(
  "项目类型 API 实现原生创建、更新、删除和分权",
  projectTypesRoute.includes("upsertProjectType") &&
    projectTypesRoute.includes("deleteProjectType") &&
    projectTypesRoute.includes('authorizeAdmin("projects.read")') &&
    projectTypesRoute.includes('authorizeAdmin("projects.write")')
);
check(
  "Skill API 实现原生创建、更新、删除与多模块校验",
  skillRoute.includes("upsertSkillTool") &&
    skillRoute.includes("deleteSkillTool") &&
    skillRoute.includes("normalizeModules") &&
    skillRoute.includes("至少需要一个任务模块")
);
check(
  "原生后台以用户任务导航所有内容和平台模块",
  [
    "官网与品牌",
    "团队与顾问",
    "作品内容",
    "项目类型",
    "Skill 工具",
    "用户与项目",
    "充值与账务",
    "管理员与权限",
    "安全审计"
  ].every((label) => adminDashboard.includes(label))
);
check(
  "原生后台按自定义管理员权限独立加载模块",
  adminDashboard.includes("function canAccessAdminTab") &&
    adminDashboard.includes('hasAdminPermission(admin, "content.read")') &&
    adminDashboard.includes('hasAdminPermission(admin, "projects.read")') &&
    adminDashboard.includes('hasAdminPermission(admin, "settings.read")') &&
    adminDashboard.includes('canAccessAdminTab(admin, "database")') &&
    adminDashboard.includes("Promise.allSettled(permittedLoads)") &&
    adminDashboard.includes("setData(defaultSiteData)")
);
check(
  "缺少官网内容权限不会阻断模型、管理员或审计模块",
  adminDashboard.includes('api: "modelApi.read"') &&
    adminDashboard.includes('users: "users.read"') &&
    adminDashboard.includes('audit: "audit.read"') &&
    adminDashboard.includes('permission: "system.read"') &&
    adminDashboard.includes(
      'hasAdminPermission(currentAdmin, "system.read") ? ('
    )
);
check(
  "原生 Skill 管理界面读写原生后台 API",
  skillAdmin.includes('fetch("/_wcu-api/admin/skills"') &&
    skillAdmin.includes("modules") &&
    adminDashboard.includes("<SkillAdmin />")
);
check(
  "前台 Skill 与原生后台读写同一 Skill 业务源",
  skillUi.includes('/_wcu-api/skills') &&
    skillUi.includes('/_wcu-api/skills/run') &&
    skillRoute.includes("@/lib/skill-workbench")
);
check(
  "后台官网修改与对外平台 API 共用 site-data 数据源",
  contentRoute.includes("saveSiteData") &&
    contentRoute.includes("getSiteData") &&
    publicContentRoute.includes("getSiteData") &&
    platformClient.includes('requestPlatformApi<SiteData>("site-content")')
);
check(
  "后台项目类型与前台创建项目共用 project-types 数据源",
  projectTypesRoute.includes('from "@/lib/project-types"') &&
    publicProjectTypesRoute.includes('from "@/lib/project-types"') &&
    projectUi.includes('/_wcu-api/project-types')
);
check(
  "前台项目生产链通过统一平台 API 真实读写",
  projectUi.includes('/_wcu-api/projects') &&
    ["projects", "episodes", "elements", "storyboards", "voiceovers", "compositions", "generation_jobs"].every(
      (table) => database.includes(`CREATE TABLE IF NOT EXISTS ${table}`)
    )
);
check(
  "官网头部和页脚不暴露管理员后台入口",
  !siteHeader.includes('href="/admin') &&
    !siteFooter.includes('href: "/admin')
);
check(
  "原生后台使用 standalone 布局不重复渲染官网壳层",
  appShellBoundary.includes('"/admin"')
);
check(
  "统一网关将后台 API 交给 platform-api 且不再代理 Jeecg",
  nginx.includes("location /_wcu-api/") &&
    nginx.includes("proxy_pass http://zhanji_platform_api/api/") &&
    !nginx.includes("lingqiong_jeecg_admin") &&
    !nginx.includes("/jeecgboot/")
);
check(
  "原生运行链不依赖 vendor/jeecg-boot",
  [
    adminPage,
    adminDashboard,
    adminLogin,
    adminAuth,
    contentRoute,
    projectTypesRoute,
    skillRoute
  ].every((value) => !value.includes("jeecg-boot") && !value.includes("Jeecg"))
);

const failed = results.filter((item) => !item.passed);

if (failed.length) {
  console.error(`LINKAGE_AUDIT_FAILED ${results.length - failed.length}/${results.length}`);
  process.exitCode = 1;
} else {
  console.log(`LINKAGE_AUDIT_OK ${results.length}/${results.length}`);
}
