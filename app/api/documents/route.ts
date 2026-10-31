import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, okJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/auth/session";
import { createDocument, listDocuments } from "@/features/documents/service";

const listQuerySchema = z.object({
  q: z.string().max(200).optional(),
  kind: z.enum(["all", "text", "pdf", "docx", "image_set"]).default("all"),
  status: z.enum(["all", "summarized", "draft", "processing", "failed"]).default("all"),
  sort: z.enum(["recent", "oldest", "title"]).default("recent"),
  page: z.coerce.number().int().positive().default(1),
});

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  text: z.string().min(1).max(200_000),
});

/** GET /api/documents — the authenticated user's library (paginated). */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const p = request.nextUrl.searchParams;
    const query = listQuerySchema.parse({
      q: p.get("q") ?? undefined,
      kind: p.get("kind") ?? "all",
      status: p.get("status") ?? "all",
      sort: p.get("sort") ?? "recent",
      page: p.get("page") ?? "1",
    });
    return okJson(await listDocuments(session.user.id, query));
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/documents — create a text-based document (pasted text, no files). */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = createSchema.parse(await request.json());
    const { documentId } = await createDocument(session.user.id, body);
    return okJson({ documentId }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
