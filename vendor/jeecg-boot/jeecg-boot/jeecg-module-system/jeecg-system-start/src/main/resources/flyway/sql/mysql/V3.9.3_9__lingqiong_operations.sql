SET NAMES utf8mb4;

INSERT IGNORE INTO sys_permission
(id, parent_id, name, url, component, is_route, component_name, menu_type, perms, perms_type, sort_no, always_show, icon, is_leaf, keep_alive, hidden, hide_tab, create_by, create_time, del_flag, rule_flag, status, internal_or_external)
VALUES
('lq000000000000000000000000000001', NULL, '战纪宇宙运营中心', '/lingqiong', 'layouts/RouteView', 1, 'LingqiongRoot', 0, NULL, '1', 0.1, 1, 'ant-design:control-outlined', 0, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0),
('lq000000000000000000000000000002', 'lq000000000000000000000000000001', '运营总览', '/lingqiong/operations', 'lingqiong/operations/index', 1, 'LingqiongOperations', 1, 'lingqiong:dashboard:view', '1', 1, 0, 'ant-design:dashboard-outlined', 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0),
('lq000000000000000000000000000003', 'lq000000000000000000000000000002', '项目查看', NULL, NULL, 0, NULL, 2, 'lingqiong:projects:list', '1', 1, 0, NULL, 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0),
('lq000000000000000000000000000004', 'lq000000000000000000000000000002', '项目编辑', NULL, NULL, 0, NULL, 2, 'lingqiong:projects:edit', '1', 2, 0, NULL, 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0),
('lq000000000000000000000000000005', 'lq000000000000000000000000000002', '用户查看', NULL, NULL, 0, NULL, 2, 'lingqiong:users:list', '1', 3, 0, NULL, 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0),
('lq000000000000000000000000000006', 'lq000000000000000000000000000002', '用户编辑', NULL, NULL, 0, NULL, 2, 'lingqiong:users:edit', '1', 4, 0, NULL, 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0),
('lq000000000000000000000000000007', 'lq000000000000000000000000000002', '任务查看', NULL, NULL, 0, NULL, 2, 'lingqiong:jobs:list', '1', 5, 0, NULL, 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0),
('lq000000000000000000000000000008', 'lq000000000000000000000000000002', '任务操作', NULL, NULL, 0, NULL, 2, 'lingqiong:jobs:operate', '1', 6, 0, NULL, 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0);

INSERT IGNORE INTO sys_permission
(id, parent_id, name, is_route, menu_type, perms, perms_type, sort_no, always_show, is_leaf, keep_alive, hidden, hide_tab, create_by, create_time, del_flag, rule_flag, status, internal_or_external)
VALUES
('lq000000000000000000000000000009', 'lq000000000000000000000000000002', '业务服务调用', 0, 2, 'lingqiong:bridge:use', '1', 7, 0, 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0),
('lq000000000000000000000000000010', 'lq000000000000000000000000000002', '官网内容编辑', 0, 2, 'lingqiong:content:edit', '1', 8, 0, 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0);

INSERT IGNORE INTO sys_permission
(id, parent_id, name, url, component, is_route, component_name, menu_type, perms, perms_type, sort_no, always_show, icon, is_leaf, keep_alive, hidden, hide_tab, create_by, create_time, del_flag, rule_flag, status, internal_or_external)
VALUES
('lq000000000000000000000000000011', 'lq000000000000000000000000000001', '全业务数据中心', '/lingqiong/data', 'lingqiong/data/index', 1, 'LingqiongDataCenter', 1, 'lingqiong:data:view', '1', 2, 0, 'ant-design:database-outlined', 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0),
('lq000000000000000000000000000012', 'lq000000000000000000000000000011', '业务数据编辑', NULL, NULL, 0, NULL, 2, 'lingqiong:data:edit', '1', 1, 0, NULL, 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0);

INSERT IGNORE INTO sys_permission
(id, parent_id, name, url, component, is_route, component_name, menu_type, perms, perms_type, sort_no, always_show, icon, is_leaf, keep_alive, hidden, hide_tab, create_by, create_time, del_flag, rule_flag, status, internal_or_external)
VALUES
('lq000000000000000000000000000013', 'lq000000000000000000000000000001', '官网与平台配置', '/lingqiong/platform', 'lingqiong/platform/index', 1, 'LingqiongPlatformSettings', 1, 'lingqiong:bridge:use', '1', 3, 0, 'ant-design:setting-outlined', 1, 0, 0, 0, 'admin', NOW(), 0, 0, '1', 0);

INSERT IGNORE INTO sys_role_permission (id, role_id, permission_id, operate_date)
SELECT MD5(CONCAT(role.id, permission.id)), role.id, permission.id, NOW()
FROM sys_role role
JOIN sys_permission permission ON permission.id LIKE 'lq0000000000000000000000000000%'
WHERE role.role_code = 'admin';

-- 旧环境曾使用非 UTF-8 客户端导入，INSERT IGNORE 无法修复已存在记录；每次部署主动纠正菜单文字。
UPDATE sys_permission
SET name = CASE id
  WHEN 'lq000000000000000000000000000001' THEN '战纪宇宙运营中心'
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
  WHEN 'lq000000000000000000000000000013' THEN '官网与平台配置'
  ELSE name
END,
sort_no = CASE WHEN id = 'lq000000000000000000000000000001' THEN 0.1 ELSE sort_no END
WHERE id LIKE 'lq0000000000000000000000000000%';

-- home_path 是 SysUser 的非持久化字段。Jeecg 的登录首页由 sys_role_index 管理。
UPDATE sys_role_index
SET url = '/lingqiong/operations',
    component = 'lingqiong/operations/index',
    is_route = 1,
    status = '1',
    relation_type = 'DEFAULT',
    update_by = 'admin',
    update_time = NOW()
WHERE role_code = 'DEF_INDEX_ALL';
