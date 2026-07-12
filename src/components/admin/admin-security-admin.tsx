"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  XCircle
} from "lucide-react";

import type { AdminPermission, AdminRole } from "@/lib/admin-permissions";

type CurrentAdmin = {
  id: string;
  permissions: AdminPermission[];
  role: AdminRole;
  username: string;
};

type AdminUser = CurrentAdmin & {
  active: boolean;
  createdAt: string;
  displayName: string;
  lastLoginAt: string | null;
  updatedAt: string;
};

type PermissionGroup = {
  items: Array<{
    description: string;
    key: AdminPermission;
    label: string;
  }>;
  title: string;
};

type RoleOption = {
  description: string;
  label: string;
  permissions: AdminPermission[];
  value: AdminRole;
};

type AuditLog = {
  action: string;
  actorUsername: string | null;
  adminUserId: string | null;
  createdAt: string;
  details: Record<string, unknown>;
  id: string;
  ipAddress: string | null;
  success: boolean;
  targetId: string | null;
  targetType: string | null;
  userAgent: string | null;
};

type UserDraft = {
  active: boolean;
  displayName: string;
  password: string;
  permissions: AdminPermission[];
  role: AdminRole;
  username: string;
};

type UsersResponse = {
  message?: string;
  permissionGroups?: PermissionGroup[];
  roleOptions?: RoleOption[];
  users?: AdminUser[];
};

const emptyCreateDraft: UserDraft = {
  active: true,
  displayName: "",
  password: "",
  permissions: [],
  role: "viewer",
  username: ""
};

const actionLabels: Record<string, string> = {
  "admin.login": "管理员登录",
  "admin.logout": "管理员退出",
  "admin_user.create": "创建管理员",
  "admin_user.delete": "删除管理员",
  "admin_user.password_reset": "重置管理员密码",
  "admin_user.update": "更新管理员",
  "content.update": "更新官网内容",
  "login_settings.update": "更新登录设置",
  "model_api.create": "创建模型配置",
  "model_api.delete": "删除模型配置",
  "model_api.update": "更新模型配置",
  "project_type.delete": "删除项目类型",
  "project_type.create": "创建项目类型",
  "project_type.update": "更新项目类型",
  "skill.delete": "删除 Skill",
  "skill.create": "创建 Skill",
  "skill.update": "更新 Skill"
};

function userDraft(user: AdminUser): UserDraft {
  return {
    active: user.active,
    displayName: user.displayName,
    password: "",
    permissions: user.permissions,
    role: user.role,
    username: user.username
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "从未";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date);
}

function fieldClass() {
  return "h-11 w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15";
}

function rolePermissions(role: AdminRole, options: RoleOption[]) {
  return options.find((option) => option.value === role)?.permissions ?? [];
}

