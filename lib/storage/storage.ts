import path from "node:path";
import { promises as fs, createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import { env } from "@/lib/env";

/**
 * Private file storage. Files live outside the app tree under
 * `<STORAGE_DIR>/u/<userId>/<key>…` (STORAGE_DIR resolved absolute in
 * lib/env.ts, so web+worker agree on the root) and are served only through
 * authorized routes — they are never static assets. The same interface allows
 * swapping in object storage (S3/GCS) for production without touching callers.
 */

export type Storage = {
  /** Store bytes atomically (temp file → rename); returns the key for the DB. */
  put(key: string, bytes: Uint8Array | string): Promise<string>;
  get(key: string): Promise<Uint8Array>;
  /** Streaming read for large files (download route) — node Readable. */
  readStream(key: string): Promise<Readable>;
  /** Stream-friendly stats used by the download route. */
  stat(key: string): Promise<{ size: number }>;
  remove(key: string): Promise<void>;
  /** Absolute path for callers that need a real file (Gemini File API upload). */
  pathOf(key: string): string;
};

const root = () => env().STORAGE_DIR;

/** Reject path traversal; every key must resolve inside the storage root. */
function safePath(key: string): string {
  const abs = path.resolve(/*turbopackIgnore: true*/ root(), key);
  if (!abs.startsWith(root() + path.sep)) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return abs;
}

export const localPrivateStorage: Storage = {
  async put(key, bytes) {
    const abs = safePath(key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    // Atomic: write to a temp file in the same directory, then rename. A
    // crash/interrupted write can never leave a truncated file at the key.
    const tmp = `${abs}.tmp-${crypto.randomUUID()}`;
    try {
      await fs.writeFile(tmp, bytes);
      await fs.rename(tmp, abs);
    } catch (e) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw e;
    }
    return key;
  },
  async get(key) {
    return new Uint8Array(await fs.readFile(safePath(key)));
  },
  async readStream(key) {
    return createReadStream(safePath(key));
  },
  async stat(key) {
    const s = await fs.stat(safePath(key));
    return { size: s.size };
  },
  async remove(key) {
    await fs.rm(safePath(key), { force: true });
  },
  pathOf(key) {
    return safePath(key);
  },
};

export const storage: Storage = localPrivateStorage;

/** u/<userId>/<random>/<safe-name> — no user input survives uncontrolled. */
export function userStorageKey(userId: string, documentId: string, filename: string): string {
  const base = filename.replace(/[^\w.\- ]+/g, "_").slice(0, 180);
  return path.posix.join("u", userId, documentId, `${crypto.randomUUID()}-${base}`);
}
