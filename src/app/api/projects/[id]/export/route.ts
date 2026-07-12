import { NextResponse } from "next/server";

import {
  buildProjectExport,
  parseProjectExportSections,
  parseProjectExportSectionValues,
  projectExportContentDisposition,
  projectExportDownloadRequested
} from "@/lib/project-export";
import { ProductionPipelineError } from "@/lib/production-pipeline";
import {
  handleProductionError,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import type { StoredProject } from "@/lib/projects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function exportResponse(
  project: StoredProject,
  sections: Parameters<typeof buildProjectExport>[1],
  download: boolean
) {
  const payload = await buildProjectExport(project, sections);
  const commonHeaders = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  };

  if (!download) {
    return NextResponse.json(payload, { headers: commonHeaders });
  }

  return new NextResponse(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      ...commonHeaders,
      "Content-Disposition": projectExportContentDisposition(project.name),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const access = await requireProductionProject(id);

    if ("response" in access) {
      return access.response;
    }

    const sections = parseProjectExportSections(request);
    return exportResponse(
      access.project,
      sections,
      projectExportDownloadRequested(request)
    );
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const access = await requireProductionProject(id);

    if ("response" in access) {
      return access.response;
    }

    const body = await readProductionJson(request, 32 * 1024);
    const sections = parseProjectExportSectionValues(body.sections);

    if (body.download !== undefined && typeof body.download !== "boolean") {
      throw new ProductionPipelineError(
        "INVALID_EXPORT_DOWNLOAD",
        "download 必须是布尔值。",
        400
      );
    }

    return exportResponse(access.project, sections, body.download === true);
  } catch (error) {
    return handleProductionError(error);
  }
}
