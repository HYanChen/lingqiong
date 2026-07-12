# 灵穹 API 统一账户与模型网关

平台将 New API 作为用户账户、模型额度、充值订单、兑换码和模型扣费的唯一账本。官网业务数据库不再维护第二套余额。

站内模型请求走 `/_wcu-api/models/generate` 或 Skill 服务，由平台在服务端换取当前用户的内部凭证，再调用 `http://new-api:3000/v1`。内部凭证不会返回浏览器，也不会在不同用户间共享。

## 账户关联

- 创作者的 OIDC 主体为 `creator:<front_users.id>`。
- 管理后台身份不参与灵穹 API 用户账户映射；New API 管理员使用独立的后台凭据。
- 进入 `/api` 前会先清除浏览器中遗留的 New API 会话，避免把当前创作者绑定到之前登录的管理员或其他用户。
- New API 首次统一登录自动创建 `role=1` 的普通用户并写入 `users.oidc_id`，后续登录复用同一用户。
- 平台在 `api_account_links` 中保存账户关联与内部 Token ID，不保存可返回前端的 Token 明文。

用户在 `/account` 点击“立即连接”后，经 `/api` 完成统一登录，并回到用户中心。

## 模型访问规则

以下功能在执行前必须同时满足：账户已关联、账户已启用、余额大于零。

- 提示词模型生成。
- Skill 工作台模型执行。
- Skill 聊天中的模型请求。
- 项目内生成任务入队。

余额不足时接口返回 HTTP `402` 和 `API_BALANCE_REQUIRED`，前端引导到 `/account/billing`。账户异常时不会回退到全局 Token 或模拟结果。

`model_billing_audits` 保存主体、New API 用户、内部 Token、项目、模型、执行状态和扣费前后额度，用于整体流程审计。

## 用户中心与充值

- `/account`：账户状态、余额、用量、创作者资料。
- `/account/billing`：充值金额、支付方式、兑换码和订单历史。
- `/keys`：用户自己的 API 凭证。
- `/usage-logs`：用户用量记录。

在 New API `/system-settings` 中完成支付商户与合规配置后，用户才能发起在线支付。未配置时前台会明确显示“支付通道尚未配置”，只保留管理员已真实启用的兑换码方式，不会伪造支付成功。

## 启动与配置

```bash
pnpm preview:80
```

主要入口：

- 官网：`http://localhost/`
- 用户中心：`http://localhost/account`
- 灵穹 API 统一登录入口：`http://localhost/api`
- OpenAI-compatible Base URL：`http://localhost/v1`
- 知识库：`http://localhost/bookstack/`

关键环境变量：

- `NEW_API_MYSQL_DATABASE`：New API 数据库，默认 `new_api`。
- `NEW_API_ACCOUNT_BRIDGE_SECRET`：用于派生账户桥接凭证，必须与其他密钥不同。
- `NEW_API_SERVER_BASE_URL`：平台 API 调用 New API 用户接口的内部地址。
- `NEW_API_INTERNAL_BASE_URL`：模型转发的内部 `/v1` 地址。

正式上线前必须更换所有示例密钥，启用 HTTPS，精确登记 OIDC 回调，并通过生产预检与账户计费审计。

```bash
pnpm audit:production -- .env.baota
pnpm audit:billing
pnpm audit:new-api-user-isolation
```
