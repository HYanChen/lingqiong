import { NextResponse } from "next/server";

import { forbiddenResponse, requirePlatformUser } from "@/lib/auth-guards";
import {
  ProductionPipelineError,
  type ElementKind,
  type GenerationJobStatus,
  type GenerationResourceType,
  type GenerationTaskType
} from "@/lib/production-pipeline";
import { sessionCanAccessOwner } from "@/lib/platform-auth";
import { getProject } from "@/lib/projects";

const DEFAULT_BODY_LIMIT = 2 * 1024 * 1024;

export function productionErrorResponse(
  code: string,
  message: string,
  status: number,
  options: {
    details?: Record<string, unknown>;
    extra?: Record<string, unknown>;
  } = {}
) {
  return NextResponse.json(
    {
      error: {
        code,
        ...(options.details ? { details: options.details } : {}),
        message
      },
      message,
      ok: false,
      ...options.extra
    },
    { status }
  );
}

export function handleProductionError(error: unknown) {
  if (error instanceof ProductionPipelineError) {
    return productionErrorResponse(error.code, error.message, error.status, {
      details: error.details
    });
  }

  const databaseCode = (error as { code?: string }).code;

  if (databaseCode === "ER_DUP_ENTRY") {
    return productionErrorResponse(
      "RESOURCE_CONFLICT",
      "资源与现有数据冲突。",
      409
    );
  }

  if (databaseCode === "ER_DATA_TOO_LONG") {
    return productionErrorResponse(
      "INPUT_TOO_LARGE",
      "提交内容超过存储限制。",
      413
    );
  }

  if (databaseCode === "ER_NO_REFERENCED_ROW_2") {
    return productionErrorResponse(
      "INVALID_REFERENCE",
      "引用的资源不存在或不属于当前项目。",
      400
    );
  }

  console.error("Production pipeline request failed", error);
  return productionErrorResponse(
    "PIPELINE_INTERNAL_ERROR",
    "生产数据服务暂时不可用，请稍后重试。",
    500
  );
}

export async function readProductionJson(
  request: Request,
  maxBytes = DEFAULT_BODY_LIMIT
): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ProductionPipelineError(
      "INPUT_TOO_LARGE",
      `请求内容不能超过 ${Math.ceil(maxBytes / 1024)}KB。`,
      413
    );
  }

  const text = await request.text();

  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new ProductionPipelineError(
      "INPUT_TOO_LARGE",
      `请求内容不能超过 ${Math.ceil(maxBytes / 1024)}KB。`,
      413
    );
  }

  let body: unknown;

  try {
    body = JSON.parse(text);
  } catch {
    throw new ProductionPipelineError(
      "INVALID_JSON",
      "请求内容不是有效的 JSON。",
      400
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ProductionPipelineError(
      "INVALID_INPUT",
      "请求内容必须是 JSON 对象。",
      400
    );
  }

  return body as Record<string, unknown>;
}

export async function requireProductionProject(
  projectId: string,
  capability: "read" | "write" = "read"
) {
  const auth = await requirePlatformUser();

  if (auth.response) {
    return {
      response: productionErrorResponse(
        "AUTH_REQUIRED",
        "请先登录后再访问。",
        401
      )
    } as const;
  }

  if (!projectId || projectId.length > 191) {
    return {
      response: productionErrorResponse(
        "INVALID_PROJECT_ID",
        "项目 ID 格式不正确。",
        400
      )
    } as const;
  }

  const project = await getProject(projectId);

  if (!project) {
    return {
      response: productionErrorResponse(
        "PROJECT_NOT_FOUND",
        "项目不存在。",
        404
      )
    } as const;
  }

  if (
    !sessionCanAccessOwner(
      auth.session,
      project.ownerId,
      project.ownerAccount,
      capability
    )
  ) {
    const response = forbiddenResponse("无权访问该项目。");

    return {
      response: productionErrorResponse(
        "PROJECT_FORBIDDEN",
        "无权访问该项目。",
        response.status
      )
    } as const;
  }

  return { project, session: auth.session } as const;
}

function optionalQueryValue(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value || undefined;
}

export function productionListQuery(request: Request) {
  const url = new URL(request.url);
  const rawLimit = optionalQueryValue(url, "limit");

  if (rawLimit && !/^\d+$/.test(rawLimit)) {
    throw new ProductionPipelineError(
      "INVALID_QUERY",
      "limit 必须是正整数。",
      400
    );
  }

  return {
    episodeId: optionalQueryValue(url, "episodeId"),
    kind: optionalQueryValue(url, "kind") as ElementKind | undefined,
    limit: rawLimit ? Number(rawLimit) : undefined,
    resourceType: optionalQueryValue(url, "resourceType") as
      | GenerationResourceType
      | undefined,
    status: optionalQueryValue(url, "status") as GenerationJobStatus | undefined,
    taskType: optionalQueryValue(url, "taskType") as GenerationTaskType | undefined
  };
}
