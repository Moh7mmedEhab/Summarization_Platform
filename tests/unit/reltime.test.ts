import { describe, it, expect } from "vitest";
import { countWords, truncateWords, formatDuration } from "@/lib/ai/text";
import { relTime } from "@/lib/ai/reltime";

describe("Text & Audio Analysis Utils (lib/ai/text.ts & lib/ai/reltime.ts)", () => {
  describe("countWords", () => {
    it("returns 0 for empty or whitespace strings", () => {
      expect(countWords("")).toBe(0);
      expect(countWords("   \n\t ")).toBe(0);
    });

    it("counts English words accurately", () => {
      expect(countWords("Margins is an AI study platform.")).toBe(6);
      expect(countWords("state-of-the-art multi-word token")).toBe(3);
    });

    it("counts Arabic words accurately", () => {
      expect(countWords("منصة تلخيص المحاضرات والكتب")).toBe(4);
    });
  });

  describe("truncateWords", () => {
    it("returns original string if within limit", () => {
      expect(truncateWords("hello world", 5)).toBe("hello world");
    });

    it("truncates and adds ellipsis if exceeding limit", () => {
      expect(truncateWords("one two three four five", 3)).toBe("one two three…");
    });
  });

  describe("formatDuration", () => {
    it("formats sub-minute and minute durations as mm:ss", () => {
      expect(formatDuration(0)).toBe("00:00");
      expect(formatDuration(59)).toBe("00:59");
      expect(formatDuration(65)).toBe("01:05");
      expect(formatDuration(599)).toBe("09:59");
    });

    it("formats durations >= 1 hour as h:mm:ss", () => {
      expect(formatDuration(3600)).toBe("1:00:00");
      expect(formatDuration(3665)).toBe("1:01:05");
      expect(formatDuration(7325)).toBe("2:02:05");
    });
  });

  describe("relTime", () => {
    it("formats English relative times correctly", () => {
      const now = Date.now();
      expect(relTime(new Date(now - 10_000).toISOString(), "en")).toBe("just now");
      expect(relTime(new Date(now - 5 * 60_000).toISOString(), "en")).toBe("5m ago");
      expect(relTime(new Date(now - 2 * 3600_000).toISOString(), "en")).toBe("2h ago");
      expect(relTime(new Date(now - 3 * 86400_000).toISOString(), "en")).toBe("3d ago");
    });

    it("formats Arabic relative times correctly", () => {
      const now = Date.now();
      expect(relTime(new Date(now - 10_000).toISOString(), "ar")).toBe("للآن");
      expect(relTime(new Date(now - 5 * 60_000).toISOString(), "ar")).toBe("قبل 5 د");
      expect(relTime(new Date(now - 2 * 3600_000).toISOString(), "ar")).toBe("قبل 2 س");
      expect(relTime(new Date(now - 3 * 86400_000).toISOString(), "ar")).toBe("قبل 3 ي");
    });
  });
});
