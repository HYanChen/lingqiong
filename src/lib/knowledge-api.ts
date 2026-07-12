import { NextResponse } from "next/server";

import { requirePlatformUser } from "@/lib/auth-guards";
import {
  getKnowledgeSpaceMemberRole,
  knowledgeRoleCan,
  type KnowledgeAccessRole
} from "@/lib/knowledge-collaboration";
import {
  getKnowledgeSpace,
  getKnowledgeTable,
  type KnowledgeActor,
  type KnowledgeSpace,
  type KnowledgeTable
} from "@/lib/knowledge-workspace";
import {
  KNOWLEDGE_BODY_LIMIT,
  KnowledgeValidationError,
  isPlainObject,
  requiredRevision,
  requiredString
} from "@/lib/knowledge-validation";
import {
  sessionHasAdminPermission,
  type PlatformSessionUser
} from "@/lib/platform-auth";

export type KnowledgeCapability = "comment" | "manage" | "read" | "write";

type KnowledgeAccessFailure = { response: NextResponse };
type KnowledgeUserAccess = {
  actor: KnowledgeActor;
  session: PlatformSessionUser;
};
type KnowledgeSpaceAccess = KnowledgeUserAccess & {
  accessRole: KnowledgeAccessRole;
  space: KnowledgeSpace;
};
type KnowledgeTableAccess = KnowledgeSpaceAccess & { table: KnowledgeTable };

export function knowledgeErrorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      error: { code, ...(details ? { details } : {}), message },
      message,
      ok: false
    },
    { status }
  );
}

export function handleKnowledgeError(error: unknown) {
  if (error instanceof KnowledgeValidationError) {
    return knowledgeErrorResponse(error.code, error.message, error.status, error.details);
  }

  const databaseCode = (error as { code?: string }).code;

  if (databaseCode === "ER_DUP_ENTRY") {
    return knowledgeErrorResponse("RESOURCE_CONFLICT", "数据与现有内容冲突。", 409);
  }

  if (databaseCode === "ER_DATA_TOO_LONG") {
    return knowledgeErrorResponse("INPUT_TOO_LARGE", "提交内容超过存储限制。", 413);
  }

  console.error("Knowledge workspace request failed", error);
  return knowledgeErrorResponse(
    "KNOWLEDGE_INTERNAL_ERROR",
    "知识库服务暂时不可用，请稍后重试。",
    500
  );
}

export async function readKnowledgeJson(
  request: Request,
  maxBytes = KNOWLEDGE_BODY_LIMIT
): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new KnowledgeValidationError(
      "INPUT_TOO_LARGE",
      `请求内容不能超过 ${Math.ceil(maxBytes / 1024)}KB。`,
      413
    );
  }

  const text = await request.text();

  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new KnowledgeValidationError(
      "INPUT_TOO_LARGE",
      `请求内容不能超过 ${Math.ceil(maxBytes / 1024)}KB。`,
      413
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new KnowledgeValidationError("INVALID_JSON", "请求内容不是有效的 JSON。");
  }

  if (!isPlainObject(body)) {
    throw new KnowledgeValidationError("INVALID_INPUT", "请求内容必须是 JSON 对象。");
  }

  return body;
}

export async function requireKnowledgeUser(
  capability: KnowledgeCapability = "read"
): Promise<KnowledgeAccessFailure | KnowledgeUserAccess> {
  const auth = await requirePlatformUser();

  if (auth.response) {
    return {
      response: knowledgeErrorResponse("AUTH_REQUIRED", "请先登录后再访问。", 401)
    } as const;
  }

  if (!auth.session.id) {
    return {
      response: knowledgeErrorResponse(
        "ACCOUNT_ID_REQUIRED",
        "当前账号缺少稳定用户标识，请重新登录。",
        401
      )
    } as const;
  }

  if (
    auth.session.source === "admin" &&
    !sessionHasAdminPermission(
      auth.session,
      capability === "comment" || capability === "write" || capability === "manage"
        ? "projects.write"
        : "projects.read"
    )
  ) {
    return {
      response: knowledgeErrorResponse("KNOWLEDGE_FORBIDDEN", "无权访问知识库。", 403)
    } as const;
  }

  const actor: KnowledgeActor = {
    account: auth.session.account,
    id: auth.session.id
  };
  return { actor, session: auth.session } as const;
}

export async function requireKnowledgeSpace(
  spaceId: string,
  capability: KnowledgeCapability = "read"
): Promise<KnowledgeAccessFailure | KnowledgeSpaceAccess> {
  const auth = await requireKnowledgeUser(capability);

  if ("response" in auth) {
    return auth;
  }

  if (!spaceId || spaceId.length > 191) {
    return {
      response: knowledgeErrorResponse("INVALID_SPACE_ID", "知识空间 ID 格式不正确。", 400)
    } as const;
  }

  const space = await getKnowledgeSpace(spaceId);

  if (!space) {
    return {
      response: knowledgeErrorResponse("SPACE_NOT_FOUND", "知识空间不存在。", 404)
    } as const;
  }

  const accessRole: KnowledgeAccessRole | null =
    auth.session.source === "admin"
      ? "admin"
      : space.ownerId === auth.actor.id
        ? "owner"
        : await getKnowledgeSpaceMemberRole(spaceId, auth.actor.id);

  if (!accessRole || !knowledgeRoleCan(accessRole, capability)) {
    return {
      response: knowledgeErrorResponse("SPACE_FORBIDDEN", "无权访问该知识空间。", 403)
    } as const;
  }

  return { accessRole, actor: auth.actor, session: auth.session, space };
}

export async function requireKnowledgeTable(
  spaceId: string,
  tableId: string,
  capability: KnowledgeCapability = "read"
): Promise<KnowledgeAccessFailure | KnowledgeTableAccess> {
  const access = await requireKnowledgeSpace(spaceId, capability);

  if ("response" in access) {
    return access;
  }

  if (!tableId || tableId.length > 191) {
    return {
      response: knowledgeErrorResponse("INVALID_TABLE_ID", "多维表格 ID 格式不正确。", 400)
    } as const;
  }

  const table = await getKnowledgeTable(spaceId, tableId);

  if (!table) {
    return {
      response: knowledgeErrorResponse("TABLE_NOT_FOUND", "多维表格不存在。", 404)
    } as const;
  }

  return {
    accessRole: access.accessRole,
    actor: access.actor,
    session: access.session,
    space: access.space,
    table
  };
}

export function deleteRevision(request: Request) {
  const raw = new URL(request.url).searchParams.get("revision");
  return requiredRevision(raw && /^\d+$/.test(raw) ? Number(raw) : undefined);
}

export function optionalIdQuery(request: Request, name: string) {
  const value = new URL(request.url).searchParams.get(name);
  return value ? requiredString(value, name, 191) : undefined;
}

export function listLimit(request: Request, fallback = 500) {
  const raw = new URL(request.url).searchParams.get("limit");

  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new KnowledgeValidationError("INVALID_QUERY", "limit 必须是正整数。");
  }

  return Math.max(1, Math.min(500, Number(raw)));
}

export function listOffset(request: Request) {
  const raw = new URL(request.url).searchParams.get("offset");
  if (!raw) return 0;
  if (!/^\d+$/.test(raw)) {
    throw new KnowledgeValidationError("INVALID_QUERY", "offset 必须是非负整数。");
  }
  return Math.max(0, Math.min(1_000_000, Number(raw)));
}
