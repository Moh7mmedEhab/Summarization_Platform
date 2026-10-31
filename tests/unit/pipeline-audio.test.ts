import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Storage } from "@/lib/storage/storage";

const gemini = vi.hoisted(() => ({
  interactionText: vi.fn(),
  transcribeAudio: vi.fn(),
}));

vi.mock("@/lib/ai/gemini/client", () => ({
  interactionText: gemini.interactionText,
  transcribeAudio: gemini.transcribeAudio,
  AiError: class AiError extends Error {},
}));

import { runPipeline } from "@/lib/ai/pipeline";

const summary = {
  title: "Lecture notes",
  language: "en",
  overview: "A brief overview.",
  sections: [{ heading: "Main idea", points: [{ text: "A grounded point." }] }],
  coverage: { analyzed: [], unreadable: [], possibleGaps: [] },
};

const storage: Storage = {
  async put() { return "test"; },
  async get() { return new Uint8Array(); },
  async stat() { return { size: 0 }; },
  async remove() {},
  pathOf() { return "test"; },
};

describe("audio pipeline source references", () => {
  beforeEach(() => {
    gemini.interactionText.mockReset();
    gemini.transcribeAudio.mockReset();
    gemini.transcribeAudio.mockResolvedValue([
      { start: 10, end: 15, text: "first phrase" },
      { start: 18.25, end: 20.5, text: "second phrase" },
    ]);
    gemini.interactionText
      .mockResolvedValueOnce(JSON.stringify({ notes: "analysis" }))
      .mockResolvedValueOnce(JSON.stringify(summary))
      .mockResolvedValueOnce(JSON.stringify({ analyzed: [], missing: [], wrong: [], unreadable: [] }));
  });

  it("preserves absolute transcript times in the analysis evidence", async () => {
    const result = await runPipeline({
      assets: [{
        id: "audio-1",
        kind: "audio",
        uri: "https://generativelanguage.googleapis.com/files/lecture",
        mime: "audio/mpeg",
        filename: "lecture.mp3",
        position: 0,
      }],
      language: "en",
      style: "comprehensive",
      title: "Lecture",
      storage,
      onStage: async () => {},
    });

    expect(gemini.transcribeAudio).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/files/lecture",
      "audio/mpeg",
    );
    expect(gemini.interactionText).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining("[10.00s-15.00s] first phrase"),
          }),
          expect.objectContaining({
            text: expect.stringContaining("[18.25s-20.50s] second phrase"),
          }),
        ]),
      }),
      expect.objectContaining({ retries: 1 }),
    );
    expect(gemini.interactionText.mock.calls[0]?.[0].input[0].text).toContain("lecture.mp3");
    expect(result.transcripts).toEqual([{
      assetId: "audio-1",
      segments: [
        { start: 10, end: 15, text: "first phrase" },
        { start: 18.25, end: 20.5, text: "second phrase" },
      ],
    }]);
    expect(result.sourceWords).toBe(4);
    expect(result.summaryWords).toBe(10);
  });

  it("numbers paragraph references across multiple text assets", async () => {
    gemini.interactionText.mockReset();
    gemini.interactionText
      .mockResolvedValueOnce(JSON.stringify({ notes: "first source" }))
      .mockResolvedValueOnce(JSON.stringify({ notes: "second source" }))
      .mockResolvedValueOnce(JSON.stringify(summary))
      .mockResolvedValueOnce(JSON.stringify({ analyzed: [], missing: [], wrong: [], unreadable: [] }));

    await runPipeline({
      assets: [
        {
          id: "text-1",
          kind: "text",
          filename: "first.txt",
          text: "First paragraph.\n\nSecond paragraph.",
          position: 0,
        },
        {
          id: "text-2",
          kind: "text",
          filename: "second.txt",
          text: "Third paragraph.",
          position: 1,
        },
      ],
      language: "en",
      style: "comprehensive",
      title: "Lecture",
      storage,
      onStage: async () => {},
    });

    expect(gemini.interactionText.mock.calls[1]?.[0].input[0].text).toContain(
      "Text material (paragraphs 3–3):",
    );
    expect(gemini.interactionText.mock.calls[1]?.[0].input[0].text).toContain(
      "second.txt ¶3–3",
    );
  });

  it("does not present a partial text count as the full count for binary sources", async () => {
    gemini.interactionText.mockReset();
    gemini.interactionText
      .mockResolvedValueOnce(JSON.stringify({ notes: "pdf analysis" }))
      .mockResolvedValueOnce(JSON.stringify(summary))
      .mockResolvedValueOnce(JSON.stringify({ analyzed: [], missing: [], wrong: [], unreadable: [] }));

    const result = await runPipeline({
      assets: [{
        id: "pdf-1",
        kind: "pdf",
        mime: "application/pdf",
        bytes: new Uint8Array([37, 80, 68, 70]),
        position: 0,
      }],
      language: "en",
      style: "comprehensive",
      title: "PDF source",
      storage,
      onStage: async () => {},
    });

    expect(result.sourceWords).toBeNull();
  });
});
