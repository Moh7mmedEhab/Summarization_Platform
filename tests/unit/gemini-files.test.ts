import { beforeEach, describe, expect, it, vi } from "vitest";

const filesApi = vi.hoisted(() => ({
  upload: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    files = filesApi;
    interactions = { create: vi.fn() };
  },
}));

import { uploadGeminiFile } from "@/lib/ai/gemini/client";

describe("Gemini Files API uploads", () => {
  beforeEach(() => {
    filesApi.upload.mockReset();
    filesApi.get.mockReset();
  });

  it("uploads audio and returns its URI", async () => {
    filesApi.upload.mockResolvedValue({
      name: "files/lecture",
      uri: "https://generativelanguage.googleapis.com/files/lecture",
      state: "ACTIVE",
    });

    await expect(
      uploadGeminiFile(new Uint8Array([1, 2, 3]), "audio/mpeg", "lecture.mp3"),
    ).resolves.toBe("https://generativelanguage.googleapis.com/files/lecture");

    expect(filesApi.upload).toHaveBeenCalledWith({
      file: expect.any(Blob),
      config: { mimeType: "audio/mpeg", displayName: "lecture.mp3" },
    });
  });

  it("waits for processing and rejects failed uploads", async () => {
    vi.useFakeTimers();
    try {
      filesApi.upload.mockResolvedValue({
        name: "files/lecture",
        state: "PROCESSING",
      });
      filesApi.get.mockResolvedValue({
        name: "files/lecture",
        uri: "https://generativelanguage.googleapis.com/files/lecture",
        state: "ACTIVE",
      });

      const upload = uploadGeminiFile(new Uint8Array([1]), "audio/mpeg", "lecture.mp3");
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(upload).resolves.toBe("https://generativelanguage.googleapis.com/files/lecture");
      expect(filesApi.get).toHaveBeenCalledWith({
        name: "files/lecture",
        config: { abortSignal: undefined },
      });

      filesApi.upload.mockResolvedValue({
        name: "files/broken",
        state: "FAILED",
      });
      await expect(
        uploadGeminiFile(new Uint8Array([1]), "audio/mpeg", "broken.mp3"),
      ).rejects.toThrow("Gemini Files API processing failed");
    } finally {
      vi.useRealTimers();
    }
  });
});
