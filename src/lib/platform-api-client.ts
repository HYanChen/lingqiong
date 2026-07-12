import "server-only";

import { cache } from "react";

import {
  defaultProjectTypes,
  type ProjectType
} from "@/content/project-types";
import { defaultSiteData, type SiteData } from "@/content/site";
import type { PlatformApiResponse } from "@/lib/platform-api-contract";

const DEFAULT_LOCAL_PLATFORM_API_URL = `http://127.0.0.1:${
  process.env.PORT || "3000"
}/api/v1`;
const FALLBACK_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function platformApiBaseUrl() {
  return (
    process.env.PLATFORM_API_INTERNAL_URL?.trim() ||
    DEFAULT_LOCAL_PLATFORM_API_URL
  ).replace(/\/+$/, "");
}

function requestTimeout() {
  const configured = Number(process.env.PLATFORM_API_TIMEOUT_MS || 3500);

  if (!Number.isFinite(configured)) {
    return 3500;
  }

  return Math.min(Math.max(configured, 500), 15_000);
}

async function requestPlatformApi<T>(path: string): Promise<T> {
  const response = await fetch(`${platformApiBaseUrl()}/${path.replace(/^\/+/, "")}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-WCU-Client": "site-web"
    },
    signal: AbortSignal.timeout(requestTimeout())
  });

  const payload = (await response.json().catch(() => null)) as
    | PlatformApiResponse<T>
    | null;

  if (!response.ok || !payload?.ok) {
    const message = payload && !payload.ok ? payload.error.message : response.statusText;
    throw new Error(message || `Platform API request failed (${response.status})`);
  }

  return payload.data;
}

function isSiteData(value: unknown): value is SiteData {
  if (!isRecord(value) || !isRecord(value.brand) || !isRecord(value.company)) {
    return false;
  }

  return (
    typeof value.brand.name === "string" &&
    typeof value.brand.english === "string" &&
    typeof value.brand.tagline === "string" &&
    Array.isArray(value.navItems) &&
    isRecord(value.media) &&
    Array.isArray(value.universeChapters) &&
    Array.isArray(value.works) &&
    Array.isArray(value.pipelineSteps) &&
    Array.isArray(value.services) &&
    Array.isArray(value.teamMembers) &&
    Array.isArray(value.proofPoints)
  );
}

function isProjectType(value: unknown): value is ProjectType {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.active === "boolean" &&
    typeof value.category === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.description === "string" &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.slug === "string" &&
    typeof value.sortOrder === "number" &&
    typeof value.updatedAt === "string"
  );
}

function defaultActiveProjectTypes(): ProjectType[] {
  return defaultProjectTypes
    .filter((item) => item.active)
    .map((item) => ({
      ...item,
      createdAt: FALLBACK_TIMESTAMP,
      updatedAt: FALLBACK_TIMESTAMP
    }));
}

export const getPlatformSiteData = cache(async (): Promise<SiteData> => {
  try {
    const data = await requestPlatformApi<SiteData>("site-content");

    if (!isSiteData(data)) {
      throw new Error("Platform API returned invalid site content");
    }

    return data;
  } catch (error) {
    console.warn("[platform-api] site-content fallback enabled", error);
    return defaultSiteData;
  }
});

export const getPlatformProjectTypes = cache(async (): Promise<ProjectType[]> => {
  try {
    const data = await requestPlatformApi<unknown>("project-types?active=1");

    if (!Array.isArray(data) || !data.every(isProjectType)) {
      throw new Error("Platform API returned invalid project types");
    }

    return data;
  } catch (error) {
    console.warn("[platform-api] project-types fallback enabled", error);
    return defaultActiveProjectTypes();
  }
});

export const getPlatformProjectTypeCategories = cache(async () => {
  const types = await getPlatformProjectTypes();
  return Array.from(new Set(types.map((type) => type.category.trim()).filter(Boolean)));
});
