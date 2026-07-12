import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { authorizeAdmin, authorizeAdminOwner } from "@/lib/admin-auth";
import {
  adminPermissionGroups,
  adminRoleOptions,
  isAdminPermission,
  isAdminRole,
  type AdminPermission,
  type AdminRole
} from "@/lib/admin-permissions";
import {
  countActiveOwners,
  deleteAdminUser,
  getAdminUserById,
  listAdminUsers,
  upsertAdminUser
} from "@/lib/admin-users";

type AdminUserBody = {
  active?: boolean;
  displayName?: string;
  id?: string;
  password?: string;
  permissions?: string[];
  role?: string;
  username?: string;
};

type ValidatedAdminUserBody = {
  active?: boolean;
  displayName?: string;
  password?: string;
  permissions?: AdminPermission[];
  role?: AdminRole;
  username?: string;
};

const usernamePattern = /^[a-z0-9][a-z0-9._@+-]{2,190}$/;

function authError(
  authorization: Extract<
    Awaited<ReturnType<typeof authorizeAdmin>>,
    { ok: false }
  >
) {
  return NextResponse.json(
    { message: authorization.message },
    { status: authorization.status }
  );
}

function validateBody(
  body: AdminUserBody,
  options: { creating: boolean }
): { data?: ValidatedAdminUserBody; message?: string } {
  const username = body.username?.trim().toLowerCase();
  const displayName = body.displayName?.trim();
  const password = body.password?.trim();

  if (options.creating && !username) {
    return { message: "请填写管理员账号。" };
  }

  if (username !== undefined && !usernamePattern.test(username)) {
    return {
      message: "管理员账号需为 3-191 位小写字母、数字或 . _ @ + -。"
    };
  }

  if (displayName !== undefined && (!displayName || displayName.length > 80)) {
    return { message: "显示名称不能为空且不能超过 80 个字符。" };
  }

  if (options.creating && !password) {
    return { message: "请为新管理员设置初始密码。" };
  }

  if (password !== undefined && (password.length < 8 || password.length > 200)) {
    return { message: "管理员密码长度需为 8-200 个字符。" };
  }

  if (body.role !== undefined && !isAdminRole(body.role)) {
    return { message: "管理员角色不正确。" };
  }

  if (
    body.permissions !== undefined &&
    (!Array.isArray(body.permissions) ||
      body.permissions.length > 100 ||
      !body.permissions.every(
        (permission) =>
          typeof permission === "string" && isAdminPermission(permission)
      ))
  ) {
    return { message: "权限列表不正确。" };
  }

  if (body.active !== undefined && typeof body.active !== "boolean") {
    return { message: "账号状态不正确。" };
  }

  return {
    data: {
      active: body.active,
      displayName,
      password,
      permissions: body.permissions
        ? Array.from(new Set(body.permissions)) as AdminPermission[]
        : undefined,
      role: body.role as AdminRole | undefined,
      username
    }
  };
}

function isDuplicateEntry(error: unknown) {
  return (error as { code?: string })?.code === "ER_DUP_ENTRY";
}

export async function GET() {
  const authorization = await authorizeAdmin("users.read");

  if (!authorization.ok) {
    return authError(authorization);
  }

  return NextResponse.json({
    ok: true,
    permissionGroups: adminPermissionGroups,
    roleOptions: adminRoleOptions,
    users: await listAdminUsers()
  });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdminOwner();

  if (!authorization.ok) {
    return authError(authorization);
  }

  const body = (await request.json().catch(() => null)) as AdminUserBody | null;

  if (!body) {
    return NextResponse.json({ message: "请提交管理员资料。" }, { status: 400 });
  }

  const validated = validateBody(body, { creating: true });

  if (!validated.data) {
    return NextResponse.json({ message: validated.message }, { status: 400 });
  }

  try {
    const user = await upsertAdminUser(validated.data);

    if (!user) {
      throw new Error("管理员创建失败。");
    }

    await recordAdminAuditSafely({
      action: "admin_user.create",
      actor: authorization.user,
      details: {
        active: user.active,
        role: user.role,
        username: user.username
      },
      request,
      targetId: user.id,
      targetType: "admin_user"
    });

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: isDuplicateEntry(error)
          ? "管理员账号已存在。"
          : error instanceof Error
            ? error.message
            : "管理员创建失败。"
      },
      { status: isDuplicateEntry(error) ? 409 : 400 }
    );
  }
}

export async function PUT(request: Request) {
  const authorization = await authorizeAdminOwner();

  if (!authorization.ok) {
    return authError(authorization);
  }

  const body = (await request.json().catch(() => null)) as AdminUserBody | null;

  if (!body?.id) {
    return NextResponse.json({ message: "缺少管理员 ID。" }, { status: 400 });
  }

  const target = await getAdminUserById(body.id, { includeInactive: true });

  if (!target) {
    return NextResponse.json({ message: "管理员不存在。" }, { status: 404 });
  }

  const validated = validateBody(body, { creating: false });

  if (!validated.data) {
    return NextResponse.json({ message: validated.message }, { status: 400 });
  }

  const nextActive = validated.data.active ?? target.active;
  const nextRole = validated.data.role ?? target.role;

  if (target.id === authorization.user.id && !nextActive) {
    return NextResponse.json({ message: "不能停用当前登录的所有者。" }, { status: 400 });
  }

  if (
    target.active &&
    target.role === "owner" &&
    (!nextActive || nextRole !== "owner") &&
    (await countActiveOwners(target.id)) < 1
  ) {
    return NextResponse.json({ message: "必须至少保留一个启用中的所有者。" }, { status: 400 });
  }

  try {
    const user = await upsertAdminUser({ id: target.id, ...validated.data });

    if (!user) {
      throw new Error("管理员更新失败。");
    }

    await recordAdminAuditSafely({
      action: validated.data.password
        ? "admin_user.password_reset"
        : "admin_user.update",
      actor: authorization.user,
      details: {
        active: user.active,
        permissionsChanged: validated.data.permissions !== undefined,
        role: user.role,
        username: user.username
      },
      request,
      targetId: user.id,
      targetType: "admin_user"
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      {
        message: isDuplicateEntry(error)
          ? "管理员账号已存在。"
          : error instanceof Error
            ? error.message
            : "管理员更新失败。"
      },
      { status: isDuplicateEntry(error) ? 409 : 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAdminOwner();

  if (!authorization.ok) {
    return authError(authorization);
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;

  if (!body?.id) {
    return NextResponse.json({ message: "缺少管理员 ID。" }, { status: 400 });
  }

  if (body.id === authorization.user.id) {
    return NextResponse.json({ message: "不能删除当前登录的所有者。" }, { status: 400 });
  }

  const target = await getAdminUserById(body.id, { includeInactive: true });

  if (!target) {
    return NextResponse.json({ message: "管理员不存在。" }, { status: 404 });
  }

  if (
    target.active &&
    target.role === "owner" &&
    (await countActiveOwners(target.id)) < 1
  ) {
    return NextResponse.json({ message: "必须至少保留一个启用中的所有者。" }, { status: 400 });
  }

  let deleted = false;

  try {
    deleted = await deleteAdminUser(target.id);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "管理员删除失败。"
      },
      { status: 400 }
    );
  }

  if (!deleted) {
    return NextResponse.json({ message: "管理员不存在。" }, { status: 404 });
  }

  await recordAdminAuditSafely({
    action: "admin_user.delete",
    actor: authorization.user,
    details: { role: target.role, username: target.username },
    request,
    targetId: target.id,
    targetType: "admin_user"
  });

  return NextResponse.json({ ok: true });
}
