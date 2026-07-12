# 灵穹知识工作台

更新日期：2026-07-12  
模块入口：`/knowledge`  
历史资料入口：`/bookstack/`

## 1. 模块定位

灵穹知识工作台是站内原生的团队知识与结构化数据中心，采用“知识空间 + Wiki 页面树 + 多维表格”双核心。它不再依赖 BookStack 承载新增内容；原 BookStack 继续作为历史资料、迁移核对和灾备参考入口。

本模块参考飞书知识库与多维表格的桌面工作方式，但使用灵穹品牌、统一登录、权限体系和生产数据边界，不复制飞书商标、代码或私有数据。

## 2. 当前界面结构

### 2.1 桌面工作区

- 灵穹全局 Rail：官网、项目、创作台、Skill 与知识库之间快速切换。
- Wiki 侧栏：知识空间切换、当前空间搜索、目录页树、多维表格列表、历史知识库入口。
- 顶部栏：面包屑、最近修改/自动保存状态、版本历史、分享、评论、通知、自动化和更多操作。
- 内容区：根据当前对象显示知识首页、块文档或多维表格工作区。
- URL Hash 保存 `space/page/table/view/record`，刷新页面可以恢复当前工作位置。

移动端会把 Rail 收到底部，并将 Wiki 侧栏、表格数据表导航和内容区改为可滚动布局。

### 2.2 Wiki 页面树

- 支持知识空间切换和新建空间。
- 支持父子页面、展开/收起、在当前页面下新建子页、上下排序和页面设置。
- 页面和多维表格都可以从侧栏打开。
- 输入不少于 2 个字符时调用权限过滤后的全局搜索，结果覆盖页面、数据表和记录；点击结果可直接定位到对应对象。
- 短搜索词仍用于当前空间页面树与数据表标题过滤。
- 侧栏回收站是真实数据入口：页面和多维表格先软删除，可恢复；只有空间所有者或平台管理员可以永久删除。

### 2.3 文档块编辑器

页面内容直接保存为 JSON `blocks` 数组，不会压平成纯文本。当前块类型：

- 正文
- 一级标题
- 二级标题
- 待办
- 引用
- 分割线
- 代码块
- 提示块

核心操作：

- `Enter` 新建下一内容块。
- `Shift + Enter` 在当前块内换行。
- 空块按 `Backspace` 删除并回到上一块。
- 空块输入 `/` 打开块命令菜单。
- 悬停显示新增块与块菜单控件。
- 选中文字显示跟随式迷你工具栏，支持加粗、斜体、行内代码和链接标记。
- 标题与内容修改后约 900ms 自动保存；界面显示“等待自动保存 / 保存中 / 已自动保存 / 版本冲突”。
- 所有保存携带页面 `revision`；发生并发冲突时不会覆盖他人内容，需要刷新后重新处理。

### 2.4 多维表格工作区

多维表格采用四层结构：

1. 数据表/仪表盘/工作流导航。
2. 当前数据表标题与分享、自动化、通知、搜索操作。
3. 视图标签。
4. “添加记录、字段配置、视图配置、筛选、分组、排序、行高”等工具栏及数据区。

已支持六种真实视图：

- 表格：单元格编辑、字段菜单、字段新增、记录详情。
- 看板：按配置字段分组展示记录卡片。
- 日历：按日期字段组织记录。
- 画册：用卡片形式展示记录。
- 甘特：使用前两个日期字段作为开始/结束日期，按时间比例绘制任务条；只有一个日期字段时按单日任务展示。
- 表单：登录成员填写当前可编辑字段并提交，提交后通过真实记录 API 创建数据。

仪表盘基于当前表格实时计算记录数、字段数、最近更新时间和第一个单选字段的分布。工作流入口直接打开真实自动化规则与运行日志。

记录接口按 500 条分页并返回 `total/hasMore/offset`；工作台提供“加载更多”，CSV 导入后的第 501 条及后续数据不会在界面中永久不可见。新建多维表格会在同一事务创建不可删除的主文本字段“名称”和默认表格视图。

## 3. 数据与真实操作

### 3.1 核心资源

当前使用 14 张 MySQL 表：

- `knowledge_spaces`
- `knowledge_pages`
- `knowledge_tables`
- `knowledge_fields`
- `knowledge_records`
- `knowledge_views`
- `knowledge_space_members`
- `knowledge_page_comments`
- `knowledge_page_versions`
- `knowledge_record_comments`
- `knowledge_record_activities`
- `knowledge_automation_rules`
- `knowledge_automation_runs`
- `knowledge_record_attachments`

