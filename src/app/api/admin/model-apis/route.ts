import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { authorizeAdmin } from "@/lib/admin-auth";
import {
  deleteModelApiConfig,
  listPublicModelApiConfigs,
  ModelApiValidationError,
  upsertModelApiConfig,
  type ModelProvider
} from "@/lib/model-apis";

type ModelApiBody = {
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
  id?: string;
  maxTokens?: number;
  model?: string;
  name?: string;
  provider?: ModelProvider;
  systemPrompt?: string;
  temperature?: number;
};

export async function GET() {
  const authorization = await authorizeAdmin("modelApi.read");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  return NextResponse.json({ configs: await listPublicModelApiConfigs() });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdmin("modelApi.write");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  const body = (await request.json().catch(() => null)) as ModelApiBody | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ message: "请填写配置名称。" }, { status: 400 });
  }

  const provider =
    body.provider === "mock"
      ? "mock"
      : body.provider === "new-api"
        ? "new-api"
        : "openai-compatible";
  const baseUrl =
    body.baseUrl?.trim() ||
    (provider === "mock"
      ? "local://mock"
      : provider === "new-api"
        ? "http://new-api:3000/v1"
        : "");

  if (provider !== "mock" && !baseUrl) {
    return NextResponse.json({ message: "请填写 Base URL。" }, { status: 400 });
  }

  let config;

  try {
    config = await upsertModelApiConfig({
      apiKey: body.apiKey,
      baseUrl,
      enabled: body.enabled ?? true,
      id: body.id,
      maxTokens: body.maxTokens ?? 1200,
      model: body.model?.trim() || "gpt-4o-mini",
      name: body.name,
      provider,
      systemPrompt: body.systemPrompt ?? "",
      temperature: body.temperature ?? 0.7
    });
  } catch (error) {
    if (error instanceof ModelApiValidationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message }, message: error.message },
        { status: 400 }
      );
    }

    throw error;
  }
  await recordAdminAuditSafely({
    action: body.id ? "model_api.update" : "model_api.create",
    actor: authorization.user,
    details: { name: config.name, provider: config.provider },
    request,
    targetId: config.id,
    targetType: "model_api"
  });

  return NextResponse.json({ config, ok: true });
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAdmin("modelApi.write");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;

  if (!body?.id) {
    return NextResponse.json({ message: "缺少配置 ID。" }, { status: 400 });
  }

  await deleteModelApiConfig(body.id);
  await recordAdminAuditSafely({
    action: "model_api.delete",
    actor: authorization.user,
    request,
    targetId: body.id,
    targetType: "model_api"
  });

  return NextResponse.json({ ok: true });
}
