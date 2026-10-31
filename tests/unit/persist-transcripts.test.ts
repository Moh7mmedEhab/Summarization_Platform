/**
 * tests/unit/persist-transcripts.test.ts
 *
 * Honest truncation metadata for finished transcripts (lib/ai/persist-transcripts.ts).
 */

import { describe, it, expect } from "vitest";
import { transcriptMetadata, TRANSCRIPT_METADATA_CAP } from "@/lib/ai/persist-transcripts";
import type { TranscriptSegment } from "@/lib/ai/gemini/client";

const segment = (i: number): TranscriptSegment => ({ start: i, end: i + 1, text: `seg ${i}` });

describe("transcriptMetadata", () => {
  it("keeps short transcripts verbatim with no truncation flags", () => {
    const segments = [segment(0), segment(1)];
    const meta = transcriptMetadata(segments);
    expect(meta.segments).toHaveLength(2);
    expect(meta.truncated).toBeUndefined();
    expect(meta.segmentCount).toBeUndefined();
    expect(meta.durationSec).toBe(2);
  });

  it("records truncated: true and the original count when segments exceed the cap", () => {
    const segments = Array.from({ length: TRANSCRIPT_METADATA_CAP + 37 }, (_, i) => segment(i));
    const meta = transcriptMetadata(segments);
    expect(meta.segments).toHaveLength(TRANSCRIPT_METADATA_CAP);
    expect(meta.truncated).toBe(true);
    expect(meta.segmentCount).toBe(TRANSCRIPT_METADATA_CAP + 37);
    expect(meta.droppedSegments).toBe(37);
    expect(meta.durationSec).toBe(TRANSCRIPT_METADATA_CAP + 37); // last END, not the cut one
  });
});
