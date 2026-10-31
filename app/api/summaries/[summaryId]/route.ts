import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { errorResponse, failJson, okJson } from "@/lib/api/respond";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SummaryContent } from "@/lib/ai/schema";
import { countSummaryWords } from "@/lib/ai/text";

type Params = { params: Promise<{ summaryId: string }> };

const patchSchema = z.object({
  content: z.unknown(), // must still validate as a summary contract
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

    const content = SummaryContent.parse(body.content);
    const summaryWordCount = countSummaryWords(content);
    await prisma.summary.update({
      where: { id: summaryId },
      data: {
        content: content as Prisma.InputJsonValue,
        summaryWordCount,
      },
    });
    return okJson({ saved: true, summaryWordCount });
  } catch (e) {
    return errorResponse(e);
  }
}