function PermissionEditor({
  disabled,
  groups,
  onChange,
  value
}: {
  disabled: boolean;
  groups: PermissionGroup[];
  onChange: (permissions: AdminPermission[]) => void;
  value: AdminPermission[];
}) {
  const selected = useMemo(() => new Set(value), [value]);

  function toggle(permission: AdminPermission) {
    onChange(
      selected.has(permission)
        ? value.filter((item) => item !== permission)
        : [...value, permission]
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {groups.map((group) => (
        <fieldset
          className="rounded-lg border border-white/10 bg-black/20 p-4"
          key={group.title}
        >
          <legend className="px-1 text-xs font-semibold text-cyan-100">
            {group.title}
          </legend>
          <div className="mt-2 space-y-3">
            {group.items.map((item) => (
              <label className="flex items-start gap-3" key={item.key}>
                <input
                  checked={selected.has(item.key)}
                  className="mt-1 h-4 w-4 accent-cyan-200"
                  disabled={disabled}
                  onChange={() => toggle(item.key)}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-medium text-stone-200">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-stone-500">
                    {item.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function AdminSecurityAdmin({
  currentUser,
  mode
}: {
  currentUser: CurrentAdmin;
  mode: "audit" | "users";
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [createDraft, setCreateDraft] = useState<UserDraft>(emptyCreateDraft);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [actorFilter, setActorFilter] = useState("");
  const [successFilter, setSuccessFilter] = useState<"all" | "false" | "true">("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canManageUsers = currentUser.role === "owner";

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/_wcu-api/admin/users", { cache: "no-store" });
      const result = (await response.json().catch(() => null)) as UsersResponse | null;

      if (!response.ok || !result?.users) {
        setError(result?.message ?? "管理员列表读取失败。");
        return;
      }

      setUsers(result.users);
      setPermissionGroups(result.permissionGroups ?? []);
      setRoleOptions(result.roleOptions ?? []);
      setDrafts(Object.fromEntries(result.users.map((user) => [user.id, userDraft(user)])));
      setCreateDraft((current) =>
        current.permissions.length
          ? current
          : {
              ...current,
              permissions: rolePermissions(current.role, result.roleOptions ?? [])
            }
      );
    } catch {
      setError("网络暂时不可用，管理员列表读取失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAudits = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const url = new URL("/_wcu-api/admin/audit", window.location.origin);
      url.searchParams.set("limit", "100");

      if (actorFilter.trim()) {
        url.searchParams.set("actor", actorFilter.trim());
      }

      if (successFilter !== "all") {
        url.searchParams.set("success", successFilter);
      }

      const response = await fetch(url, { cache: "no-store" });
      const result = (await response.json().catch(() => null)) as
        | { logs?: AuditLog[]; message?: string; total?: number }
        | null;

      if (!response.ok || !result?.logs) {
        setError(result?.message ?? "审计日志读取失败。");
        return;
      }

      setLogs(result.logs);
      setAuditTotal(Number(result.total ?? result.logs.length));
    } catch {
      setError("网络暂时不可用，审计日志读取失败。");
    } finally {
      setLoading(false);
    }
  }, [actorFilter, successFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (mode === "users" ? loadUsers() : loadAudits());
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAudits, loadUsers, mode]);

  function updateDraft(id: string, patch: Partial<UserDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch }
    }));
  }

  async function submitUser(
    method: "POST" | "PUT",
    draft: UserDraft,
    id?: string
  ) {
    setBusyId(id ?? "create");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/_wcu-api/admin/users", {
        body: JSON.stringify({
          ...(id ? { id } : {}),
          active: draft.active,
          displayName: draft.displayName,
          ...(draft.password ? { password: draft.password } : {}),
          permissions: draft.permissions,
          role: draft.role,
          username: draft.username
        }),
        headers: { "Content-Type": "application/json" },
        method
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string; user?: AdminUser }
        | null;

      if (!response.ok || !result?.user) {
        setError(result?.message ?? "管理员资料保存失败。");
        return;
      }

      setMessage(id ? `已更新管理员「${result.user.username}」。` : `已创建管理员「${result.user.username}」。`);
      setCreateDraft({
        ...emptyCreateDraft,
        permissions: rolePermissions("viewer", roleOptions)
      });
      await loadUsers();
    } catch {
      setError("网络暂时不可用，本次管理员修改未保存。");
    } finally {
      setBusyId("");
    }
  }

  async function removeUser(user: AdminUser) {
    if (!window.confirm(`确认删除管理员「${user.username}」？此操作不可撤销。`)) {
      return;
    }

    setBusyId(user.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/_wcu-api/admin/users", {
        body: JSON.stringify({ id: user.id }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE"
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(result?.message ?? "管理员删除失败。");
        return;
      }

      setMessage(`已删除管理员「${user.username}」。`);
      await loadUsers();
    } catch {
      setError("网络暂时不可用，管理员删除失败。");
    } finally {
      setBusyId("");
    }
  }

  if (loading && !(mode === "users" ? users.length : logs.length)) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035]">
        <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin text-cyan-100" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {message ? (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
          <XCircle aria-hidden="true" className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      {mode === "users" ? (
        <>
          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                  <h2 className="text-lg font-semibold text-stone-50">管理员与角色权限</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  当前共 {users.length} 个管理员。只有所有者可创建、修改或删除账号。
                </p>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                onClick={() => void loadUsers()}
                type="button"
              >
                <RefreshCcw aria-hidden="true" className="h-4 w-4" />
                刷新
              </button>
            </div>
          </section>

          {canManageUsers ? (
            <section className="rounded-lg border border-cyan-200/20 bg-cyan-200/[0.055] p-5">
              <div className="flex items-center gap-2">
                <UserPlus aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                <h2 className="text-lg font-semibold text-stone-50">新增管理员</h2>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block text-xs text-stone-400">
                  管理员账号
                  <input
                    className={`mt-2 ${fieldClass()}`}
                    onChange={(event) =>
                      setCreateDraft((current) => ({ ...current, username: event.target.value }))
                    }
                    placeholder="例如 producer.admin"
                    value={createDraft.username}
                  />
                </label>
                <label className="block text-xs text-stone-400">
                  显示名称
                  <input
                    className={`mt-2 ${fieldClass()}`}
                    onChange={(event) =>
                      setCreateDraft((current) => ({ ...current, displayName: event.target.value }))
                    }
                    placeholder="例如 制片负责人"
                    value={createDraft.displayName}
                  />
                </label>
                <label className="block text-xs text-stone-400">
                  初始密码
                  <input
                    className={`mt-2 ${fieldClass()}`}
                    onChange={(event) =>
                      setCreateDraft((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="至少 8 位"
                    type="password"
                    value={createDraft.password}
                  />
                </label>
                <label className="block text-xs text-stone-400">
                  角色
                  <select
                    className={`mt-2 ${fieldClass()}`}
                    onChange={(event) => {
                      const role = event.target.value as AdminRole;
                      setCreateDraft((current) => ({
                        ...current,
                        permissions: rolePermissions(role, roleOptions),
                        role
                      }));
                    }}
                    value={createDraft.role}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-5">
                <PermissionEditor
                  disabled={createDraft.role === "owner"}
                  groups={permissionGroups}
                  onChange={(permissions) =>
                    setCreateDraft((current) => ({ ...current, permissions }))
                  }
                  value={createDraft.permissions}
                />
              </div>
              <button
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busyId === "create"}
                onClick={() => void submitUser("POST", createDraft)}
                type="button"
              >
                {busyId === "create" ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus aria-hidden="true" className="h-4 w-4" />
                )}
                创建管理员
              </button>
            </section>
          ) : null}

          <div className="space-y-4">
            {users.map((user) => {
              const draft = drafts[user.id] ?? userDraft(user);
              const isCurrent = user.id === currentUser.id;

              return (
                <article
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-5"
                  key={user.id}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-stone-50">
                          {user.displayName}
                        </h3>
                        <span className="rounded-lg border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-xs text-cyan-50">
                          {roleOptions.find((option) => option.value === user.role)?.label ?? user.role}
                        </span>
                        <span className={`rounded-lg border px-2 py-1 text-xs ${user.active ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
                          {user.active ? "启用" : "停用"}
                        </span>
                        {isCurrent ? (
                          <span className="rounded-lg border border-white/10 px-2 py-1 text-xs text-stone-300">
                            当前账号
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 font-mono text-xs text-stone-400">{user.username}</p>
                      <p className="mt-2 text-xs leading-6 text-stone-500">
                        最近登录：{formatDate(user.lastLoginAt)} · 更新：{formatDate(user.updatedAt)}
                      </p>
                    </div>
                    {canManageUsers ? (
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300/25 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isCurrent || busyId === user.id}
                        onClick={() => void removeUser(user)}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        删除
                      </button>
                    ) : null}
                  </div>

                  {canManageUsers ? (
                    <div className="mt-5 border-t border-white/10 pt-5">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <label className="block text-xs text-stone-400">
                          管理员账号
                          <input
                            className={`mt-2 ${fieldClass()}`}
                            onChange={(event) => updateDraft(user.id, { username: event.target.value })}
                            value={draft.username}
                          />
                        </label>
                        <label className="block text-xs text-stone-400">
                          显示名称
                          <input
                            className={`mt-2 ${fieldClass()}`}
                            onChange={(event) => updateDraft(user.id, { displayName: event.target.value })}
                            value={draft.displayName}
                          />
                        </label>
                        <label className="block text-xs text-stone-400">
                          角色
                          <select
                            className={`mt-2 ${fieldClass()}`}
                            onChange={(event) => {
                              const role = event.target.value as AdminRole;
                              updateDraft(user.id, {
                                permissions: rolePermissions(role, roleOptions),
                                role
                              });
                            }}
                            value={draft.role}
                          >
                            {roleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs text-stone-400">
                          新密码（留空不修改）
                          <input
                            className={`mt-2 ${fieldClass()}`}
                            onChange={(event) => updateDraft(user.id, { password: event.target.value })}
                            placeholder="至少 8 位"
                            type="password"
                            value={draft.password}
                          />
                        </label>
                      </div>
                      <label className="mt-4 inline-flex items-center gap-3 text-sm text-stone-300">
                        <input
                          checked={draft.active}
                          className="h-4 w-4 accent-cyan-200"
                          disabled={isCurrent}
                          onChange={(event) => updateDraft(user.id, { active: event.target.checked })}
                          type="checkbox"
                        />
                        启用此管理员账号
                      </label>
                      <div className="mt-5">
                        <PermissionEditor
                          disabled={draft.role === "owner"}
                          groups={permissionGroups}
                          onChange={(permissions) => updateDraft(user.id, { permissions })}
                          value={draft.permissions}
                        />
                      </div>
                      <button
                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={busyId === user.id}
                        onClick={() => void submitUser("PUT", draft, user.id)}
                        type="button"
                      >
                        {busyId === user.id ? (
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save aria-hidden="true" className="h-4 w-4" />
                        )}
                        保存管理员
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                  <h2 className="text-lg font-semibold text-stone-50">管理员审计日志</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  共匹配 {auditTotal} 条记录，当前显示最近 {logs.length} 条。敏感字段已自动脱敏。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className={fieldClass()}
                  onChange={(event) => setActorFilter(event.target.value)}
                  placeholder="按管理员账号筛选"
                  value={actorFilter}
                />
                <select
                  className={fieldClass()}
                  onChange={(event) => setSuccessFilter(event.target.value as typeof successFilter)}
                  value={successFilter}
                >
                  <option value="all">全部结果</option>
                  <option value="true">成功</option>
                  <option value="false">失败</option>
                </select>
                <button
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                  onClick={() => void loadAudits()}
                  type="button"
                >
                  <RefreshCcw aria-hidden="true" className="h-4 w-4" />
                  筛选
                </button>
              </div>
            </div>
          </section>

          <div className="space-y-3">
            {logs.length ? (
              logs.map((log) => (
                <article
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-5"
                  key={log.id}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-stone-100">
                          {actionLabels[log.action] ?? log.action}
                        </p>
                        <span className={`rounded-lg border px-2 py-1 text-xs ${log.success ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>
                          {log.success ? "成功" : "失败"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-stone-500">
                        操作者：{log.actorUsername || "未识别"} · 目标：{log.targetType || "-"}
                        {log.targetId ? ` / ${log.targetId}` : ""}
                      </p>
                    </div>
                    <div className="text-left text-xs leading-6 text-stone-500 md:text-right">
                      <p>{formatDate(log.createdAt)}</p>
                      <p>{log.ipAddress || "未记录 IP"}</p>
                    </div>
                  </div>
                  {Object.keys(log.details).length ? (
                    <details className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                      <summary className="cursor-pointer text-xs font-medium text-stone-300">
                        查看记录详情
                      </summary>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-stone-500">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6 text-sm text-stone-400">
                当前筛选条件下没有审计记录。
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
