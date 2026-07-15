SET NAMES utf8mb4;

-- Jeecg 是唯一后台。旧 Next 管理页已经下线，菜单统一改为内容与平台管理语义。
UPDATE sys_permission
SET name = '全站内容与平台管理',
    component_name = 'LingqiongPlatformSettings',
    perms = 'lingqiong:bridge:use',
    update_by = 'admin',
    update_time = NOW()
WHERE id = 'lq000000000000000000000000000013';

UPDATE sys_permission
SET name = '战纪宇宙运营中心',
    update_by = 'admin',
    update_time = NOW()
WHERE id = 'lq000000000000000000000000000001';

-- 修复历史环境中以错误字符集写入的灵穹菜单名称。
UPDATE sys_permission
SET name = CASE id
  WHEN 'lq000000000000000000000000000002' THEN '运营总览'
  WHEN 'lq000000000000000000000000000003' THEN '项目查看'
  WHEN 'lq000000000000000000000000000004' THEN '项目编辑'
  WHEN 'lq000000000000000000000000000005' THEN '用户查看'
  WHEN 'lq000000000000000000000000000006' THEN '用户编辑'
  WHEN 'lq000000000000000000000000000007' THEN '任务查看'
  WHEN 'lq000000000000000000000000000008' THEN '任务操作'
  WHEN 'lq000000000000000000000000000009' THEN '业务服务调用'
  WHEN 'lq000000000000000000000000000010' THEN '官网内容编辑'
  WHEN 'lq000000000000000000000000000011' THEN '全业务数据中心'
  WHEN 'lq000000000000000000000000000012' THEN '业务数据编辑'
  ELSE name
END,
update_by = 'admin',
update_time = NOW()
WHERE id LIKE 'lq0000000000000000000000000000%';
