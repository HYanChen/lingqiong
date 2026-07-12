import { NextResponse } from "next/server";

import { requirePlatformUser } from "@/lib/auth-guards";
import {
  beginModelBillingAudit,
  completeModelBillingAudit,
  LingqiongAccountError,
  requireLingqiongModelAccess
} from "@/lib/lingqiong-account";
import {
  listModelApiConfigs,
  logModelApiCall,
  modelApiCompletionEndpoint,
  ModelApiUsageLimitError,
  ModelApiValidationError,
  releaseModelApiUsage,
  reserveModelApiUsage
} from "@/lib/model-apis";
import { sessionCanAccessOwner, sessionHasAdminPermission } from "@/lib/platform-auth";
import { getProject } from "@/lib/projects";

type GenerateBody = {
  node?: {
    model?: string;
    prompt?: string;
    ratio?: string;
    strength?: number;
    title?: string;
    type?: string;
  };
  project?: {
    goal?: string;
    id?: string;
    name?: string;
    source?: string;
    style?: string;
    type?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contentToText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (isRecord(item) && typeof item.text === "string") {
          return item.text;
        }

        if (isRecord(item) && typeof item.content === "string") {
          return item.content;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractModelText(result: unknown) {
  if (!isRecord(result)) {
    return "";
  }

  const choices = Array.isArray(result.choices) ? result.choices : [];
  const firstChoice = choices[0];

  if (isRecord(firstChoice)) {
    const message = firstChoice.message;

    if (isRecord(message)) {
      const content = contentToText(message.content);

      if (content) {
        return content;
      }

      const reasoning = contentToText(message.reasoning_content);

      if (reasoning) {
        return reasoning;
      }
    }

    const choiceText = contentToText(firstChoice.text);

    if (choiceText) {
      return choiceText;
    }
  }

  const outputText = contentToText(result.output_text);

  if (outputText) {
    return outputText;
  }

  const output = Array.isArray(result.output) ? result.output : [];

  return output
    .map((item) => (isRecord(item) ? contentToText(item.content) : ""))
    .filter(Boolean)
    .join("\n");
}

function composeUserPrompt(body: GenerateBody) {
  const node = body.node ?? {};
  const project = body.project ?? {};

  return [
    `项目名称：${project.name ?? "未命名项目"}`,
    `项目类型：${project.type ?? "AI影视项目"}`,
    `制作目标：${project.goal ?? "生成可用的影视开发素材"}`,
    `素材来源：${project.source ?? "未填写"}`,
    `视觉风格：${project.style ?? "电影感、真实质感"}`,
    `节点名称：${node.title ?? "未命名节点"}`,
    `节点类型：${node.type ?? "生成节点"}`,
    `节点模型标签：${node.model ?? "未指定"}`,
    `画幅/格式：${node.ratio ?? "未指定"}`,
    `创意强度：${node.strength ?? 70}`,
    "",
    "用户提示词：",
    node.prompt ?? "请根据当前项目生成一版可继续编辑的内容。",
    "",
    "输出要求：",
    "1. 用中文输出。",
    "2. 结构化呈现，便于复制到影视生产线。",
    "3. 不伪造真实客户、播放数据、备案号或现实授权。",
    "4. 如果是画面或视频节点，请包含画面主体、构图、镜头、光影、动作和负面约束。"
  ].join("\n");
}

export const runtime = "nodejs";

function modelErrorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message }, message, ok: false }, { status });
}

function accountErrorResponse(error: LingqiongAccountError) {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        rechargeUrl: error.rechargeUrl
      },
      message: error.message,
      ok: false,
      rechargeUrl: error.rechargeUrl
    },
    { status: error.status }
  );
}

function isBalanceError(message: string) {
  return /quota|insufficient|余额不足|额度不足|exceeded/iu.test(message);
}

