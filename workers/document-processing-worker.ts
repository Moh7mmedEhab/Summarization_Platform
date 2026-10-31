import "dotenv/config";
import { claimJob, heartbeat, finish, fail, progress } from "@/lib/jobs/queue";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { localPrivateStorage } from "@/lib/storage/storage";
import { runPipeline, type PreparedAsset } from "@/lib/ai/pipeline";
import { uploadGeminiFile } from "@/lib/ai/gemini/client";
import type { SourceKind, SummaryStyle } from "@/generated/prisma/enums";

/**
 * Background worker for long-running summarization jobs.
 *   npm run worker
 * Claim loop: atomically FOR UPDATE SKIP LOCKED; heartbeat while working so a
 * crashed or lost worker's job is re-claimed (same attempt budget) later.
 */

let stopping = false;

async function loadAssets(documentId: string): Promise<PreparedAsset[]> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      SourceAssets: { orderBy: { position: "asc" } },
    },
  });
  if (!doc) throw new Error(`document ${documentId} vanished`);
  const assets: PreparedAsset[] = [];
  for (const asset of doc.SourceAssets) {
    const prepared: PreparedAsset = {
      id: asset.id,
      kind: asset.assetType,
      mime: asset.mimeType ?? undefined,
      filename: asset.originalFilename ?? undefined,
      position: asset.position,
      text: asset.extractedText ?? undefined,
    };
    try {
      if (asset.storageKey) {
        const bytes = await localPrivateStorage.get(asset.storageKey);
        // Audio always uses the Files API; large PDFs avoid oversized inline requests.
        if (
          asset.assetType === "audio" ||
          (asset.assetType === "pdf" && bytes.byteLength > 12 * 1024 * 1024)
        ) {
          prepared.uri = await uploadGeminiFile(
            bytes,
            asset.mimeType ?? (asset.assetType === "audio" ? "audio/mpeg" : "application/pdf"),
            asset.originalFilename ?? asset.assetType,
          );
        } else if (asset.assetType !== "text") {
          prepared.bytes = bytes;
        }
      }
    } catch (e) {
      throw new Error(`Failed to read stored asset ${asset.id}: ${(e as Error).message}`);
    }
    assets.push(prepared);
  }
  return assets;
}

type SummarizePayload = { language?: "en" | "ar"; style?: string };

async function processJob(jobId: string): Promise<void> {
  const report = (stage: string, percent: number) => progress(jobId, { stage, percent });
  const job = await prisma.processingJob.findUniqueOrThrow({ where: { id: jobId } });
  const payload = (job.payload ?? {}) as SummarizePayload;
  const language = payload.language === "ar" ? "ar" : "en";
  const style = ["comprehensive", "key_points", "paragraph", "exam_prep"].includes(
    payload.style ?? "",
  )
    ? (payload.style as string)
    : "comprehensive";

  await report("preparing", 2);
  await prisma.document.update({ where: { id: job.documentId }, data: { status: "processing" } });

  const doc = await prisma.document.findUniqueOrThrow({ where: { id: job.documentId } });
  const assets = await loadAssets(job.documentId);

  const result = await runPipeline({
    assets,
    language,
    style,
    title: doc.title,
    storage: localPrivateStorage,
    onStage: report,
  });

  for (const transcript of result.transcripts) {
    const lastSegment = transcript.segments.at(-1);
    await prisma.sourceAsset.update({
      where: { id: transcript.assetId },
      data: {
        extractedText: transcript.segments.map((segment) => segment.text).join("\n\n"),
        metadata: {
          segments: transcript.segments.slice(0, 4000),
          durationSec: lastSegment?.end ?? 0,
        },
      },
    });
  }

  await report("saving", 97);
  await prisma.$transaction([
    prisma.summary.updateMany({
      where: { documentId: job.documentId, current: true },
      data: { current: false },
    }),
    prisma.summary.create({
      data: {
        documentId: job.documentId,
        userId: job.userId,
        language: result.content.language,
        style: style as SummaryStyle,
        content: result.content as unknown as object,
        model: result.model,
        promptVersion: result.promptVersion,
        coverageMetadata: {
          coverage: result.content.coverage,
          audit: result.coverageAudit,
        },
        sourceWordCount: result.sourceWords,
        summaryWordCount: result.summaryWords,
        current: true,
      },
    }),
  ]);

  await finish(jobId, job.documentId);
  await report("done", 100);
}

async function claimAndProcess(): Promise<void> {
  const job = await claimJob();
  if (!job) return;
  console.log(`[worker] processing job ${job.id} (attempt ${job.attempts}) document ${job.documentId}`);
  let heartbeatInProgress = false;
  const heartbeatTimer = setInterval(() => {
    if (heartbeatInProgress) return;
    heartbeatInProgress = true;
    void heartbeat(job.id)
      .catch((e) => {
        console.error(`[worker] heartbeat failed for job ${job.id}: ${e instanceof Error ? e.message : e}`);
      })
      .finally(() => {
        heartbeatInProgress = false;
      });
  }, 60_000);
  try {
    await processJob(job.id);
    console.log(`[worker] job ${job.id} done`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[worker] job ${job.id} failed: ${msg}`);
    await fail(job.id, job.documentId, msg, job.attempts < job.maxAttempts);
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function main(): Promise<void> {
  const interval = env().WORKER_POLL_INTERVAL_MS;
  console.log(`[worker] started (poll every ${interval}ms)`);
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      console.log(`[worker] ${sig} received — finishing current job, then exiting`);
      stopping = true;
    });
  }
  while (!stopping) {
    try {
      await claimAndProcess();
    } catch (e) {
      console.error(`[worker] loop error: ${e instanceof Error ? e.message : e}`);
    }
    if (stopping) break;
    await new Promise((r) => setTimeout(r, interval));
  }
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

main();
