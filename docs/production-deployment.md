# 灵穹官网生产上线手册

本项目的正式部署使用 `docker-compose.baota.yml`。官网前端、平台 API、模型网关、历史 BookStack 和 MySQL 均为独立运行服务；站内知识空间与多维表格由 `platform-api` 写入业务数据库，只有 `platform-api` 持有灵穹业务数据库凭据，`web` 不连接数据库。

## 1. 上线前准备

1. 复制 `.env.baota.example` 为 `.env.baota`。
2. 为所有密码和密钥填写互不相同的正式值，不要保留示例内容。
3. 把 `WCU_PUBLIC_BASE_URL` 设置为正式 HTTPS 域名；同一值会用于官网、模型网关入口与知识库回调。
4. 把 `WCU_OIDC_REDIRECT_URIS` 设置为两个精确地址：`<正式域名>/bookstack/oidc/callback,<正式域名>/oauth/oidc`，分别承接 BookStack 与灵穹 API。
5. 在宝塔或上游网关为域名启用 HTTPS，并把 HTTP 永久跳转到 HTTPS。
6. 先执行 `pnpm audit:production -- .env.baota`，必须全部通过后再启动正式服务；预检会拒绝缺失、跨域或非 HTTPS 的 OIDC 回调。
7. `NEW_API_ACCOUNT_BRIDGE_SECRET` 必须使用独立长随机值，不得与管理员密码、会话密钥或 OIDC Secret 重复。

宝塔反向代理可直接参考 `infra/nginx/baota-reverse-proxy.conf.example`，上游目标固定为 `127.0.0.1:18080`。

BookStack 的应用密钥可用 `openssl rand -base64 32` 生成，并写为 `base64:<生成值>`。其他密钥建议分别使用至少 32 字节随机值。

## 2. 构建与启动

```bash
docker compose -p lingqiong -f docker-compose.baota.yml --env-file .env.baota config
docker compose -p lingqiong -f docker-compose.baota.yml --env-file .env.baota up -d --build
docker compose -p lingqiong -f docker-compose.baota.yml --env-file .env.baota ps
```

数据库结构由 `platform-api` 启动后的首次访问自动向前迁移，迁移为幂等操作；生产流程的版本化 SQL 同时保存在 `infra/mysql/migrations/`，便于审计与灾备。

首次初始化灵穹 API 后，还需要在其系统设置中启用 OIDC，并填写平台发现地址 `http://platform-api:3000/api/oidc/.well-known/openid-configuration`、与 `.env.baota` 相同的 Client ID/Secret，以及外部站点地址 `WCU_PUBLIC_BASE_URL`。完成后从官网 `/api` 发起一次统一登录验收；未完成该步骤时不要把 API SSO 标记为已上线。

在线充值还需在 `/system-settings` 配置真实支付商户参数、回调地址、充值开关与合规确认。未配置前，用户充值页会安全禁用在线支付，不会使用模拟订单。

## 3. 上线验收

```bash
BASE_URL=https://正式域名 \
SMOKE_ADMIN_USERNAME='正式管理员账号' \
SMOKE_ADMIN_PASSWORD='正式管理员密码' \
pnpm audit:http

BASE_URL=https://正式域名 \
pnpm audit:oidc

PIPELINE_TEST_BASE_URL=https://正式域名 \
pnpm audit:production-flow

BASE_URL=https://正式域名 \
pnpm audit:billing

KNOWLEDGE_TEST_BASE_URL=https://正式域名 \
KNOWLEDGE_TEST_ADMIN_USERNAME='正式管理员账号' \
KNOWLEDGE_TEST_ADMIN_PASSWORD='正式管理员密码' \
pnpm audit:knowledge
```

验收必须覆盖：公开官网、登录保护、用户中心与充值页、后台登录和权限、官网内容回读、普通前台用户首次 OIDC 自动创建独立的灵穹 API 普通账号（`role=1`）、复登复用同一账号、绝不绑定管理员 ID、零余额 `402`、独立用户 Token、真实模型扣费、知识空间/页面树/多维表格、项目 CRUD、素材、剧集、元素、分镜、配音、合成 revision 冲突、生成任务排队和最终测试数据清理。

## 4. 服务降级边界

- `platform-api` 短时不可用时，公开官网回退到版本内置内容，写操作明确失败，不会误报已保存。
- New API 未配置真实上游模型时，生产任务只进入 `queued`，页面明确显示未执行，不伪造生成结果。
- 项目生成任务由灵穹 API 与模型执行器承接，不再依赖本机图形工作流服务。
- 历史 BookStack 故障不会影响站内知识空间、多维表格、官网、项目和平台 API。

## 5. 回滚与备份

上线前备份 `data/mysql`、`data/web`、`data/bookstack` 和 `data/new-api`。应用回滚使用上一版镜像或代码重新构建，不要删除数据库目录；数据库迁移只做向前兼容，不执行自动破坏性回滚。
