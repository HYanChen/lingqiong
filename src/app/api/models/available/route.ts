import { NextResponse } from "next/server";

import { requirePlatformUser } from "@/lib/auth-guards";
import {
  listModelApiConfigs,
  modelApiModelsEndpoint,
  type ModelApiConfig
} from "@/lib/model-apis";
import { getRows, readDatabase } from "@/lib/database";

type AvailableModel = {
  id: string;
  label: string;
  ownedBy?: string;
  provider: string;
  source: "new-api-database" | "new-api-token";
};

type ModelRow = {
  model_name: string;
};

type ChannelRow = {
  model_mapping: string | null;
  models: string | null;
  name: string | null;
};

function uniqueModels(models: AvailableModel[]) {
  const seen = new Set<string>();

  return models.filter((model) => {
    const key = model.id.trim();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function parseModelList(value: string | null) {
  if (!value?.trim()) {
    return [];
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;

      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) =>
          typeof item === "string" ? [item] : []
        );
      }

      if (parsed && typeof parsed === "object") {
        return Object.keys(parsed);
      }
    } catch {
      // Fall through to separator parsing.
    }
  }

  return trimmed
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readNewApiDatabaseModels() {
  try {
    return await readDatabase(async (db) => {
      const modelRows = await getRows<ModelRow>(
        db,
        `SELECT model_name
         FROM new_api.models
         WHERE status = 1 AND deleted_at IS NULL
         ORDER BY updated_time DESC, model_name ASC
         LIMIT 200`
      );
      const channelRows = await getRows<ChannelRow>(
        db,
        `SELECT name, models, model_mapping
         FROM new_api.channels
         WHERE status = 1 AND deleted_at IS NULL
         ORDER BY priority DESC, id DESC
         LIMIT 100`
      );

      const models: AvailableModel[] = [
        ...modelRows.map((row) => ({
          id: row.model_name,
          label: row.model_name,
          provider: "new-api",
          source: "new-api-database" as const
        })),
        ...channelRows.flatMap((row) =>
          [...parseModelList(row.models), ...parseModelList(row.model_mapping)].map(
            (model) => ({
              id: model,
              label: row.name ? `${model} / ${row.name}` : model,
              provider: "new-api",
              source: "new-api-database" as const
            })
          )
        )
      ];

      return uniqueModels(models);
    });
  } catch {
    return [];
  }
}

async function fetchTokenModels(config: ModelApiConfig) {
  if (config.provider !== "new-api" || !config.apiKey) {
    return [];
  }

  try {
    const response = await fetch(await modelApiModelsEndpoint(config), {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      },
      redirect: "error",
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      data?: Array<{ id?: string; owned_by?: string }>;
    };

    return uniqueModels(
      (payload.data ?? []).flatMap((item) =>
        item.id
          ? [
              {
                id: item.id,
                label: item.id,
                ownedBy: item.owned_by,
                provider: "new-api",
                source: "new-api-token" as const
              }
            ]
          : []
      )
    );
  } catch {
    return [];
  }
}

export async function GET() {
  const { response } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const newApiConfig =
    (await listModelApiConfigs()).find(
      (config) => config.enabled && config.provider === "new-api"
    ) ?? null;
  const [databaseModels, tokenModels] = await Promise.all([
    readNewApiDatabaseModels(),
    newApiConfig ? fetchTokenModels(newApiConfig) : Promise.resolve([])
  ]);
  const newApiModels = uniqueModels([...tokenModels, ...databaseModels]);

  return NextResponse.json({
    activeConfig: newApiConfig
      ? {
          id: newApiConfig.id,
          model: newApiConfig.model,
          name: newApiConfig.name,
          provider: newApiConfig.provider
        }
      : null,
    message: newApiModels.length
      ? "已同步灵穹 API 提示词模型池。"
      : newApiConfig
        ? "灵穹 API 提示词模型池为空，请先在灵穹 API 控制台创建渠道并同步模型。"
        : "灵穹 API 提示词模型池为空，请联系平台运营人员配置渠道、Token 和模型。",
    models: newApiModels,
    ok: true,
    source: "new-api"
  });
}
