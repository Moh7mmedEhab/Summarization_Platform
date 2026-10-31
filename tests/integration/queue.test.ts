import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { claimJob, heartbeat, progress, finish, fail } from "@/lib/jobs/queue";
import { deleteDocument } from "@/features/documents/service";

describe("Job Queue Integration (lib/jobs/queue.ts on PostgreSQL)", () => {
  const testRunId = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const userId = `${testRunId}_user`;
  let docId1: string;
  let docId2: string;

  beforeAll(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: userId,
        name: "Queue Tester",
        email: `${testRunId}@margins.test`,
        emailVerified: true,
      },
    });

    // Create test documents
    const doc1 = await prisma.document.create({
      data: {
        userId,
        title: "Queue Doc 1",
        status: "processing",
      },
    });
    docId1 = doc1.id;

    const doc2 = await prisma.document.create({
      data: {
        userId,
        title: "Queue Doc 2",
        status: "processing",
      },
    });
    docId2 = doc2.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
  });

  it("returns null when claiming from an empty queue", async () => {
    const job = await claimJob();
    expect(job).toBeNull();
  });

  it("claims a queued job atomically and increments attempts", async () => {
    const createdJob = await prisma.processingJob.create({
      data: {
        documentId: docId1,
        userId,
        status: "queued",
        attempts: 0,
        maxAttempts: 3,
        progress: 0,
      },
    });

    const claimed = await claimJob();
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(createdJob.id);
    expect(claimed?.attempts).toBe(1);

    // Verify DB state updated
    const dbJob = await prisma.processingJob.findUnique({ where: { id: createdJob.id } });
    expect(dbJob?.status).toBe("running");
    expect(dbJob?.attempts).toBe(1);
    expect(dbJob?.claimedAt).toBeDefined();
    expect(dbJob?.heartbeat).toBeDefined();
  });

  it("handles progress reporting and clamps between 0 and 100", async () => {
    const job = await prisma.processingJob.findFirst({
      where: { documentId: docId1, status: "running" },
    });
    expect(job).not.toBeNull();

    await progress(job!.id, { stage: "analyzing", percent: 45.7 });
    let updated = await prisma.processingJob.findUnique({ where: { id: job!.id } });
    expect(updated?.stage).toBe("analyzing");
    expect(updated?.progress).toBe(46);

    // Clamp over 100
    await progress(job!.id, { percent: 150 });
    updated = await prisma.processingJob.findUnique({ where: { id: job!.id } });
    expect(updated?.progress).toBe(100);

    // Clamp under 0
    await progress(job!.id, { percent: -20 });
    updated = await prisma.processingJob.findUnique({ where: { id: job!.id } });
    expect(updated?.progress).toBe(0);
  });

  it("updates heartbeat timestamp", async () => {
    const job = await prisma.processingJob.findFirst({
      where: { documentId: docId1, status: "running" },
    });
    const oldHeartbeat = job?.heartbeat;

    // Small delay to ensure timestamp progression
    await new Promise((r) => setTimeout(r, 50));
    await heartbeat(job!.id);

    const updated = await prisma.processingJob.findUnique({ where: { id: job!.id } });
    if (!oldHeartbeat || !updated?.heartbeat) {
      throw new Error("Expected heartbeat timestamps before and after the update");
    }
    expect(updated.heartbeat.getTime()).toBeGreaterThanOrEqual(oldHeartbeat.getTime());
  });

  it("finishes job, marks status succeeded, progress 100, and document summarized", async () => {
    const job = await prisma.processingJob.findFirst({
      where: { documentId: docId1, status: "running" },
    });

    await finish(job!.id, docId1);

    const finishedJob = await prisma.processingJob.findUnique({ where: { id: job!.id } });
    expect(finishedJob?.status).toBe("succeeded");
    expect(finishedJob?.progress).toBe(100);
    expect(finishedJob?.completedAt).not.toBeNull();

    const finishedDoc = await prisma.document.findUnique({ where: { id: docId1 } });
    expect(finishedDoc?.status).toBe("summarized");
  });

  it("re-queues a failed job when attempts < maxAttempts and canRetry is true", async () => {
    const retryJob = await prisma.processingJob.create({
      data: {
        documentId: docId2,
        userId,
        status: "running",
        attempts: 1,
        maxAttempts: 3,
        progress: 20,
      },
    });

    await fail(retryJob.id, docId2, "Temporary LLM rate limit", true);

    const afterFail = await prisma.processingJob.findUnique({ where: { id: retryJob.id } });
    expect(afterFail?.status).toBe("queued");
    expect(afterFail?.error).toBe("Temporary LLM rate limit");
    expect(afterFail?.completedAt).toBeNull();

    // Document status should NOT be set to failed yet
    const doc = await prisma.document.findUnique({ where: { id: docId2 } });
    expect(doc?.status).toBe("processing");
  });

  it("marks job and document failed when attempts reach maxAttempts", async () => {
    const doomedJob = await prisma.processingJob.findFirst({
      where: { documentId: docId2 },
    });

    // Update attempts to max
    await prisma.processingJob.update({
      where: { id: doomedJob!.id },
      data: { attempts: 3 },
    });

    await fail(doomedJob!.id, docId2, "Permanent unrecoverable error", true);

    const exhausted = await prisma.processingJob.findUnique({ where: { id: doomedJob!.id } });
    expect(exhausted?.status).toBe("failed");
    expect(exhausted?.completedAt).not.toBeNull();

    const failedDoc = await prisma.document.findUnique({ where: { id: docId2 } });
    expect(failedDoc?.status).toBe("failed");
  });

  it("finish() is graceful when the document and job were deleted mid-run (no P2025 throw)", async () => {
    const doc = await prisma.document.create({
      data: { userId, title: "Doomed doc", status: "processing" },
    });
    const job = await prisma.processingJob.create({
      data: {
        documentId: doc.id,
        userId,
        status: "running",
        mutex: `mutex_${doc.id}`,
      },
    });
    // The user deletes the document; the job row cascades away.
    await prisma.document.delete({ where: { id: doc.id } });

    await expect(finish(job.id, doc.id)).resolves.toBeUndefined();
    await expect(prisma.processingJob.findUnique({ where: { id: job.id } })).resolves.toBeNull();
    await expect(prisma.document.findUnique({ where: { id: doc.id } })).resolves.toBeNull();
  });

  it("fail() is graceful when the job row vanished mid-run, and never leaves it running", async () => {
    const doc = await prisma.document.create({
      data: { userId, title: "Doomed doc 2", status: "processing" },
    });
    const job = await prisma.processingJob.create({
      data: { documentId: doc.id, userId, status: "running", mutex: `mutex_${doc.id}` },
    });
    await prisma.document.delete({ where: { id: doc.id } });

    await expect(fail(job.id, doc.id, "provider exploded", false)).resolves.toBeUndefined();
  });

  it("deleteDocument cancels queued/running jobs before removing the row", async () => {
    const doc = await prisma.document.create({
      data: { userId, title: "Cancel target", status: "processing" },
    });
    await prisma.processingJob.create({
      data: { documentId: doc.id, userId, status: "running", mutex: `mutex_${doc.id}` },
    });
    await prisma.processingJob.create({
      data: { documentId: doc.id, userId, status: "queued" },
    });

    await deleteDocument(userId, doc.id);

    // Both job rows are gone with the document — nothing is left "running".
    const remaining = await prisma.processingJob.count({ where: { documentId: doc.id } });
    expect(remaining).toBe(0);
  });
});
