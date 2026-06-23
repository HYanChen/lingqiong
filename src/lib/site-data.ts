import { promises as fs } from "node:fs";
import path from "node:path";

import { defaultSiteData, type SiteData } from "@/content/site";
import { getFirstRow, readDatabase, writeDatabase } from "@/lib/database";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "site-content.json");
const SITE_CONTENT_KEY = "primary";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    navItems: Array.isArray(value.navItems) ? value.navItems : defaultSiteData.navItems,
    universeChapters: Array.isArray(value.universeChapters)
      ? value.universeChapters
      : defaultSiteData.universeChapters,
    works: Array.isArray(value.works) ? value.works : defaultSiteData.works,
    pipelineSteps: Array.isArray(value.pipelineSteps)
      ? value.pipelineSteps
      : defaultSiteData.pipelineSteps,
    services: Array.isArray(value.services) ? value.services : defaultSiteData.services,
    proofPoints: Array.isArray(value.proofPoints)
      ? value.proofPoints
      : defaultSiteData.proofPoints
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

async function readStoredSiteData() {
  return readDatabase((db) => {
    const row = getFirstRow<{ json: string }>(
      db,
      "SELECT json FROM site_content WHERE key = ?",
      [SITE_CONTENT_KEY]
    );

    return row?.json ? normalizeData(JSON.parse(row.json)) : null;
  });
}

export async function getSiteData(): Promise<SiteData> {
  const storedData = await readStoredSiteData();

  if (storedData) {
    return storedData;
  }

  const seedData = await getSeedData();

  await writeDatabase((db) => {
    db.run(
      `INSERT INTO site_content (key, json, updated_at)
       VALUES (?, ?, ?)`,
      [SITE_CONTENT_KEY, JSON.stringify(seedData), new Date().toISOString()]
    );
  });

  return seedData;
}

export async function saveSiteData(data: SiteData): Promise<void> {
  const normalizedData = normalizeData(data);

  await writeDatabase((db) => {
    db.run(
      `INSERT INTO site_content (key, json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         json = excluded.json,
         updated_at = excluded.updated_at`,
      [SITE_CONTENT_KEY, JSON.stringify(normalizedData), new Date().toISOString()]
    );
  });
}

export { DATA_PATH };