迁移文件：

- `infra/mysql/migrations/004-knowledge-workspace.sql`
- `infra/mysql/migrations/005-knowledge-collaboration.sql`
- `infra/mysql/migrations/006-knowledge-attachments.sql`
- `infra/mysql/migrations/007-knowledge-trash.sql`

附件文件写入 `platform-api` 的持久化数据目录 `knowledge-uploads`，单文件上限 20MB。

### 3.2 字段与视图类型

后端接受 23 种字段类型：

`text`、`number`、`select`、`multi_select`、`date`、`checkbox`、`url`、`person`、`attachment`、`phone`、`email`、`location`、`barcode`、`progress`、`currency`、`rating`、`autonumber`、`button`、`lookup`、`relation`、`formula`、`created_time`、`updated_time`。

六种视图类型：`grid`、`kanban`、`calendar`、`gallery`、`gantt`、`form`。

字段显隐、筛选、排序、分组、行高、冻结列和默认视图作为视图元数据持久化。字段重命名、字段删除、记录新增/编辑/删除均调用真实 API。

### 3.3 成员与权限

空间角色：

| 角色 | 读取 | 评论 | 编辑 | 管理成员 |
| --- | --- | --- | --- | --- |
| `viewer` | 是 | 否 | 否 | 否 |
| `commenter` | 是 | 是 | 否 | 否 |
| `editor` | 是 | 是 | 是 | 否 |
| `owner` | 是 | 是 | 是 | 是 |
| 平台 Admin | 取决于后台权限 | 取决于后台权限 | 取决于后台权限 | 取决于后台权限 |

分享面板使用 `/spaces/:spaceId/members` 完成成员列表、新增、角色修改和移除。空间所有者不可被降级或删除。平台 Admin 读取依赖 `projects.read`，评论、编辑和管理依赖 `projects.write`。

### 3.4 评论、历史和活动

- 页面评论与记录评论支持发布、解决、重新打开和软删除。
- 后端支持父评论 ID；当前界面先提供一级讨论列表，尚未呈现线程回复 UI。
- 页面每次修改与恢复都会写入版本历史。
- 历史面板支持版本列表、完整内容预览和恢复；恢复也会形成新的版本记录。
- 记录活动包括创建、更新、评论和评论删除等事件，记录详情“活动”页签按时间倒序展示。
- 页面及其活动子页面、以及多维表格删除时先进入回收站；恢复和永久删除继续使用 revision 乐观锁。

### 3.5 自动化

自动化规则支持：

- 触发类型：手动、新增记录、更新记录、字段变化；后端也保留定时触发类型。
- 动作类型：通知、设置字段、更新记录。
- 创建、启停、删除、手动执行和运行日志。
- 手动执行先创建 queued 运行记录，再调用 `/runs/:runId/execute` 真正执行；界面只在执行接口成功后提示“自动化已执行”。

新增记录、更新记录和字段变化规则会在业务写入完成后自动排队并调用执行器；手动规则由界面显式执行。后端虽然保留 `schedule` 类型，但当前没有 Cron 调度入口。大规模生产仍需要独立异步 Worker、定时调度、重试与死信机制，详见第 7 节。

### 3.6 附件与 CSV

- 记录详情“附件”页签支持 multipart 单文件上传、权限校验下载和 revision 保护删除。
- 文件名经过路径与控制字符清理，下载响应带 `private, no-store` 和 `nosniff`。
- CSV 导入：最大 20MB、100 列、20,000 数据行；可按字段名映射，也支持后端按配置创建缺失字段。
- 导入允许部分成功，响应分别返回 `imported`、`total`、`createdFields[]` 和 `failed[]`。
- CSV 导出按当前视图字段、筛选与排序生成，并对可能被表格软件解释为公式的内容增加防护。

## 4. API 与前后端边界

浏览器只请求 `/_wcu-api/knowledge`。Nginx/Next 重写将请求交给独立 `platform-api`；`web` 运行时不持有 MySQL 凭据。

主要接口组：

- `/search`
- `/spaces`、`/spaces/:spaceId/members`
- `/spaces/:spaceId/pages`、`/comments`、`/versions`
- `/spaces/:spaceId/trash`、`/trash/:resourceType/:resourceId/restore`
- `/spaces/:spaceId/tables`、`/fields`、`/records`、`/views`
- `/records/:recordId/comments`、`/activity`、`/attachments`
- `/tables/:tableId/import`、`/export`
- `/tables/:tableId/automations`、`/runs`、`/execute`

