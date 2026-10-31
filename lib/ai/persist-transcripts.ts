import { prisma } from "@/lib/db/prisma";
import type { TranscriptSegment } from "@/lib/ai/gemini/client";

/**
 * How many transcript segments are persisted in the asset's metadata JSON.
 * Segments beyond this cap are DROPPED from metadata — recorded honestly via
 * `truncated: true` + the original count, never silently.
 */
export const TRANSCRIPT_METADATA_CAP = 4000;

/** Pure: what an asset's metadata should record for its finished transcript. */
export function transcriptMetadata(segments: TranscriptSegment[]): {
  segments: TranscriptSegment[];
  durationSec: number;
  truncated?: boolean;
  segmentCount?: number;
  droppedSegments?: number;
} {
  const storedSegments = segments.slice(0, TRANSCRIPT_METADATA_CAP);
  const dropped = segments.length - storedSegments.length;
  return {
    segments: storedSegments,
    durationSec: segments.at(-1)?.end ?? 0,
    ...(dropped > 0
      ? {
          truncated: true,
          segmentCount: segments.length,
          droppedSegments: dropped,
        }
      : {}),
  };
}

/**
 * Persist finished transcripts onto their assets: the FULL transcript in
 * extractedText, plus bounded metadata with honest truncation flags.
 */
export async function persistTranscripts(
  transcripts: Array<{ assetId: string; segments: TranscriptSegment[] }>,
): Promise<void> {
  for (const transcript of transcripts) {
    await prisma.sourceAsset.update({
      where: { id: transcript.assetId },
      data: {
        extractedText: transcript.segments.map((segment) => segment.text).join("\n\n"),
        metadata: transcriptMetadata(transcript.segments),
      },
    });
  }
}
