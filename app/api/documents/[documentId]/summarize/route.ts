import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, okJson } from "@/lib/api/respond";
import { getSession } from "@/lib/auth/session";
import { assertOwned, startSummarization } from "@/features/documents/service";

const schema = z.object({
  language: z.enum(["en", "ar"]).default("en"),
  style: z.enum(["comprehensive", "key_points", "paragraph", "exam_prep"]).default("comprehensive"),
});

type Params = { params: Promise<{ documentId: string }> };

/** POST /api/documents/[documentId]/summarize — queue a summarization job. */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = (await getSession()) ?? null;
    if (!session) {
      return errorResponse(new Error("UNAUTHORIZED"));
    }
    const { documentId } = await params;
    const body = schema.parse(await request.json().catch(() => ({})));
    await assertOwned(documentId, session.user.id);
    const { jobId } = await startSummarization(session.user.id, documentId, body);
    return okJson({ jobId }, 202);
  } catch (e) {
    return errorResponse(e);
  }
}
