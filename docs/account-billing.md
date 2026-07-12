# 用户中心、充值与模型扣费验收

## 用户流程

1. 用户登录官网并进入 `/account`。
2. 未关联灵穹 API 时，点击“立即连接”完成统一登录。
3. 平台根据稳定 OIDC subject 关联唯一 New API 用户。
4. 余额为零时，用户可查看项目和手工编辑，但所有模型生成与生成任务入队都返回 `402`。
5. 用户在 `/account/billing` 完成真实支付或兑换后，余额由 New API 入账。
6. 模型请求使用当前用户的内部 Token，扣费与订单都在同一 New API 账本中可追溯。

## 后台管理入口

- `/admin` 的 API 模块：查看网关状态、模型配置和用户计费说明。
- `/users`：New API 用户、状态和额度。
- `/system-settings`：支付商户、充值开关、币种与合规配置。
- `/redemption-codes`：兑换码管理。
- `/usage-logs`：模型使用与扣费记录。

## 失败关闭规则

- 账户未关联：`API_ACCOUNT_REQUIRED`。
- 账户已停用：`API_ACCOUNT_DISABLED`。
- 余额不足：`API_BALANCE_REQUIRED`。
- 账户或计费审计服务不可用：返回 `503`，不继续调用模型。
- 支付渠道未配置：禁止创建在线支付订单，页面明确提示管理员完成配置。

## 自动验收

`pnpm audit:billing` 使用临时普通前台用户与对应的普通 New API 用户执行以下验证，完成后清理所有测试数据：

- 账户总览可读，支付、合规、兑换码和可用方式的开关状态完整且不泄露凭证。
- 零余额时模型生成与生成任务返回 `402`。
- 补充余额后，平台为该用户创建独立内部 Token。
- 实际模型请求使用该 Token，并产生 New API 扣费和平台计费审计记录。
- 不使用模型配置中的全局 Key 代替用户 Token。

`pnpm audit:new-api-user-isolation` 另外验证首次登录创建普通用户、复登复用同一用户、`role=1`、管理员 ID 不被复用，以及账户映射始终为 `principal_type=creator`。
