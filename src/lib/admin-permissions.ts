export type AdminPermission =
  | "audit.read"
  | "content.read"
  | "content.write"
  | "database.read"
  | "modelApi.read"
  | "modelApi.write"
  | "projects.read"
  | "projects.write"
  | "settings.read"
  | "settings.write"
  | "skills.read"
  | "skills.write"
  | "system.read"
  | "users.read"
  | "users.write";

export type AdminRole = "admin" | "editor" | "operator" | "owner" | "viewer";

export type AdminPermissionGroup = {
  items: Array<{
    description: string;
    key: AdminPermission;
    label: string;
  }>;
  title: string;
};

export type AdminRoleOption = {
  description: string;
  label: string;
  permissions: AdminPermission[];
  value: AdminRole;
};

export const adminPermissionGroups: AdminPermissionGroup[] = [
  {
    title: "安全审计",
    items: [
      {
        description: "查看管理员登录、配置修改和账号变更记录。",
        key: "audit.read",
        label: "查看审计日志"
      }
    ]
  },
  {
    title: "官网内容",
    items: [
      {
        description: "查看后台内容配置和作品、服务、世界观资料。",
        key: "content.read",
        label: "查看官网内容"
      },
      {
        description: "保存品牌、作品、服务、世界观和生产线内容。",
        key: "content.write",
        label: "编辑官网内容"
      }
    ]
  },
  {
    title: "项目与能力",
    items: [
      {
        description: "查看项目类型和创作项目的运营配置。",
        key: "projects.read",
        label: "查看项目配置"
      },
      {
        description: "新增、修改、排序或停用项目类型。",
        key: "projects.write",
        label: "管理项目配置"
      },
      {
        description: "查看 Skill 工具、模块和运行记录。",
        key: "skills.read",
        label: "查看 Skill"
      },
      {
        description: "新增、修改或删除 Skill 工具。",
        key: "skills.write",
        label: "管理 Skill"
      }
    ]
  },
  {
    title: "模型 API",
    items: [
      {
        description: "查看模型 API 配置列表和遮罩后的 Key 状态。",
        key: "modelApi.read",
        label: "查看 API 配置"
      },
      {
        description: "新增、更新、删除模型 API 配置。",
        key: "modelApi.write",
        label: "管理 API 配置"
      }
    ]
  },
  {
    title: "系统与登录",
    items: [
      {
        description: "查看脱敏后的 MySQL、注册用户、项目和调用统计；仅所有者或管理员生效。",
        key: "database.read",
        label: "查看数据库"
      },
      {
        description: "查看微信与第三方登录配置的脱敏状态。",
        key: "settings.read",
        label: "查看登录设置"
      },
      {
        description: "修改微信与第三方登录设置。",
        key: "settings.write",
        label: "管理登录设置"
      },
      {
        description: "查看内部服务与系统健康状态。",
        key: "system.read",
        label: "查看系统状态"
      }
    ]
  },
  {
    title: "管理员与权限",
    items: [
      {
        description: "查看后台管理员账号和角色。",
        key: "users.read",
        label: "查看管理员"
      },
      {
        description: "创建、修改、停用或删除后台管理员账号。",
        key: "users.write",
        label: "管理管理员"
      }
    ]
  }
];

export const allAdminPermissions = adminPermissionGroups.flatMap((group) =>
  group.items.map((item) => item.key)
);

export const adminRoleOptions: AdminRoleOption[] = [
  {
    description: "完整控制后台、API、数据库和管理员权限。",
    label: "所有者",
    permissions: allAdminPermissions,
    value: "owner"
  },
  {
    description: "可管理内容、模型 API 和查看运营数据，不管理管理员。",
    label: "管理员",
    permissions: [
      "audit.read",
      "content.read",
      "content.write",
      "projects.read",
      "projects.write",
      "skills.read",
      "skills.write",
      "modelApi.read",
      "modelApi.write",
      "database.read",
      "settings.read",
      "settings.write",
      "system.read",
      "users.read"
    ],
    value: "admin"
  },
  {
    description: "可编辑官网内容，适合内容运营与制片资料维护。",
    label: "内容编辑",
    permissions: [
      "content.read",
      "content.write",
      "projects.read",
      "projects.write",
      "skills.read",
      "skills.write"
    ],
    value: "editor"
  },
  {
    description: "可维护模型 API 并查看数据，适合技术运营。",
    label: "技术运营",
    permissions: [
      "content.read",
      "projects.read",
      "skills.read",
      "skills.write",
      "modelApi.read",
      "modelApi.write",
      "system.read"
    ],
    value: "operator"
  },
  {
    description: "只读后台，适合演示、审阅和外部合作方查看。",
    label: "只读审阅",
    permissions: [
      "content.read",
      "projects.read",
      "skills.read",
      "modelApi.read",
      "settings.read",
      "system.read"
    ],
    value: "viewer"
  }
];

export function isAdminPermission(value: string): value is AdminPermission {
  return allAdminPermissions.includes(value as AdminPermission);
}

export function isAdminRole(value: string): value is AdminRole {
  return adminRoleOptions.some((role) => role.value === value);
}

export function permissionsForRole(role: AdminRole) {
  return adminRoleOptions.find((item) => item.value === role)?.permissions ?? [];
}

export function canAccess(
  user: { active: boolean; permissions: AdminPermission[]; role: AdminRole } | null,
  permission: AdminPermission
) {
  if (!user?.active) {
    return false;
  }

  return user.role === "owner" || user.permissions.includes(permission);
}
