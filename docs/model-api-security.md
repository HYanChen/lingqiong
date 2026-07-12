# 模型 API 安全与用量治理

## 调用保护

`platform-api` 在把请求转发给模型服务前，会以“平台用户 + 模型配置”为维度持久化计数并创建并发租约。默认值：

- 每分钟 12 次；`MODEL_API_RPM_LIMIT`
- 同时 2 个请求；`MODEL_API_CONCURRENCY_LIMIT`
- 每日 100 次；`MODEL_API_DAILY_LIMIT`

计数保存在 `model_api_usage_buckets`，并发租约保存在
`model_api_concurrency_leases`。租约 90 秒自动失效，因此进程异常退出不会永久占用并发名额。用量保护数据库不可用时请求会失败关闭，不会绕过保护直接消耗上游 Key。

## 服务地址与用户凭证

- 外部 OpenAI-compatible 服务只允许可解析到公网地址的 HTTPS URL。
- 拒绝 localhost、私网、链路本地、保留地址、云元数据地址和内部域名。
- 站内 New API 仅允许明确的 `http://new-api:3000` 容器地址，或安全的公网 HTTPS 地址。
- 灵穹 API 会为每个已关联用户创建独立内部 Token，模型请求按该用户额度扣费。
- 用户 Token 只在服务端读取，不会返回浏览器、写入审计日志或与其他用户共享。
- 平台每次调用前都直接校验用户状态与余额；内部 Token 只在服务端内存中短时缓存，避免高频创作时反复调用凭证管理接口。
- 上游请求禁用 HTTP 重定向，避免凭证被重定向到其他主机。
- 外部 OpenAI-compatible 配置的 Base URL 信任边界发生变化时，不会继承旧 Key；站内灵穹 API 不使用全站共享 Key。

## 余额门禁与计费审计

每次模型请求先验证账户关联、账户状态和当前余额。验证不通过时失败关闭，不尝试调用其他 Token。

`model_billing_audits` 记录请求 ID、平台主体、New API 用户与 Token ID、项目/任务、模型、结果、错误码以及扣费前后额度，与 New API 用量记录双向对账。

## 调用日志与保留

调用日志记录配置、操作者、角色、项目、节点、状态和时间。提示词和响应默认分别截断到 12,000 与 24,000 字符，可通过环境变量调低或调高安全上限。

- 查询：`GET /_wcu-api/admin/model-api-calls?days=30&limit=50`
- 按配置查询：追加 `configId=<id>`
- 清理：`DELETE /_wcu-api/admin/model-api-calls`，请求体为
  `{ "retentionDays": 30 }`

日志至少保留 30 天。每次写入会机会式清理超过保留期的旧记录，管理员也可通过上述接口执行显式清理。查询需要 `modelApi.read`，清理需要 `modelApi.write`。
