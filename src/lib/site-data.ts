import { promises as fs } from "node:fs";
import path from "node:path";

import {
  defaultSiteData,
  type SiteData,
  type SiteCopyEntry,
  type TeamMember
} from "@/content/site";
import { getFirstRow, readDatabase, writeDatabase } from "@/lib/database";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "site-content.json");
const SITE_CONTENT_KEY = "primary";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function isAdminNavigationHref(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const decoded = decodeURIComponent(value.trim());
    const url = new URL(decoded, "https://public-navigation.invalid");
    let pathname = url.pathname;

    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      // Keep the first decoded pathname when a nested escape is malformed.
    }

    pathname = pathname.replace(/\/{2,}/gu, "/").replace(/\/+$/u, "") || "/";
    return pathname === "/admin" || pathname.startsWith("/admin/");
  } catch {
    return false;
  }
}

function normalizeNavItems(value: unknown): SiteData["navItems"] {
  if (!Array.isArray(value)) {
    return defaultSiteData.navItems;
  }

  return value.filter(
    (item): item is SiteData["navItems"][number] =>
      isRecord(item) &&
      typeof item.href === "string" &&
      typeof item.label === "string" &&
      !isAdminNavigationHref(item.href)
  );
}

function generatedMemberSlug(name: string, index: number) {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (ascii) {
    return ascii;
  }

  const codePoints = Array.from(name.trim())
    .map((character) => character.codePointAt(0)?.toString(36) ?? "")
    .filter(Boolean)
    .join("-");

  return `member-${codePoints || index + 1}`;
}

function normalizeTeamMembers(value: unknown): TeamMember[] {
  if (!Array.isArray(value)) {
    return defaultSiteData.teamMembers;
  }

  const usedSlugs = new Set<string>();

  return value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }

    const name = stringValue(item.name).trim();
    const group = stringValue(item.group).trim().slice(0, 80) || "核心团队";
    const preferredSlug =
      stringValue(item.slug)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "") || generatedMemberSlug(name, index);
    let slug = preferredSlug;
    let suffix = 2;

    while (usedSlugs.has(slug)) {
      slug = `${preferredSlug}-${suffix}`;
      suffix += 1;
    }

    usedSlugs.add(slug);

    return [
      {
        avatar: stringValue(item.avatar).trim(),
        bio: stringValue(item.bio).trim(),
        expertise: stringList(item.expertise),
        group,
        highlights: stringList(item.highlights),
        name: name || `未命名成员 ${index + 1}`,
        role: stringValue(item.role).trim() || "团队成员",
        slug
      }
    ];
  });
}

function normalizeSiteCopy(value: unknown): SiteCopyEntry[] {
  const incoming = Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          isRecord(item) && typeof item.key === "string"
      )
    : [];
  const incomingByKey = new Map(
    incoming.map((item) => [stringValue(item.key).trim(), item])
  );
  const defaults = defaultSiteData.siteCopy.map((entry) => {
    const override = incomingByKey.get(entry.key);

    incomingByKey.delete(entry.key);

    return {
      ...entry,
      ...(override
        ? {
            group: stringValue(override.group).trim() || entry.group,
            label: stringValue(override.label).trim() || entry.label,
            multiline:
              typeof override.multiline === "boolean"
                ? override.multiline
                : entry.multiline,
            value:
              typeof override.value === "string" ? override.value : entry.value
          }
        : {})
    };
  });
  const custom = Array.from(incomingByKey.values()).flatMap((item) => {
    const key = stringValue(item.key).trim();

    if (!key) {
      return [];
    }

    return [
      {
        group: stringValue(item.group).trim() || "自定义",
        key,
        label: stringValue(item.label).trim() || key,
        multiline: Boolean(item.multiline),
        value: stringValue(item.value)
      } satisfies SiteCopyEntry
    ];
  });

  return [...defaults, ...custom];
}

function normalizeData(value: unknown): SiteData {
  if (!isRecord(value)) {
    return defaultSiteData;
  }

  return {
    ...defaultSiteData,
    ...value,
    brand: isRecord(value.brand)
      ? { ...defaultSiteData.brand, ...value.brand }
      : defaultSiteData.brand,
    company: isRecord(value.company)
      ? {
          ...defaultSiteData.company,
          ...value.company,
          contact: isRecord(value.company.contact)
            ? { ...defaultSiteData.company.contact, ...value.company.contact }
            : defaultSiteData.company.contact
        }
      : defaultSiteData.company,
    media: isRecord(value.media)
      ? { ...defaultSiteData.media, ...value.media }
      : defaultSiteData.media,
    navItems: normalizeNavItems(value.navItems),
    universeChapters: Array.isArray(value.universeChapters)
      ? value.universeChapters
      : defaultSiteData.universeChapters,
    works: Array.isArray(value.works) ? value.works : defaultSiteData.works,
    pipelineSteps: Array.isArray(value.pipelineSteps)
      ? value.pipelineSteps
      : defaultSiteData.pipelineSteps,
    services: Array.isArray(value.services) ? value.services : defaultSiteData.services,
    teamMembers: normalizeTeamMembers(value.teamMembers),
    proofPoints: Array.isArray(value.proofPoints)
      ? value.proofPoints
      : defaultSiteData.proofPoints,
    siteCopy: normalizeSiteCopy(value.siteCopy)
  } as SiteData;
}

async function getSeedData() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    return normalizeData(JSON.parse(raw));
  } catch {
    return defaultSiteData;
  }
}

function allowDatabaseFallback() {
  return process.env.WCU_ALLOW_DATABASE_FALLBACK === "true";
}

async function readStoredSiteData() {
  return readDatabase(async (db) => {
    const row = await getFirstRow<{ json: string }>(
      db,
      "SELECT json FROM site_content WHERE `key` = ?",
      [SITE_CONTENT_KEY]
    );

    return row?.json ? normalizeData(JSON.parse(row.json)) : null;
  });
}

export async function getSiteData(): Promise<SiteData> {
  let storedData: SiteData | null = null;

  try {
    storedData = await readStoredSiteData();
  } catch (error) {
    if (!allowDatabaseFallback()) {
      throw error;
    }
  }

  if (storedData) {
    return storedData;
  }

  const seedData = await getSeedData();

  if (!allowDatabaseFallback()) {
    await writeDatabase(async (db) => {
      await db.execute(
        `INSERT INTO site_content (\`key\`, json, updated_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           json = VALUES(json),
           updated_at = VALUES(updated_at)`,
        [SITE_CONTENT_KEY, JSON.stringify(seedData), new Date().toISOString()]
      );
    });
  }

  return seedData;
}

export async function saveSiteData(data: SiteData): Promise<void> {
  const normalizedData = normalizeData(data);

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO site_content (\`key\`, json, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         json = VALUES(json),
         updated_at = VALUES(updated_at)`,
      [SITE_CONTENT_KEY, JSON.stringify(normalizedData), new Date().toISOString()]
    );
  });
}

export { DATA_PATH };
