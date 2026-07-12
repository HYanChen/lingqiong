import { ensureKnowledgeSchema } from "@/lib/knowledge-schema";

export async function ensureKnowledgeTrashSchema() {
  return ensureKnowledgeSchema();
}
