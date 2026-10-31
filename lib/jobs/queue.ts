import { prisma } from "@/lib/db/prisma";

/**
 * PostgreSQL-backed job queue. Workers claim one job atomically via
 * FOR UPDATE SKIP LOCKED, so two workers never process the same job twice.
 * A running job without heartbeat progress is considered stale after
 * STALE_AFTER_MS and becomes claimable again (interrupted-work recovery),
 * up to its max attempts.
 */

export type ClaimableJob = {
  id: string;
  documentId: string;
  userId: string;
  attempts: number;
  maxAttempts: number;
  progress: number;
};

const STALE_AFTER_MS = 5 * 60 * 1000;

export async function claimJob(): Promise<ClaimableJob | null> {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    document_id: string;
    user_id: string;
    attempts: bigint;
    max_attempts: bigint;
    progress: number;
  }>>`
    UPDATE processing_job
    SET status = 'running',
        "attempts" = "attempts" + 1,
        claimed_at = now(),
        started_at = COALESCE(started_at, now()),
        heartbeat = now(),
        error = NULL
    WHERE id = (
      SELECT j.id FROM processing_job j
      WHERE (j.status = 'queued')
         OR (j.status = 'running' AND j.heartbeat < now() - make_interval(secs => ${STALE_AFTER_MS / 1000}))
      ORDER BY j.created_at ASC
      FOR UPDATE OF j SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, document_id, user_id, attempts, max_attempts, progress
  `;
  const row = rows[0];
  if (!row) return null;
  const job = await prisma.processingJob.findUnique({ where: { id: row.id } });
  if (!job || job.attempts > job.maxAttempts) {
    if (job) {
      await prisma.processingJob.update({
        where: { id: job.id },
        data: { status: "failed", error: "exceeded max attempts" },
      });
    }
    return null;
  }
  return {
    id: job.id,
    documentId: job.documentId,
    userId: job.userId,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    progress: job.progress,
  };
}

export async function heartbeat(jobId: string): Promise<void> {
  await prisma.processingJob.updateMany({
    where: { id: jobId, status: "running" },
    data: { heartbeat: new Date() },
  });
}

/** Small helper so long pipeline stages can report progress without waiting for the worker loop. */
export async function progress(jobId: string, data: { stage?: string; percent?: number }): Promise<void> {
  const patch: { heartbeat: Date; stage?: string; progress?: number } = { heartbeat: new Date() };
  if (data.stage !== undefined) patch.stage = data.stage;
  if (data.percent !== undefined) patch.progress = Math.max(0, Math.min(100, Math.round(data.percent)));
  await prisma.processingJob.updateMany({ where: { id: jobId, status: "running" }, data: patch });
}

export async function finish(jobId: string, documentId: string): Promise<void> {
  // Job done → release the document's mutex so a future summarize can run.
  await prisma.processingJob.updateMany({
    where: { id: jobId },
    data: { status: "succeeded", progress: 100, completedAt: new Date(), mutex: null, error: null },
  });
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "summarized" },
  });
}

export async function fail(jobId: string, documentId: string, message: string, canRetry: boolean): Promise<void> {
  const job = await prisma.processingJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  const exhausted = !canRetry || job.attempts >= job.maxAttempts;
  await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      status: exhausted ? "failed" : "queued",
      error: message.slice(0, 2000),
      mutex: null, // released either way; re-queue claims again with a fresh claim window
      completedAt: exhausted ? new Date() : null,
    },
  });
  if (exhausted) {
    await prisma.document.updateMany({
      where: { id: documentId, status: { in: ["processing", "draft"] as never } },
      data: { status: "failed" },
    });
  }
}
