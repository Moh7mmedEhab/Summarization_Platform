import type { NextRequest } from "next/server";
import { errorResponse, failJson, okJson } from "@/lib/api/respond";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type Params = { params: Promise<{ jobId: string }> };
/** GET /api/jobs/[jobId] — processing progress (owner-only; safe to poll). */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = (await getSession()) ?? null;
    if (!session) return errorResponse(new Error("UNAUTHORIZED"));
    const { jobId } = await params;
    const job = await prisma.processingJob.findFirst({
      where: { id: jobId, userId: session.user.id },
    });
    if (!job) return failJson(404, "not_found", "Job not found");
    return okJson({
      job: {
        id: job.id,
        documentId: job.documentId,
        status: job.status,
        progress: job.progress,
        stage: job.stage,
        error: job.error,
        attempts: job.attempts,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/jobs/[jobId] — cancel a queued job (safe cancellation). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = (await getSession()) ?? null;
    if (!session) return errorResponse(new Error("UNAUTHORIZED"));
    const { jobId } = await params;
    const job = await prisma.processingJob.findFirst({
      where: { id: jobId, userId: session.user.id, status: "queued" },
    });
    if (!job) return failJson(404, "not_found", "No queued job to cancel");
    await prisma.processingJob.update({
      where: { id: job.id },
      data: { status: "canceled", mutex: null, completedAt: new Date() },
    });
    await prisma.document.updateMany({
      where: { id: job.documentId, status: "processing" },
      data: { status: "draft" },
    });
    return okJson({ canceled: true });
  } catch (e) {
    return errorResponse(e);
  }
}
