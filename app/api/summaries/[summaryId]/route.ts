import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, failJson, okJson } from "@/lib/api/respond";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { SummaryContentT } from "@/lib/ai/schema";

type Params = { params: Promise<{ summaryId: string }> };

const patchSchema = z.object({
  content: z.unknown(), // must still validate as a summary contract
  title: z.string().max(300).optional(), // rename the document (notes title editable via document)
});

/** GET /api/summaries/[summaryId] — owner-only summary view. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = (await getSession()) ?? null;
    if (!session) return errorResponse(new Error("UNAUTHORIZED"));
    const { summaryId } = await params;
    const summary = await prisma.summary.findFirst({
      where: { id: summaryId, userId: session.user.id },
    });
    if (!summary) return failJson(404, "not_found", "Summary not found");
    return okJson({
      summary: {
        id: summary.id,
        documentId: summary.documentId,
        language: summary.language,
        style: summary.style,
        content: summary.content,
        model: summary.model,
        promptVersion: summary.promptVersion,
        sourceWordCount: summary.sourceWordCount,
        summaryWordCount: summary.summaryWordCount,
        createdAt: summary.createdAt.toISOString(),
        updatedAt: summary.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PATCH /api/summaries/[summaryId] — save edited notes (validated contract). */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = (await getSession()) ?? null;
    if (!session) return errorResponse(new Error("UNAUTHORIZED"));
    const { summaryId } = await params;
    const body = patchSchema.parse(await request.json());

    const existing = await prisma.summary.findFirst({
      where: { id: summaryId, userId: session.user.id },
    });
    if (!existing) return failJson(404, "not_found", "Summary not found");

    const update: { content?: unknown; summaryWordCount?: number; updatedAt?: Date } = {};
    if (body.content !== undefined) {
      // structural re-validation against the summary contract is done in the
      // caller's view layer through /api/summaries validate; here we persist the
      // valid contract only, using the shared zod schema
      const { SummaryContent } = await import("@/lib/ai/schema");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update.content = SummaryContent.parse(body.content) as unknown as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = update.content as any;
      update.summaryWordCount = c.sections.reduce(
        (n: number, s: { points?: Array<{ lead?: string; text: string }> }) =>
          n + (s.points ?? []).reduce((m, p) => m + `${p.lead ?? ""} ${p.text}`.trim().split(/\s+/).length, 0),
        0,
      );
    }
    await prisma.summary.update({ where: { id: summaryId }, data: update as never });
    return okJson({ saved: true, summaryWordCount: update.summaryWordCount });
  } catch (e) {
    return errorResponse(e);
  }
}
