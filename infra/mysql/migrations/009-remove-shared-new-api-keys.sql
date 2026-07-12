-- 灵穹 API 调用已改为按 OIDC 主体绑定的用户内部 Token。
-- 清理旧版模型配置中的全站共享 Key，防止回退或误用。
UPDATE model_api_configs
SET api_key = NULL
WHERE provider = 'new-api' AND api_key IS NOT NULL;
