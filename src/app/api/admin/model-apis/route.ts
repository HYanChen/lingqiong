import { NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-auth";
import {
  deleteModelApiConfig,
  listPublicModelApiConfigs,
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
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  return NextResponse.json({ configs: await listPublicModelApiConfigs() });
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ModelApiBody | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ message: "请填写配置名称。" }, { status: 400 });
  }

  const provider = body.provider === "mock" ? "mock" : "openai-compatible";
  const baseUrl = body.baseUrl?.trim() || (provider === "mock" ? "local://mock" : "");

  if (provider !== "mock" && !baseUrl) {
    return NextResponse.json({ message: "请填写 Base URL。" }, { status: 400 });
  }

  const config = await upsertModelApiConfig({
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

  return NextResponse.json({ config, ok: true });
}

export async function DELETE(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;

  if (!body?.id) {
    return NextResponse.json({ message: "缺少配置 ID。" }, { status: 400 });
  }

  await deleteModelApiConfig(body.id);

  return NextResponse.json({ ok: true });
}
