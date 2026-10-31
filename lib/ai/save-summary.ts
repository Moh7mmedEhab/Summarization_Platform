import { prisma } from "@/lib/db/prisma";
import type { SummaryContentT } from "@/lib/ai/schema";
import type { SummaryStyle } from "@/generated/prisma/enums";

/**
 * Idempotent summary save: the row carries the job's id. If the worker died
 * between this save and finish(), the re-claimed retry finds the row by jobId
 * and re-promotes it instead of creating a duplicate current summary.
 */
export async function saveSummaryForJob(input: {
  jobId: string;
  documentId: string;
  userId: string;
  language: string;
  style: SummaryStyle;
  content: SummaryContentT;
  model: string;
  promptVersion: string;
  coverageMetadata: object;
  sourceWordCount: number | null;
  summaryWordCount: number | null;
}): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.summary.updateMany({
      where: { documentId: input.documentId, current: true },
      data: { current: false },
    });
    const persisted = {
      content: input.content as unknown as object,
      model: input.model,
      promptVersion: input.promptVersion,
      coverageMetadata: input.coverageMetadata,
      sourceWordCount: input.sourceWordCount,
      summaryWordCount: input.summaryWordCount,
    };
    const existing = await tx.summary.findFirst({
      where: { jobId: input.jobId },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await tx.summary.update({ where: { id: existing.id }, data: { ...persisted, current: true } });
      return existing.id;
    }
    const created = await tx.summary.create({
      data: {
        documentId: input.documentId,
        userId: input.userId,
        language: input.language,
        style: input.style,
        jobId: input.jobId,
        ...persisted,
        current: true,
      },
    });
    return created.id;
  });
}
