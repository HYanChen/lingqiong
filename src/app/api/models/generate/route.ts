import { NextResponse } from "next/server";

import {
  getActiveModelApiConfig,
  logModelApiCall,
  type ModelApiConfig
} from "@/lib/model-apis";

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
    name?: string;
    source?: string;
    style?: string;
    type?: string;
  };
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function completionEndpoint(config: ModelApiConfig) {
  const baseUrl = trimTrailingSlash(config.baseUrl);

  if (baseUrl.endsWith("/chat/completions")) {
    return baseUrl;
  }

  return `${baseUrl}/chat/completions`;
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

function mockGenerate(prompt: string) {
  return [
    "【模拟生成】",
    "后台当前使用本地模拟模型。配置真实 OpenAI-compatible API 后，这里会返回模型生成结果。",
    "",
    "生成草案：",
    prompt
      .split("\n")
      .filter(Boolean)
      .slice(0, 8)
      .map((line, index) => `${index + 1}. ${line}`)
      .join("\n")
  ].join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as GenerateBody | null;
  const config = await getActiveModelApiConfig();

  if (!body?.node?.prompt?.trim()) {
    return NextResponse.json({ message: "缺少节点提示词。", ok: false }, { status: 400 });
  }

  if (!config) {
    return NextResponse.json(
      { message: "后台尚未启用模型 API，请先到 /admin 的 API 模块配置。", ok: false },
      { status: 400 }
    );
  }

  const prompt = composeUserPrompt(body);

  if (config.provider === "mock") {
    const text = mockGenerate(prompt);
    await logModelApiCall({
      configId: config.id,
      nodeTitle: body.node.title,
      prompt,
      responseText: text,
      status: "success"
    });

    return NextResponse.json({
      config: { id: config.id, model: config.model, name: config.name, provider: config.provider },
      ok: true,
      text
    });
  }

  if (!config.apiKey) {
    return NextResponse.json(
      { message: "当前模型 API 配置缺少 API Key。", ok: false },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(completionEndpoint(config), {
      body: JSON.stringify({
        max_tokens: config.maxTokens,
        messages: [
          { content: config.systemPrompt, role: "system" },
          { content: prompt, role: "user" }
        ],
        model: config.model,
        temperature: config.temperature
      }),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        typeof result?.error?.message === "string"
          ? result.error.message
          : `模型接口请求失败：${response.status}`;

      await logModelApiCall({
        configId: config.id,
        error: message,
        nodeTitle: body.node.title,
        prompt,
        status: "error"
      });

      return NextResponse.json({ message, ok: false }, { status: 502 });
    }

    const text =
      result?.choices?.[0]?.message?.content ??
      result?.choices?.[0]?.text ??
      result?.output_text ??
      "";

    if (!text) {
      return NextResponse.json(
        { message: "模型返回为空，请检查模型配置。", ok: false },
        { status: 502 }
      );
    }

    await logModelApiCall({
      configId: config.id,
      nodeTitle: body.node.title,
      prompt,
      responseText: text,
      status: "success"
    });

    return NextResponse.json({
      config: { id: config.id, model: config.model, name: config.name, provider: config.provider },
      ok: true,
      text
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型接口请求失败。";

    await logModelApiCall({
      configId: config.id,
      error: message,
      nodeTitle: body.node.title,
      prompt,
      status: "error"
    });

    return NextResponse.json({ message, ok: false }, { status: 502 });
  }
}