所有写操作在服务端重复校验身份、空间/表格归属、输入结构和权限。可变资源使用 revision 乐观锁，过期写入返回 409，不在前端伪造保存成功。

## 5. 当前验证状态

截至 2026-07-12，本轮已真实执行并通过：

- 正式生产构建：`pnpm build`。
- 全仓 TypeScript：`pnpm exec tsc --noEmit`。
- 知识工作台前后端 ESLint：0 error / 0 warning。
- 两份知识库冒烟脚本语法检查：`node --check scripts/knowledge-workspace-smoke.mjs`、`node --check scripts/knowledge-collaboration-smoke.mjs`。
- 正式 Docker 镜像构建并在本地生产编排中健康启动。
- 知识库主流程：108 / 108 项通过。
- 协作、权限、回收站与分页：57 项通过并完成测试数据清理。
- 全站 HTTP 回归：46 / 46 项通过；RBAC：12 / 12 项通过。
- 生产流程：48 / 48 项通过；项目及生产实体、revision 冲突、服务端导出与测试数据清理均通过。
- 浏览器实机验证：目录折叠与快捷搜索、文档切页保存、六种视图切换、记录详情四页签、分享与成员权限、回收站空态，以及 `/projects` 真实创建、服务端导出、永久删除均通过。

仓库中的 `pnpm audit:knowledge` 是可逆的真实 API 验收脚本，覆盖：

- 管理员登录与知识工作台页面。
- 空间及成员 CRUD。
- 页面、子页面、排序、revision 冲突。
- 页面历史列表、详情和恢复。
- 页面/记录评论创建、更新、解决和删除。
- 数据表、字段、记录和视图。
- 活动流。
- 自动化规则、真实执行结果、运行日志、启停和删除。
- CSV 导入/导出与公式注入防护。
- 附件上传、列表、安全下载、删除。
- 所有测试数据的最终清理。

本地生产镜像与真实 API 验收已经通过。部署到正式服务器后仍须针对正式域名、正式数据库和正式反向代理再运行一次：

```bash
KNOWLEDGE_TEST_BASE_URL=https://正式域名 \
KNOWLEDGE_TEST_ADMIN_USERNAME='正式管理员账号' \
KNOWLEDGE_TEST_ADMIN_PASSWORD='正式管理员密码' \
pnpm audit:knowledge
```

## 6. 首次使用与运维

- 首次访问会为没有空间的账号创建默认知识空间、示例页面和示例数据表。
- 上线前备份 MySQL 和 `data/web/knowledge-uploads`。
- 恢复数据库时应同时恢复附件目录，避免数据库元数据与文件内容不一致。
- `/bookstack/` 保留历史入口；迁移完成前不要删除 BookStack 数据卷。
- 正式服务器上线后必须再运行 `audit:knowledge`，并以 owner、editor、commenter、viewer 四种角色复核正式域名下的权限行为。

## 7. 仍需企业级建设

当前模块已形成可用的团队知识与结构化数据闭环，但以下能力仍属于企业级下一阶段：

1. 页面/子树、记录行和字段级权限，以及组织架构/用户组同步。
2. 外部分享链接、到期时间、密码、水印、下载限制和访客审计。
3. 多人实时光标、在线状态、离线草稿、操作转换/CRDT 与三方冲突合并。
4. 块级评论锚点、线程回复 UI、`@成员`、表情回应和评论订阅。
5. 历史版本逐块 Diff、命名版本、保留策略、法律保全和批量恢复。
6. 公式计算引擎、关联/查找实时联动、汇总字段与跨表级联。
7. 甘特依赖、里程碑、关键路径、工作日历与资源负载。
8. 公共/匿名表单、条件字段、审批、验证码、防滥用和提交后工作流。
9. 可配置图表仪表盘、透视分析和跨表指标。
10. 自动化独立异步 Worker、Cron 调度、重试/死信、Webhook/邮件/IM 连接器、幂等和告警。
11. XLSX 导入导出、批量 API、完整空间备份包和跨租户迁移工具。
12. 附件对象存储、病毒扫描、图片/PDF/音视频预览、版本和生命周期策略。
13. 专用全文检索引擎、中文分词、权限索引、结果高亮和搜索分析。
14. 审计日志导出、数据保留/删除策略、等保与合规控制。
