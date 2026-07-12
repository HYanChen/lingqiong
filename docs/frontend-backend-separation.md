# 灵穹平台前后端运行时分离（第一阶段）

## 目标

本阶段先建立可部署、可验证的运行时边界，不一次性搬迁所有旧 API 源码。

- `web` 只承载官网、登录页、管理界面和其他页面渲染。
- `platform-api` 承载公共 API、旧 `/_wcu-api` 业务 API、认证、管理、OIDC 与数据库访问。
- `web` 容器不持有 MySQL 环境变量，并且 `PLATFORM_RUNTIME_ROLE=web` 会在代码层禁止该进程打开数据库连接。
- `platform-api` 暂时使用与 `web` 相同的 Next.js 镜像，但是独立进程、独立容器、独立环境变量和独立上游。

New API 和 BookStack 是独立业务系统，仍管理各自的数据库连接；本文所说的 MySQL 边界是灵穹主应用的 `web` 与 `platform-api` 之间的边界。

## 部署拓扑

```text
浏览器
  |
  v
Nginx
  |-- /, /works, /about ... ------> web:3000
  |-- /_wcu-api/* ----------------> platform-api:3000/api/*
  |-- /platform-api/v1/* ---------> platform-api:3000/api/v1/*
  |-- /api/*, /v1/* --------------> new-api:3000
  |-- /bookstack/* ----------------> bookstack:80

web -- PLATFORM_API_INTERNAL_URL --> platform-api -- MySQL
BookStack -- OIDC -----------------> platform-api
New API -- OIDC -------------------> platform-api
```

`/_wcu-auth-check` 也由 Nginx 转给 `platform-api`，因此 BookStack 等子系统的统一登录校验不再依赖页面进程。

OIDC 采用精确回调白名单。`WCU_OIDC_REDIRECT_URIS` 必须同时包含站点域名下的 `/bookstack/oidc/callback` 与 `/oauth/oidc`，不能使用通配符、跨域地址或协议相对地址。

本地开发统一以 `http://localhost` 作为浏览器来源；`127.0.0.1` 会由网关 308 到 localhost。这样 BookStack 的绝对静态资源、平台会话 Cookie 与 OIDC 回调不会跨来源分裂。

## 公共 Platform API v1

对外统一前缀为 `/platform-api/v1/`，容器内部前缀为 `/api/v1/`。

| 公共路径 | 内部路径 | 数据源 | 用途 |
| --- | --- | --- | --- |
| `/platform-api/v1/health` | `/api/v1/health` | 站点内容与项目类型 repository | 容器就绪检查 |
| `/platform-api/v1/site-content` | `/api/v1/site-content` | `site_content` repository | 官网内容 |
| `/platform-api/v1/project-types` | `/api/v1/project-types` | `project_types` repository | 公开的启用项目类型 |

所有 v1 响应使用统一包装：

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "version": "v1",
    "generatedAt": "2026-07-12T00:00:00.000Z"
  }
}
```

失败响应使用 `ok: false` 和稳定的 `error.code` / `error.message` 字段。上述端点不替代旧 API；`/_wcu-api/*` 继续保持原有路径和响应兼容。

## 官网如何读数据

所有公开页面、全局布局、登录与注册页、团队详情、作品、服务、世界观和生产线，都通过服务端 API 客户端读取数据，不再直接引用数据库 repository。

- `PLATFORM_API_INTERNAL_URL` 指向带版本的内部基础地址，部署值为 `http://platform-api:3000/api/v1`。
- `PLATFORM_API_TIMEOUT_MS` 控制官网读取超时，默认 3500ms。
- API 不可用、超时或返回非法数据时，公开官网会回退到 `defaultSiteData`，作品类别会回退到默认启用类型。这保证后端短时故障时官网仍可展示基础内容。
- 管理、登录、项目保存等写操作不会静默回退，仍会显式返回错误，避免误报“已保存”。

## 本地开发

默认的单进程模式仍可用：

- 不设置 `PLATFORM_API_INTERNAL_URL` 时，服务端客户端请求 `http://127.0.0.1:$PORT/api/v1`。
- 不设置 `PLATFORM_API_PROXY_TARGET` 时，Next.js 会把 `/_wcu-api/*` 和 `/platform-api/v1/*` 重写到同一进程内的 `/api/*`。

需要在本地演练双进程时，可把独立 API 进程启动在另一端口，然后设置：

```dotenv
PLATFORM_API_INTERNAL_URL=http://127.0.0.1:3001/api/v1
PLATFORM_API_PROXY_TARGET=http://127.0.0.1:3001
```

`PLATFORM_API_PROXY_TARGET` 是 API 进程的 origin，不包含 `/api`。

## 过渡项与限制

1. `web` 与 `platform-api` 仍来自同一份 Next.js 代码和同一镜像。运行时已分离，构建单元尚未分离。
2. 旧 `src/app/api/*` 仍在同一源码树中。Nginx 已把业务 API 只转给 `platform-api`，同时数据库运行时守卫会阻止 `web` 访问 MySQL。
3. 上传、Skill 工作区和 OIDC 密钥所在的持久化目录现在由 `platform-api` 挂载，不再由 `web` 挂载。
4. 本阶段未改变前端响应样式、页面 URL、旧 API URL 或数据表结构。

## 最终目标

后续按业务边界把同一代码库收敛为：

```text
apps/
  site/       # 公开官网与登录后用户界面
  admin/      # 管理后台界面
  api/        # 认证、OIDC、管理、项目、Skill 与公共 API
packages/
  contracts/  # API schema 与前后端共享类型
  ui/         # 灵穹原有视觉系统
```

拆分顺序建议为：先抽离 API contracts，再搬迁无状态公共读接口，然后搬迁认证与管理写接口，最后独立 `admin` 构建与发布周期。
