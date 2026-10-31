import "dotenv/config";
import { claimJob, heartbeat, finish, fail, progress } from "@/lib/jobs/queue";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { localPrivateStorage } from "@/lib/storage/storage";
import { runPipeline, type PreparedAsset } from "@/lib/ai/pipeline";
import { saveSummaryForJob } from "@/lib/ai/save-summary";
import { uploadGeminiFile } from "@/lib/ai/gemini/client";
import { estimateAudioDuration } from "@/lib/upload/audio";
import type { SourceKind, SummaryStyle } from "@/generated/prisma/enums";

/** Audio over the configured duration limit, thrown with a number-backed message. */
class AudioLimitError extends Error {
  constructor(filename: string, seconds: number, maxSec: number) {
    super(
      `Recording "${filename}" is about ${Math.round(seconds / 60)} minutes long, over the ` +
        `${Math.round(maxSec / 60)}-minute limit. Trim or split the recording into parts.`,
    );
    this.name = "AudioLimitError";
  }
}

/**
 * Background worker for long-running summarization jobs.
 *   npm run worker
 * Claim loop: atomically FOR UPDATE SKIP LOCKED; heartbeat while working so a
 * crashed or lost worker's job is re-claimed (same attempt budget) later.
 */

let stopping = false;

/** Binary assets up to this size are inlined base64 into requests; larger ones go through the Files API. */
const MAX_INLINE_BYTES = 12 * 1024 * 1024;

/**
 * Loads assets ONE AT A TIME (sequential reads) so a multi-file document never
 * needs more than one file on disk in memory simultaneously. Binary assets
 * above MAX_INLINE_BYTES are uploaded to the Files API and referenced by URI,
 * so their bytes are released instead of being retained for every request.
 */
async function loadAssets(documentId: string, signal?: AbortSignal): Promise<PreparedAsset[]> {
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
        // Audio always uses the Files API; oversized binaries (PDF/image)
        // avoid huge inline base64 in every request.
        if (asset.assetType === "audio" || (asset.mimeType && bytes.byteLength > MAX_INLINE_BYTES && asset.assetType !== "text")) {
          // Duration gate BEFORE any upload to Gemini: refuse long recordings
          // with a clear message instead of burning a transcription budget.
          if (asset.assetType === "audio") {
            const maxSec = env().AUDIO_MAX_DURATION_SEC;
            const est = estimateAudioDuration(bytes);
            if (est !== null && est > maxSec) {
              throw new AudioLimitError(asset.originalFilename ?? asset.id, est, maxSec);
            }
          }
          if (!asset.mimeType) throw new Error(`Missing MIME type for stored asset ${asset.id}`);
          prepared.uri = await uploadGeminiFile(
            bytes,
            asset.mimeType,
            asset.originalFilename ?? asset.assetType,
            { signal },
          ); // `bytes` is a loop-local; after this iteration they are reclaimable
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

async function processJob(jobId: string, signal: AbortSignal): Promise<void> {
  // Progress is best-effort: a lost job row or transient DB hiccup must never
  // fail a healthy job. Every report is awaited, and its errors are swallowed.
  const report = async (stage: string, percent: number) => {
    try {
      await progress(jobId, { stage, percent });
    } catch (e) {
      console.error(`[worker] progress update failed for job ${jobId}: ${(e as Error).message}`);
    }
  };
  const job = await prisma.processingJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`job ${jobId} vanished (deleted with its document)`);
  const payload = (job.payload ?? {}) as SummarizePayload;
  const language = payload.language === "ar" ? "ar" : "en";
  const style = ["comprehensive", "key_points", "paragraph", "exam_prep"].includes(
    payload.style ?? "",
  )
    ? (payload.style as string)
    : "comprehensive";

  await report("preparing", 2);
  await prisma.document.updateMany({ where: { id: job.documentId }, data: { status: "processing" } });

  const doc = await prisma.document.findUnique({ where: { id: job.documentId } });
  if (!doc) throw new Error(`document ${job.documentId} vanished`);
  const assets = await loadAssets(job.documentId, signal);

  const result = await runPipeline({
    assets,
    language,
    style,
    title: doc.title,
    storage: localPrivateStorage,
    onStage: report,
    signal,
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
  await saveSummaryForJob({
    jobId: job.id,
    documentId: job.documentId,
    userId: job.userId,
    language: result.content.language,
    style: style as SummaryStyle,
    content: result.content,
    model: result.model,
    promptVersion: result.promptVersion,
    coverageMetadata: {
      coverage: result.content.coverage,
      audit: result.coverageAudit,
    },
    sourceWordCount: result.sourceWords,
    summaryWordCount: result.summaryWords,
  });

  await finish(jobId, job.documentId);
  await report("done", 100);
}

async function claimAndProcess(): Promise<void> {
  const job = await claimJob();
  if (!job) return;
  console.log(`[worker] processing job ${job.id} (attempt ${job.attempts}) document ${job.documentId}`);
  // Per-job abort: the signal is threaded into every Gemini call, so a timed
  // out job stops its provider work instead of burning tokens forever.
  const controller = new AbortController();
  const timeoutMs = env().JOB_TIMEOUT_MS;
  const timeout = setTimeout(() => {
    console.error(`[worker] job ${job.id} exceeded ${Math.round(timeoutMs / 1000)}s — aborting provider calls`);
    controller.abort(new Error(`job timed out after ${Math.round(timeoutMs / 1000)}s`));
  }, timeoutMs);
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
    await processJob(job.id, controller.signal);
    console.log(`[worker] job ${job.id} done`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[worker] job ${job.id} failed: ${msg}`);
    try {
      await fail(job.id, job.documentId, msg, job.attempts < job.maxAttempts);
    } catch (failError) {
      console.error(`[worker] fail() errored for job ${job.id}: ${(failError as Error).message}`);
    }
  } finally {
    clearInterval(heartbeatTimer);
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const interval = env().WORKER_POLL_INTERVAL_MS;
  console.log(`[worker] started (poll every ${interval}ms)`);
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      if (stopping) {
        // Second signal: the operator wants out NOW — force exit.
        console.log(`[worker] second ${sig} received — exiting immediately`);
        process.exit(1);
      }
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
