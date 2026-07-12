import {
  handleKnowledgeError,
  optionalIdQuery,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import { exportKnowledgeTableCsv } from "@/lib/knowledge-csv";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string; tableId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    const exported = await exportKnowledgeTableCsv(
      spaceId,
      tableId,
      optionalIdQuery(request, "viewId")
    );
    const encodedFilename = encodeURIComponent(exported.filename);
    return new Response(exported.csv, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Knowledge-Record-Count": String(exported.recordCount)
      }
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
