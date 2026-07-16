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

const localCompose = source("docker-compose.yml");
const baotaCompose = source("docker-compose.baota.yml");
const nginx = source("infra/nginx/default.conf");
const menuSql = source(
  "vendor/jeecg-boot/jeecg-boot/jeecg-module-system/jeecg-system-start/src/main/resources/flyway/sql/mysql/V3.9.3_9__lingqiong_operations.sql"
);
const dataService = source(
  "vendor/jeecg-boot/jeecg-boot/jeecg-boot-module/jeecg-module-lingqiong/src/main/java/org/jeecg/modules/lingqiong/service/LingqiongDataCenterService.java"
);
const operationsController = source(
  "vendor/jeecg-boot/jeecg-boot/jeecg-boot-module/jeecg-module-lingqiong/src/main/java/org/jeecg/modules/lingqiong/controller/LingqiongOperationsController.java"
);
const operationsUi = source(
  "vendor/jeecg-boot/jeecgboot-vue3/src/views/lingqiong/operations/index.vue"
);
const dataUiPath = "vendor/jeecg-boot/jeecgboot-vue3/src/views/lingqiong/data/index.vue";
const dataApiPath = "vendor/jeecg-boot/jeecgboot-vue3/src/views/lingqiong/data/data.api.ts";
const dataUi = source(dataUiPath);
const projectUi = source("src/components/project/project-creator.tsx");
const skillUi = source("src/components/skills/user-skill-workbench.tsx");
const skillAdminUi = source("vendor/jeecg-boot/jeecgboot-vue3/src/views/lingqiong/platform/index.vue");
const skillApi = source("src/app/api/admin/skills/route.ts");
const database = source("src/lib/database.ts");

check("Jeecg 全业务数据中心组件存在", existsSync(resolve(root, dataUiPath)));
check("Jeecg 全业务数据中心 API 客户端存在", existsSync(resolve(root, dataApiPath)));
check("后台菜单指向真实组件", menuSql.includes("'lingqiong/data/index'"));
check("后台项目具备生产链入口", operationsUi.includes("openProjectFlow") && operationsUi.includes("项目生产链"));
check("后台生产链具备服务端汇总接口", operationsController.includes('@GetMapping("/projects/{id}/flow")'));
check("后台业务数据支持按项目过滤", dataService.includes("PROJECT_SCOPED_MODULES") && dataService.includes("`project_id` = ?"));
check("数据中心沿用项目筛选跳转", dataUi.includes("projectId") && dataUi.includes("openProjectFlow"));
check("前台项目通过平台 API 读写", projectUi.includes('/_wcu-api/projects'));
check("Skill 用户端按目标与项目组织任务", skillUi.includes("选择今天的创作目标") && skillUi.includes('/_wcu-api/projects') && skillUi.includes('/_wcu-api/skills/run'));
check("Skill 用户端展示账户与充值状态", skillUi.includes('/_wcu-api/account/overview') && skillUi.includes('/account/billing'));
check("Jeecg 后台编辑完整 Skill 模块", skillAdminUi.includes('skillModules') && skillAdminUi.includes('保存并同步前台'));
check("Skill 后台接口校验多模块结构", skillApi.includes('normalizeModules') && skillApi.includes('Skill 至少需要一个任务模块'));
check("官网业务库包含完整生产主表", ["projects", "episodes", "elements", "storyboards", "voiceovers", "compositions", "generation_jobs"].every((table) => database.includes(`CREATE TABLE IF NOT EXISTS ${table}`)));
check("本地 Web 与 API 运行角色分离", localCompose.includes("PLATFORM_RUNTIME_ROLE: web") && localCompose.includes("PLATFORM_RUNTIME_ROLE: api"));
check("宝塔 Web 与 API 运行角色分离", baotaCompose.includes("PLATFORM_RUNTIME_ROLE: web") && baotaCompose.includes("PLATFORM_RUNTIME_ROLE: api"));
check("Jeecg 读取同一灵穹业务库", [localCompose, baotaCompose].every((compose) => compose.includes('LINGQIONG_DB_NAME: "${MYSQL_DATABASE')));
check("Jeecg 内部桥接使用独立服务密钥", [localCompose, baotaCompose].every((compose) => compose.includes("LINGQIONG_SERVICE_SECRET") && compose.includes("JEECG_SERVICE_SECRET")));
check("官网 API 网关指向 platform-api", nginx.includes("location /_wcu-api/") && nginx.includes("proxy_pass http://zhanji_platform_api/api/"));
check("运营后台独立指向 Jeecg", nginx.includes("location /admin/") && nginx.includes("proxy_pass http://lingqiong_jeecg_admin"));
check("Jeecg API 独立反向代理", nginx.includes("location /jeecgboot/") && nginx.includes("proxy_pass http://lingqiong_jeecg_system"));
check("项目主流程覆盖七个连续环节", ["projects", "episodes", "elements", "storyboards", "voiceovers", "compositions", "generationJobs"].every((key) => dataUi.includes(`key: '${key}'`)));

const failed = results.filter((item) => !item.passed);
if (failed.length) {
  console.error(`LINKAGE_AUDIT_FAILED ${results.length - failed.length}/${results.length}`);
  process.exit(1);
}

console.log(`LINKAGE_AUDIT_OK ${results.length}/${results.length}`);