export async function POST(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response || !session) {
    return response;
  }

  if (
    session.source === "admin" &&
    !sessionHasAdminPermission(session, "projects.write")
  ) {
    return modelErrorResponse("MODEL_ACCESS_FORBIDDEN", "无权调用项目模型。", 403);
  }

  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > 128 * 1024) {
    return modelErrorResponse("MODEL_INPUT_TOO_LARGE", "模型请求不能超过 128KB。", 413);
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody) as GenerateBody;
    } catch {
      return null;
    }
  })();
  const optionalStrings = [
    body?.node?.model,
    body?.node?.ratio,
    body?.node?.title,
    body?.node?.type,
    body?.project?.goal,
    body?.project?.id,
    body?.project?.name,
    body?.project?.source,
    body?.project?.style,
    body?.project?.type
  ];

  if (
    typeof body?.node?.prompt !== "string" ||
    !body.node.prompt.trim() ||
    body.node.prompt.length > 30_000 ||
    optionalStrings.some(
      (value) => value !== undefined && typeof value !== "string"
    ) ||
    optionalStrings.some((value) => (value?.length ?? 0) > 30_000) ||
    (body.node.strength !== undefined &&
      (typeof body.node.strength !== "number" ||
        !Number.isFinite(body.node.strength)))
  ) {
    return modelErrorResponse("INVALID_MODEL_INPUT", "模型请求内容格式不正确。", 400);
  }

  let storedProject: Awaited<ReturnType<typeof getProject>> = null;
  const requestedProjectId = body.project?.id?.trim();

  if (requestedProjectId) {
    if (requestedProjectId.length > 191) {
      return modelErrorResponse("INVALID_PROJECT_ID", "项目 ID 格式不正确。", 400);
    }

    storedProject = await getProject(requestedProjectId);

    if (!storedProject) {
      return modelErrorResponse("PROJECT_NOT_FOUND", "项目不存在。", 404);
    }

    if (
      !sessionCanAccessOwner(
        session,
        storedProject.ownerId,
        storedProject.ownerAccount,
        "write"
      )
    ) {
      return modelErrorResponse("PROJECT_FORBIDDEN", "无权在该项目中调用模型。", 403);
    }
  }

  const actor = {
    account: session.account,
    id: session.id,
    role: session.adminRole ?? session.role
  };
  const projectForLog = {
    id: storedProject?.id,
    name: storedProject?.name ?? body.project?.name?.trim()
  };

  const requestedModel = body.node.model?.trim() || "";
  let enabledConfigs;

  try {
    enabledConfigs = (await listModelApiConfigs()).filter(
      (item) => item.enabled && item.provider === "new-api"
    );
  } catch {
    return modelErrorResponse(
      "MODEL_CONFIG_UNAVAILABLE",
      "模型配置服务暂时不可用。",
      503
    );
  }

  const config =
    enabledConfigs.find((item) => requestedModel && item.model === requestedModel) ??
    enabledConfigs[0] ??
    null;

  if (!config) {
    return modelErrorResponse(
      "MODEL_CONFIG_MISSING",
      "没有可用的提示词模型，请联系平台运营人员完成模型配置。",
      400
    );
  }

  const prompt = composeUserPrompt(body);
  const selectedModel = requestedModel || config.model;
  const recordCall = async (input: {
    error?: string;
    responseText?: string;
    status: "error" | "success";
  }) => {
    try {
      await logModelApiCall({
        actor,
        configId: config.id,
        error: input.error,
        nodeTitle: body.node?.title,
        project: projectForLog,
        prompt,
        responseText: input.responseText,
        status: input.status
      });
    } catch (error) {
      console.error("Failed to persist model call audit log", error);
    }
  };

  let endpoint: string;

  try {
    endpoint = await modelApiCompletionEndpoint(config);
  } catch (error) {
    const message =
      error instanceof ModelApiValidationError
        ? error.message
        : "模型服务地址校验失败。";
    await recordCall({ error: message, status: "error" });
    return modelErrorResponse(
      error instanceof ModelApiValidationError
        ? error.code
        : "MODEL_ENDPOINT_INVALID",
      message,
      400
    );
  }

  let access;

  try {
    access = await requireLingqiongModelAccess(session);
  } catch (error) {
    if (error instanceof LingqiongAccountError) {
      return accountErrorResponse(error);
    }

    return modelErrorResponse(
      "API_ACCOUNT_SERVICE_UNAVAILABLE",
      "灵穹 API 账户服务暂时不可用，请稍后重试。",
      503
    );
  }

  let billingAudit;

  try {
    billingAudit = await beginModelBillingAudit({
      access,
      capability: "models.generate",
      model: selectedModel,
      projectId: storedProject?.id
    });
  } catch (error) {
    console.error("Failed to begin model billing audit", error);
    return modelErrorResponse(
      "MODEL_BILLING_AUDIT_UNAVAILABLE",
      "模型计费审计服务暂时不可用，请稍后重试。",
      503
    );
  }

  let reservation;

  try {
    reservation = await reserveModelApiUsage(config.id, actor);
  } catch (error) {
    await completeModelBillingAudit(billingAudit.id, {
      errorCode:
        error instanceof ModelApiUsageLimitError
          ? error.code
          : "MODEL_USAGE_GUARD_UNAVAILABLE",
      newApiUserId: access.account.id,
      status: "failed"
    }).catch((auditError) => {
      console.error("Failed to complete model billing audit", auditError);
    });

    if (error instanceof ModelApiUsageLimitError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            retryAfterSeconds: error.retryAfterSeconds
          },
          message: error.message,
          ok: false
        },
        {
          headers: { "Retry-After": String(error.retryAfterSeconds) },
          status: 429
        }
      );
    }

    return modelErrorResponse(
      error instanceof ModelApiValidationError
        ? error.code
        : "MODEL_USAGE_GUARD_UNAVAILABLE",
      error instanceof ModelApiValidationError
        ? error.message
        : "模型用量保护服务暂时不可用。",
      error instanceof ModelApiValidationError ? 400 : 503
    );
  }

  let billingStatus: "failed" | "succeeded" = "failed";
  let billingErrorCode: string | undefined = "MODEL_REQUEST_FAILED";

  try {
    const upstreamResponse = await fetch(endpoint, {
      body: JSON.stringify({
        max_tokens: config.maxTokens,
        messages: [
          { content: config.systemPrompt, role: "system" },
          { content: prompt, role: "user" }
        ],
        model: selectedModel,
        temperature: config.temperature
      }),
      headers: {
        Authorization: `Bearer ${access.apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(60_000)
    });
    const responseLength = Number(upstreamResponse.headers.get("content-length") ?? 0);

    if (Number.isFinite(responseLength) && responseLength > 4 * 1024 * 1024) {
      throw new Error("模型响应超过 4MB 安全上限。");
    }

    const result = await upstreamResponse.json().catch(() => null);

    if (!upstreamResponse.ok) {
      const message =
        typeof result?.error?.message === "string"
          ? result.error.message.slice(0, 1000)
          : `模型接口请求失败：${upstreamResponse.status}`;

      await recordCall({ error: message, status: "error" });
      billingErrorCode = isBalanceError(message)
        ? "API_BALANCE_REQUIRED"
        : "MODEL_UPSTREAM_ERROR";

      if (isBalanceError(message)) {
        return accountErrorResponse(
          new LingqiongAccountError(
            "API_BALANCE_REQUIRED",
            "灵穹 API 账户余额不足，请充值后再继续使用模型功能。",
            402
          )
        );
      }

      return modelErrorResponse("MODEL_UPSTREAM_ERROR", message, 502);
    }

    const text = extractModelText(result);

    if (!text) {
      const message = "模型返回为空，请检查模型配置。";
      await recordCall({ error: message, status: "error" });
      billingErrorCode = "MODEL_EMPTY_RESPONSE";
      return modelErrorResponse("MODEL_EMPTY_RESPONSE", message, 502);
    }

    billingStatus = "succeeded";
    billingErrorCode = undefined;
    await recordCall({ responseText: text, status: "success" });

    return NextResponse.json({
      config: {
        id: config.id,
        model: selectedModel,
        name: config.name,
        provider: config.provider
      },
      limits: reservation.limits,
      ok: true,
      text
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : "模型接口请求失败。";

    await recordCall({ error: message, status: "error" });
    return modelErrorResponse("MODEL_REQUEST_FAILED", message, 502);
  } finally {
    await releaseModelApiUsage(reservation.id).catch((error) => {
      console.error("Failed to release model concurrency lease", error);
    });
    await completeModelBillingAudit(billingAudit.id, {
      errorCode: billingErrorCode,
      newApiUserId: access.account.id,
      status: billingStatus
    }).catch((error) => {
      console.error("Failed to complete model billing audit", error);
    });
  }
}
