/**
 * tests/unit/storage-cleanup.test.ts
 *
 * Pure helpers for the storage cleanup task (lib/storage/cleanup.ts).
 */

import { describe, it, expect } from "vitest";
import {
  isOrphanCandidate,
  isGeminiCopyAgedOut,
  ORPHAN_MIN_AGE_MS,
  GEMINI_MIN_AGE_MS,
} from "@/lib/storage/cleanup";

const now = Date.now();

describe("isOrphanCandidate", () => {
  it("removes unreferenced files only after the safety margin", () => {
    const opts = {
      absPath: "/storage/u/a/b/file.pdf",
      referencedAbsPaths: new Set<string>(),
      mtimeMs: now - ORPHAN_MIN_AGE_MS - 1_000,
      nowMs: now,
    };
    expect(isOrphanCandidate(opts)).toBe(true);
  });

  it("keeps recent unreferenced files (safety margin)", () => {
    expect(
      isOrphanCandidate({
        absPath: "/storage/u/a/b/new.pdf",
        referencedAbsPaths: new Set(),
        mtimeMs: now - 10_000,
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("never removes referenced files regardless of age", () => {
    expect(
      isOrphanCandidate({
        absPath: "/storage/u/a/b/live.pdf",
        referencedAbsPaths: new Set(["/storage/u/a/b/live.pdf"]),
        mtimeMs: now - ORPHAN_MIN_AGE_MS * 10,
        nowMs: now,
      }),
    ).toBe(false);
  });
});

describe("isGeminiCopyAgedOut", () => {
  it("returns the file name only when past the 48h age", () => {
    const oldMetadata = {
      geminiFile: "files/abc123",
      geminiUploadedAt: new Date(now - GEMINI_MIN_AGE_MS - 1_000).toISOString(),
    };
    expect(isGeminiCopyAgedOut(oldMetadata, now)).toBe("files/abc123");
  });

  it("returns null for recent or missing recordings", () => {
    expect(
      isGeminiCopyAgedOut(
        { geminiFile: "files/abc", geminiUploadedAt: new Date(now - 60_000).toISOString() },
        now,
      ),
    ).toBeNull();
    expect(isGeminiCopyAgedOut(null, now)).toBeNull();
    expect(isGeminiCopyAgedOut({ geminiFile: "files/abc" }, now)).toBeNull();
    expect(
      isGeminiCopyAgedOut({ geminiFile: "f", geminiUploadedAt: "not-a-date" }, now),
    ).toBeNull();
  });
});
