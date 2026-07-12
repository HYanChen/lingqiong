# 灵穹 BookStack 历史知识库接入

灵穹主知识库现已迁移到站内 `/knowledge`，提供知识空间、页面树与多维表格。`BookStackApp/BookStack` 继续保留在 `vendor/bookstack`，作为历史资料、制作文档和迁移过渡入口。

## 当前集成方式

- 源码子模块：`vendor/bookstack`
- Docker 服务：`bookstack`
- 历史入口：`http://localhost/bookstack/`
- 数据库：共享 MySQL 内的 `bookstack`
- 持久化目录：`data/bookstack/`

后台 `/admin` 的 `知识库` 标签页默认打开站内知识工作台，并保留 BookStack 历史入口。BookStack 不再提供单独登录入口，继续通过战纪宇宙平台会话进入。

本地浏览器统一使用 `http://localhost`。访问 `http://127.0.0.1` 时网关会跳转到该规范地址，避免 BookStack 的绝对静态资源、OIDC 回调和登录 Cookie 分属两个来源而导致排版或统一登录异常。

## 统一登录与权限

BookStack 使用战纪宇宙 OIDC 作为登录来源：

- `admin` 组会映射到 BookStack 的 `Admin` 角色，可以新建书架、书籍并进入后台管理。
- `creator` 组会映射到 BookStack 的 `Editor` 角色，可以新建和编辑内容。
- 默认注册角色为 `Editor`，避免外部登录新用户没有任何创建权限。

当前集成脚本会在容器启动时自动写入这些角色映射，并为已有的 `admin:*` 外部账号补上 `Admin` 角色。

## 启动方式

完整平台启动：

```bash
pnpm preview:80
```

只启动知识库相关服务：

```bash
pnpm bookstack:up
```

查看 BookStack 日志：

```bash
pnpm bookstack:logs
```

如果是重新克隆本项目，请先初始化子模块：

```bash
git submodule update --init --recursive
```

## 数据库说明

`docker-compose.yml` 中的 `bookstack-db-init` 会在共享 MySQL 容器里创建 `bookstack` 数据库，并授权给当前 `MYSQL_USER`。这样官网业务库、灵穹 API 库和 BookStack 知识库都在同一套 MySQL 服务里，但各自数据库分开。

默认本地配置位于 `.env.new-api.example`：

- `BOOKSTACK_APP_URL=http://localhost/bookstack`
- `BOOKSTACK_BRAND_NAME=灵穹知识库`
- `BOOKSTACK_DATABASE=bookstack`

上线前请替换 `BOOKSTACK_APP_KEY`，并把 `BOOKSTACK_APP_URL` 改成正式域名路径。

`infra/bookstack/custom-cont-init.d/10-lingqiong-brand.sh` 会在 BookStack 容器启动后自动把站点名、主色、链接色、默认注册角色和 OIDC 角色映射写入 BookStack 设置表，避免新环境仍显示默认 BookStack 品牌或新用户没有权限。

## 推荐栏目

- 战纪宇宙设定：世界观、时代线、人物关系、核心主题。
- 项目制作手册：从项目创建、剧集、资产、分镜、灵穹 API 到交付的流程。
- 模型与提示词库：模型用途、风格词、镜头词、负面词和审核规则。

## 注意事项

BookStack 是独立的 Laravel 应用，保留自己的权限、书架、书籍、章节和页面系统。战纪宇宙后台负责统一入口、统一登录和部署编排，不在 Next.js 内重写 BookStack 的内容管理逻辑。
