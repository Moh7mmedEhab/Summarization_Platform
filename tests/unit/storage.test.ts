/**
 * tests/unit/storage.test.ts
 *
 * Unit tests for lib/storage/storage.ts
 * Covers: safePath traversal defenses + put/get/stat/remove roundtrips
 *
 * Uses an isolated temp directory so tests never touch real storage.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// We test the safePath logic directly by replicating it, and we test the
// storage operations by resetting modules + overriding STORAGE_DIR env.
// ---------------------------------------------------------------------------

// Mirror of safePath from storage.ts for isolated unit tests
function makeSafePath(root: string) {
  return function safePath(key: string): string {
    const abs = path.resolve(root, key);
    if (!abs.startsWith(root + path.sep)) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    return abs;
  };
}

describe("safePath() – path traversal defenses", () => {
  const root = "/tmp/margins_test_storage";
  const safePath = makeSafePath(root);

  it("../../etc/passwd → throws Unsafe storage key", () => {
    expect(() => safePath("../../etc/passwd")).toThrow(/Unsafe storage key/);
  });

  it("../outside → throws Unsafe storage key", () => {
    expect(() => safePath("../outside")).toThrow(/Unsafe storage key/);
  });

  it("/absolute/path/outside → throws Unsafe storage key", () => {
    // path.resolve('/tmp/margins_test_storage', '/absolute/path') = '/absolute/path'
    // which does NOT start with root + sep
    expect(() => safePath("/absolute/path/outside")).toThrow(/Unsafe storage key/);
  });

  it("u/../../../root → throws Unsafe storage key", () => {
    expect(() => safePath("u/../../../root")).toThrow(/Unsafe storage key/);
  });

  it("null-byte paths remain inside root (path.resolve treats \\x00 as literal)", () => {
    // On Linux, path.resolve treats \\x00 as a literal char in the path segment name.
    // So 'u/user\x00' stays as a literal subdirectory of root.
    // The path traversal with ../../ from 2 levels deep lands inside root.
    // This is NOT a vulnerability (the literal \\x00 is a valid dir name character).
    // Verify that the safePath does NOT throw for keys that resolve inside root:
    const key = "u/user\x00/docs/file.txt";
    // Should NOT throw — it's still inside root
    expect(() => safePath(key)).not.toThrow();
  });

  it("deep traversal with encoded separators resolves inside root (no escape)", () => {
    // URL-encoded slashes in keys don't get decoded by path.resolve
    const key = "u/user%2F..%2F..%2Fetc%2Fpasswd/file.txt";
    // This stays inside root as a literal key with % chars
    expect(() => safePath(key)).not.toThrow();
  });
});

describe("safePath() – happy paths", () => {
  const root = "/tmp/margins_test_storage";
  const safePath = makeSafePath(root);

  it("u/userId/document.pdf → resolves to absolute path inside root", () => {
    const result = safePath("u/userId/document.pdf");
    expect(result).toBe(path.join(root, "u/userId/document.pdf"));
    expect(result.startsWith(root + path.sep)).toBe(true);
  });

  it("u/abc123/deadbeef/uuid-filename.pdf → resolves correctly", () => {
    const result = safePath("u/abc123/deadbeef/some-uuid-filename.pdf");
    expect(result).toBe(path.join(root, "u/abc123/deadbeef/some-uuid-filename.pdf"));
  });
});

// ---------------------------------------------------------------------------
// Integration-style tests for localPrivateStorage operations
// (uses a real temp directory with vi.resetModules() to override STORAGE_DIR)
// ---------------------------------------------------------------------------
describe("localPrivateStorage – put/get/stat/remove roundtrip", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "margins-storage-test-"));
    // Set STORAGE_DIR to our temp dir BEFORE resetting modules
    process.env.STORAGE_DIR = tmpDir;
    // Reset module cache so env() and storage re-evaluate with new STORAGE_DIR
    vi.resetModules();
  });

  afterEach(async () => {
    process.env.STORAGE_DIR = "./storage/test_sandbox";
    vi.resetModules();
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  });

  it("put() stores bytes, get() retrieves them exactly", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");

    const testKey = "u/testuser/testdoc/test-file.txt";
    const testContent = new TextEncoder().encode("Hello, Margins storage test!");

    const returnedKey = await localPrivateStorage.put(testKey, testContent);
    expect(returnedKey).toBe(testKey);

    const retrieved = await localPrivateStorage.get(testKey);
    expect(retrieved).toEqual(testContent);
    expect(new TextDecoder().decode(retrieved)).toBe("Hello, Margins storage test!");
  });

  it("put() creates parent directories automatically", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");

    const deepKey = "u/user1/docA/nested/deep/file.bin";
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    await localPrivateStorage.put(deepKey, data);

    // Verify the file exists at the expected path
    const expectedPath = path.join(tmpDir, deepKey);
    const stat = await fs.stat(expectedPath);
    expect(stat.isFile()).toBe(true);
  });

  it("put() is atomic: no temp files linger next to the stored key", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");

    const key = "u/user1/docB/atomic.txt";
    await localPrivateStorage.put(key, new TextEncoder().encode("atomically stored"));

    const siblings = await fs.readdir(path.join(tmpDir, "u/user1/docB"));
    expect(siblings).toEqual(["atomic.txt"]); // no ".tmp-…" leftovers after rename
  });

  it("readStream() yields the stored content (streaming read)", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");
    const { Readable } = await import("node:stream");

    const key = "u/user1/docC/stream.bin";
    const content = new Uint8Array([10, 20, 30, 40, 50]);
    await localPrivateStorage.put(key, content);

    const stream = await localPrivateStorage.readStream(key);
    expect(stream).toBeInstanceOf(Readable);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const bytes = new Uint8Array(Buffer.concat(chunks));
    expect(Array.from(bytes)).toEqual(Array.from(content));
  });

  it("stat() returns correct file size", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");

    const content = "Size test content — exact byte count matters";
    const encoded = new TextEncoder().encode(content);
    const key = "u/user1/docB/size-test.txt";

    await localPrivateStorage.put(key, encoded);
    const { size } = await localPrivateStorage.stat(key);

    expect(size).toBe(encoded.byteLength);
  });

  it("remove() deletes the file", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");

    const key = "u/user1/docC/to-delete.txt";
    const data = new TextEncoder().encode("delete me");

    await localPrivateStorage.put(key, data);

    // Verify it exists first
    const expectedPath = path.join(tmpDir, key);
    await expect(fs.access(expectedPath)).resolves.toBeUndefined();

    // Now remove
    await localPrivateStorage.remove(key);

    // Verify it's gone
    await expect(fs.access(expectedPath)).rejects.toThrow();
  });

  it("remove() does not throw on non-existent file (force: true)", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");
    await expect(
      localPrivateStorage.remove("u/user1/docD/nonexistent.txt")
    ).resolves.toBeUndefined();
  });

  it("get() on path traversal key throws Unsafe storage key", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");
    await expect(
      localPrivateStorage.get("../../etc/passwd")
    ).rejects.toThrow(/Unsafe storage key/);
  });

  it("put() on path traversal key throws Unsafe storage key", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");
    await expect(
      localPrivateStorage.put("../../evil/inject.txt", new Uint8Array([1]))
    ).rejects.toThrow(/Unsafe storage key/);
  });

  it("stat() on path traversal key throws Unsafe storage key", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");
    await expect(
      localPrivateStorage.stat("../outside")
    ).rejects.toThrow(/Unsafe storage key/);
  });

  it("pathOf() on traversal key throws Unsafe storage key", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");
    expect(() => localPrivateStorage.pathOf("../../secret")).toThrow(/Unsafe storage key/);
  });

  it("roundtrip: put string content, get bytes back", async () => {
    const { localPrivateStorage } = await import("@/lib/storage/storage");
    const key = "u/user2/docE/string-content.txt";
    const content = "String content written as string type";

    await localPrivateStorage.put(key, content);
    const retrieved = await localPrivateStorage.get(key);

    // fs.writeFile writes string as UTF-8 by default
    expect(new TextDecoder().decode(retrieved)).toBe(content);
  });
});
