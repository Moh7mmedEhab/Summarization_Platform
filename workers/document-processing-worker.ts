import "dotenv/config";
import { claimJob, heartbeat, finish, fail, progress } from "@/lib/jobs/queue";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { localPrivateStorage } from "@/lib/storage/storage";
import { runPipeline, type PreparedAsset } from "@/lib/ai/pipeline";
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
        // Large PDFs go through the Files API (uri) instead of inline bytes.
        if (asset.assetType === "pdf" && bytes.byteLength > 12 * 1024 * 1024) {
          const blob = new Blob([bytes as BlobPart], { type: asset.mimeType ?? "application/pdf" });
          const client = (await import("@google/genai")).GoogleGenAI;
          const ai = new client({ apiKey: env().GEMINI_API_KEY });
          const uploaded = await ai.files.upload({
            file: blob,
            config: { mimeType: asset.mimeType ?? "application/pdf", displayName: asset.originalFilename ?? "document" },
          });
          // Wait until it's processed (Gemini files UPLOAD → state PROCESSING/ACTIVE)
          if (uploaded.name) {
            let info = uploaded;
            for (let i = 0; i < 24 && info.state === "PROCESSING"; i++) {
              await new Promise((r) => setTimeout(r, 5_000));
              info = await ai.files.get({ name: uploaded.name });
            }
            if (info.state === "FAILED") throw new Error("Gemini Files API processing failed");
            prepared.uri = info.uri;
          }
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

  const audioAsset = doc
    ? await prisma.sourceAsset.findFirst({
        where: { documentId: doc.id, assetType: "audio" },
        orderBy: { position: "asc" },
      })
    : null;

  const result = await runPipeline({
    assets,
    language,
    style,
    title: doc.title,
    storage: localPrivateStorage,
    onStage: report,
  });

  if (result.transcript?.length && audioAsset) {
    await prisma.sourceAsset.update({
      where: { id: audioAsset.id },
      data: {
        extractedText: result.transcript.map((s) => s.text).join("\n\n"),
        metadata: {
          segments: result.transcript.slice(0, 4000),
          durationSec: result.transcript[result.transcript.length - 1]?.end ?? 0,
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
          attemptedAudit: true,
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
  try {
    await processJob(job.id);
    console.log(`[worker] job ${job.id} done`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[worker] job ${job.id} failed: ${msg}`);
    await fail(job.id, job.documentId, msg, job.attempts < job.maxAttempts);
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
