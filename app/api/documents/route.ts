import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, okJson, num } from "@/lib/api/respond";
import { requireSession } from "@/lib/auth/session";
import { createDocument, listDocuments } from "@/features/documents/service";

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
    const result = await listDocuments(session.user.id, {
      q: p.get("q") ?? undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kind: (p.get("kind") as any) ?? "all",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: (p.get("status") as any) ?? "all",
      sort: (p.get("sort") as "recent" | "oldest" | "title") ?? "recent",
      page: num(p.get("page")),
    });
    return okJson(result);
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
