import path from "node:path";
import { promises as fs } from "node:fs";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

/**
 * Storage cleanup helpers. Two orphans exist:
 *  1. local files under STORAGE_DIR no longer referenced by SourceAsset.storageKey
 *  2. Gemini Files API copies (recorded in asset metadata) older than ~48h —
 *     the API purges them itself, but an explicit delete keeps accounts tidy.
 */

/** A local file is removable when unreferenced and older than this safety margin. */
export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;
/** Gemini Files API copies are removed once past this age. */
export const GEMINI_MIN_AGE_MS = 48 * 60 * 60 * 1000;

/** Pure: should this on-disk file be treated as an orphan? */
export function isOrphanCandidate(opts: {
  absPath: string;
  referencedAbsPaths: Set<string>;
  mtimeMs: number;
  nowMs: number;
}): boolean {
  if (opts.referencedAbsPaths.has(opts.absPath)) return false;
  return opts.nowMs - opts.mtimeMs >= ORPHAN_MIN_AGE_MS;
}

/** Absolute path under the storage root for a DB key (mirrors storage.ts). */
export function absPathOfKey(key: string): string {
  return path.resolve(env().STORAGE_DIR, key);
}

/** Walk the storage root; yields every file's absolute path. */
export async function* walkStorageFiles(root: string): AsyncGenerator<string> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walkStorageFiles(abs);
    } else if (entry.isFile()) {
      yield abs;
    }
  }
}

/** Pure: is a recorded Gemini Files API copy old enough to delete? */
export function isGeminiCopyAgedOut(metadata: unknown, nowMs: number): string | null {
  const m = metadata as { geminiFile?: string; geminiUploadedAt?: string } | null;
  if (!m?.geminiFile || !m.geminiUploadedAt) return null;
  const uploadedAt = Date.parse(m.geminiUploadedAt);
  if (!Number.isFinite(uploadedAt)) return null;
  return nowMs - uploadedAt >= GEMINI_MIN_AGE_MS ? m.geminiFile : null;
}

export type CleanupReport = {
  removedOrphans: string[];
  removedGemini: string[];
  errors: string[];
};

/**
 * Run the cleanup:
 *  - every SourceAsset.storageKey (and mail-outbox) is referenced; other files
 *    under the root older than the safety margin are removed;
 *  - every aged-out geminiFile recorded in SourceAsset.metadata is deleted via
 *    the Files API.
 */
export async function cleanupStorage(): Promise<CleanupReport> {
  const report: CleanupReport = { removedOrphans: [], removedGemini: [], errors: [] };
  const nowMs = Date.now();

  // ---- Gemini Files API copies recorded on assets ----
  const assets: Array<{ storageKey: string | null; metadata: unknown }> =
    await prisma.sourceAsset.findMany({ select: { storageKey: true, metadata: true } });
  const referenced = new Set<string>();
  const geminiFiles = new Set<string>();
  for (const asset of assets) {
    if (asset.storageKey) referenced.add(absPathOfKey(asset.storageKey));
    const geminiFile = isGeminiCopyAgedOut(asset.metadata, nowMs);
    if (geminiFile) geminiFiles.add(geminiFile);
  }

  // ---- local orphans (skip the dev mail outbox) ----
  const root = env().STORAGE_DIR;
  const outboxDir = path.resolve(root, "mail-outbox");
  for await (const abs of walkStorageFiles(root)) {
    if (abs.startsWith(outboxDir + path.sep)) continue;
    try {
      const stat = await fs.stat(abs);
      if (isOrphanCandidate({ absPath: abs, referencedAbsPaths: referenced, mtimeMs: stat.mtimeMs, nowMs })) {
        await fs.rm(abs, { force: true });
        report.removedOrphans.push(abs);
      }
    } catch (e) {
      report.errors.push(`${abs}: ${(e as Error).message}`);
    }
  }

  // ---- aged Gemini copies ----
  if (geminiFiles.size > 0) {
    const hasKey = process.env.GEMINI_API_KEY?.length ?? 0 > 0;
    if (hasKey) {
      const { genai } = await import("@/lib/ai/gemini/client");
      const client = genai();
      for (const name of geminiFiles.keys()) {
        try {
          await client.files.delete({ name });
          report.removedGemini.push(name);
        } catch (e) {
          report.errors.push(`gemini ${name}: ${(e as Error).message}`);
        }
      }
    } else {
      report.errors.push(`GEMINI_API_KEY not set — skipped ${geminiFiles.size} aged Gemini copies`);
    }
  }

  return report;
}
