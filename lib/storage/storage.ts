import path from "node:path";
import { promises as fs } from "node:fs";
import { env } from "@/lib/env";

/**
 * Private file storage. Files live outside the app tree under
 * `<STORAGE_DIR>/u/<userId>/<key>…` and are served only through authorized
 * routes — they are never static assets. The same interface allows swapping in
 * object storage (S3/GCS) for production without touching callers.
 */

export type Storage = {
  /** Store bytes; returns the storage key to persist in the DB. */
  put(key: string, bytes: Uint8Array | string): Promise<string>;
  get(key: string): Promise<Uint8Array>;
  /** Stream-friendly stats used by the download route. */
  stat(key: string): Promise<{ size: number }>;
  remove(key: string): Promise<void>;
  /** Absolute path for callers that need a real file (Gemini File API upload). */
  pathOf(key: string): string;
};

const root = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().STORAGE_DIR);

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
    await fs.writeFile(abs, bytes);
    return key;
  },
  async get(key) {
    return new Uint8Array(await fs.readFile(safePath(key)));
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
