import type { Storage } from "@/lib/storage/storage";
import type { InteractionPart } from "@/lib/ai/gemini/client";
import {
  interactionText,
  transcribeAudio,
  AiError,
  type TranscriptSegment,
} from "@/lib/ai/gemini/client";
import {
  ANALYZE_SYSTEM,
  COMPOSE_SYSTEM,
  COVERAGE_SYSTEM,
  COVERAGE_PROMPT,
  PROMPT_VERSION,
  RECOVERY_SYSTEM,
  styleDirective,
} from "@/lib/ai/prompts";
import { SummaryContent, type SummaryContentT } from "@/lib/ai/schema";
import { countSummaryWords, countWords } from "@/lib/ai/text";
import type { SourceKind } from "@/generated/prisma/enums";

/**
 * The summarization pipeline:
 *   prepare → transcribe (audio) → analyze parts/chunks → compose → coverage
 * audit → gap recovery → validated structured content.
 * Never one giant hope-it-fits request for long sources: text and transcripts
 * are chunked, each chunk analyzed independently, then composed and audited.
 */

export type PreparedAsset = {
  id: string;
  kind: SourceKind;
  mime?: string;
  filename?: string;
  position: number;
  /** extracted/plain text (txt, docx, pasted text, transcript) */
  text?: string;
  /** inline bytes for pdf/image */
  bytes?: Uint8Array;
  /** transcript segments for audio assets */
  segments?: TranscriptSegment[];
  /** Files API URI for audio and large PDFs. */
  uri?: string;
};

export type PipelineResult = {
  content: SummaryContentT;
  model: string;
  promptVersion: string;
  sourceWords: number | null;
  summaryWords: number;
  transcripts: Array<{ assetId: string; segments: TranscriptSegment[] }>;
  coverageAudit: { completed: boolean; error?: string; recoveryError?: string };
};

type Ctx = {
  onStage: (stage: string, percent: number) => Promise<void>;
}

const MAX_TEXT_CHARS = 18_000;        // per analyze chunk
const TRANSCRIPT_MAX_CHARS = 24_000;  // per transcript chunk

/** Split long running text into paragraph-boundary chunks with global offsets. */
function chunkText(text: string, max: number): Array<{ chunk: string; startPara: number; paraCount: number }> {
  const paras = text.split(/\n{2,}|(?=\n) {0,}/).map((p) => p.trim()).filter(Boolean);
  const startParaChunks: Array<{ chunk: string; startPara: number; paraCount: number }> = [];
  let i = 0;
  while (i < paras.length) {
    let buf: string[] = [];
    let bytes = 0;
    let j = i;
    while (j < paras.length && bytes < max) {
      const next = paras[j];
      if (bytes + next.length + 2 > max && buf.length > 0) break;
      buf.push(next);
      bytes += next.length + 2;
      j++;
    }
    startParaChunks.push({ chunk: buf.join("\n\n"), startPara: i + 1, paraCount: buf.length });
    i = j > i ? j : i + 1;
  }
  return startParaChunks;
}

function groupSegments(segments: TranscriptSegment[], maxChars: number) {
  const groups: Array<{ segments: TranscriptSegment[]; tStart: number; tEnd: number }> = [];
  let buf: TranscriptSegment[] = [];
  let chars = 0;
  let first: TranscriptSegment | null = null;
  let last: TranscriptSegment | null = null;
  const flush = () => {
    if (!buf.length) return;
    groups.push({
      segments: buf,
      tStart: first?.start ?? 0,
      tEnd: last?.end ?? 0,
    });
    buf = [];
    chars = 0;
    first = null;
    last = null;
  };
  for (const seg of segments) {
    if (chars + seg.text.length + 2 > maxChars && buf.length > 0) flush();
    buf.push(seg);
    chars += seg.text.length + 2;
    first = first ?? seg;
    last = seg;
  }
  flush();
  return groups;
}

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Format a transcript group with per-segment global timestamps. */
function formatTranscript(groups: ReturnType<typeof groupSegments>): Array<{ chunk: string; label: string }> {
  return groups.map((g) => {
    const lines = g.segments.map(
      (segment) => `[${segment.start.toFixed(2)}s-${segment.end.toFixed(2)}s] ${segment.text}`,
    );
    return {
      chunk: lines.join("\n\n"),
      label: `Recording ${mmss(g.tStart)}–${mmss(g.tEnd)}`,
    };
  });
}

async function putInline(
  storage: Storage,
  asset: PreparedAsset,
): Promise<InteractionPart[]> {
  if (asset.kind === "pdf" && asset.uri && asset.mime) {
    return [{ type: "document", uri: asset.uri, mime_type: asset.mime }];
  }
  if (!asset.bytes || !asset.mime) return [];
  const b64 = Buffer.from(asset.bytes).toString("base64");
  if (asset.kind === "pdf") return [{ type: "document", data: b64, mime_type: asset.mime }];
  if (asset.kind === "image") return [{ type: "image", data: b64, mime_type: asset.mime }];
  return [];
}

type AnalyzeInputArg = {
  parts: string[]; // human context header lines
  inline: InteractionPart[];
  label: string;
  transcript?: string;
};

async function analyzePart(
  arg: AnalyzeInputArg,
  language: "en" | "ar",
  style: string,
  ctx: Ctx,
  partIdx: number,
  partCount: number,
): Promise<string> {
  await ctx.onStage(`analyzing (${partIdx + 1}/${partCount})`, 5 + (partIdx / partCount) * 50);
  const header = arg.parts.join("\n");
  const body = [
    `Material part label: ${arg.label}${arg.transcript ? "" : ""}`,
    header,
    arg.transcript ? `LECTURER TRANSCRIPT SECTION:\n${arg.transcript}` : "",
  ].filter(Boolean).join("\n\n");

  const prompt = [
    `Analyze the material part "${arg.label}" (${partIdx + 1} of ${partCount}).`,
    `Part may include earlier/later continuation of the same lesson — treat references as GLOBAL (page/paragraph numbers already global).`,
    body,
    styleDirective(style).replace('content field', ''),
  ].join("\n\n");

  return interactionText(
    {
      system: ANALYZE_SYSTEM,
      input: [...arg.inline, { type: "text", text: prompt }],
      json: true,
      maxOutputTokens: 16_000,
    },
    { retries: 1 },
  );
}

function parseJsonOrThrow(raw: string, stage: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new AiError(`${stage}: model produced invalid JSON`);
  }
}

export async function runPipeline(opts: {
  assets: PreparedAsset[];
  language: "en" | "ar";
  style: string;
  title: string;
  storage: Storage;
  onStage: Ctx["onStage"];
}): Promise<PipelineResult> {
  const { assets, storage, onStage, language, style, title } = opts;
  const ctx: Ctx = { onStage };

  await onStage("preparing", 3);

  // ---- audio → transcript (global timestamps kept) ----
  const audioAssets = assets.filter((asset) => asset.kind === "audio");
  if (audioAssets.some((asset) => !asset.uri || !asset.mime)) {
    throw new AiError("A lecture recording could not be uploaded for transcription");
  }
  const transcriptAssets = audioAssets.filter(
    (asset): asset is PreparedAsset & { kind: "audio"; uri: string; mime: string } =>
      Boolean(asset.uri && asset.mime),
  );
  const writtenAssets = assets.filter((a) => a.kind !== "audio");

  const transcripts: PipelineResult["transcripts"] = [];
  for (const asset of transcriptAssets) {
    await onStage("transcribing lecture", 8);
    try {
      const segments = await transcribeAudio(asset.uri, asset.mime);
      if (segments.length === 0) {
        throw new Error("No timestamped speech was returned for this recording");
      }
      transcripts.push({
        assetId: asset.id,
        segments,
      });
    } catch (e) {
      throw new AiError(
        `Lecture transcription failed: ${(e as Error).message}. ` +
          `If this warning is irrelevant, remove the recording or use a supported format.`,
      );
    }
  }

  // Binary PDF/image content is analyzed remotely and cannot be counted exactly here.
  const knownSourceWords =
    assets.reduce((n, a) => n + countWords(a.text ?? ""), 0) +
    transcripts.reduce(
      (n, transcript) => n + transcript.segments.reduce((sum, segment) => sum + countWords(segment.text), 0),
      0,
    );
  const hasUncountedBinarySource = assets.some(
    (asset) => (asset.kind === "pdf" || asset.kind === "image") && !asset.text,
  );
  const sourceWords = hasUncountedBinarySource ? null : knownSourceWords;

  // ---- gather analyze parts ----
  type Part = AnalyzeInputArg;
  const parts: Part[] = [];
  let nextParagraph = 1;
  let nextImage = 1;

  for (const asset of writtenAssets) {
    if (asset.kind === "text" && asset.text) {
      const chunks = chunkText(asset.text, MAX_TEXT_CHARS);
      for (const c of chunks) {
        const startPara = nextParagraph + c.startPara - 1;
        parts.push({
          parts: [
            `Source: "${title}"`,
            `Paragraph numbering is GLOBAL across the whole material.`,
            `Text material (paragraphs ${startPara}–${startPara + c.paraCount - 1}):`,
          ],
          inline: [],
          label: `${asset.filename ?? "Pasted text"} ¶${startPara}–${startPara + c.paraCount - 1}`,
          transcript: c.chunk,
        });
      }
      nextParagraph += chunks.reduce((count, chunk) => count + chunk.paraCount, 0);
    } else if (asset.kind === "pdf" || asset.kind === "image" || asset.kind === "docx") {
      const inline = await putInline(storage, asset);
      if (asset.kind === "docx") {
        // docx bytes are a zip container; the extracted text already lives in asset.text
        const chunks = chunkText(asset.text ?? "", MAX_TEXT_CHARS);
        if (chunks.length === 0) {
          throw new AiError(`No readable text was extracted from ${asset.filename ?? "a DOCX source"}`);
        }
        for (const c of chunks) {
          const startPara = nextParagraph + c.startPara - 1;
          parts.push({
            parts: [
              `Source: "${title}" (DOCX).`,
              `Paragraph numbering is GLOBAL across the whole material.`,
              `Text material (paragraphs ${startPara}–${startPara + c.paraCount - 1}):`,
              "Meta info: DOCX comments were extracted from the file.",
            ],
            inline: [],
            label: `${asset.filename ?? "document"} ¶${startPara}–${startPara + c.paraCount - 1}`,
            transcript: c.chunk,
          });
        }
        nextParagraph += chunks.reduce((count, chunk) => count + chunk.paraCount, 0);
      } else {
        if (inline.length === 0) {
          throw new AiError(`Source content could not be loaded for ${asset.filename ?? asset.kind}`);
        }
        const reference = asset.kind === "image"
          ? `Reference numbering: this is image ${nextImage++} (1-based in source order).`
          : `Reference numbering: PDF pages are 1-based within this file; include "${asset.filename ?? "source PDF"}" in page-reference labels.`;
        parts.push({
          parts: [`Source: "${title}".`, reference],
          inline,
          label: asset.filename ?? asset.kind,
        });
      }
    }
  }

  // Recorded lecture: transcript chunks (timestamps are seconds, global)
  for (const transcript of transcripts) {
    const asset = transcriptAssets.find((candidate) => candidate.id === transcript.assetId);
    const label = (asset?.filename ?? "lecture recording").slice(0, 160);
    for (const group of formatTranscript(groupSegments(transcript.segments, TRANSCRIPT_MAX_CHARS))) {
      parts.push({
        parts: [
          `Source: "${title}" — ${label}.`,
          `Reference numbering: each transcript line gives its absolute start and end time in seconds from this recording.`,
          `Use only the explicit timestamp ranges shown on transcript lines; do not infer timestamps from line order or section labels.`,
        ],
        inline: [],
        label: `${label} ${group.label}`,
        transcript: group.chunk,
      });
    }
  }

  if (parts.length === 0) {
    throw new AiError("Nothing analyzable: provide text, a readable document, images, or a recording.");
  }

  // ---- analyze parts (sequential; each marks progress) ----
  const partOutputs: Array<{ label: string; output: string }> = [];
  for (let i = 0; i < parts.length; i++) {
    const out = await analyzePart(parts[i], language, style, ctx, i, parts.length);
    parseJsonOrThrow(out, `analyze part ${i + 1}`);
    partOutputs.push({ label: parts[i].label, output: out });
  }

  // ---- compose ----
  await ctx.onStage("composing notes", 62);
  const composedRaw = await interactionText(
    {
      system: COMPOSE_SYSTEM.replace("%LANG%", language),
      input: [
        {
          type: "text",
          text: [
            `Requested output language: ${language}. Material title provided by the student: "${title}".`,
            `Part-notes (${partOutputs.length}) to merge, in source order:`,
            ...partOutputs.map((p) => `### part: ${p.label}\n${p.output}`),
          ].join("\n\n"),
        },
      ],
      json: true,
      maxOutputTokens: 32_000,
    },
    { retries: 1 },
  );
  const composed = SummaryContent.parse(parseJsonOrThrow(composedRaw, "compose"));
  // The requested language is authoritative (schema only catches bad echoes).
  composed.language = language;
  // keep the student's title as the document title; the notes title stays the model's
  // but a stale/empty one gets repaired to the student's title
  if (!composed.title || composed.title.length < 2) composed.title = title;

  // ---- coverage audit ----
  await ctx.onStage("auditing coverage", 76);
  const sourceDigest = parts
    .map((part) => {
      if (!part.transcript) return "";
      const text = part.transcript;
      if (text.length <= 2_000) return `### ${part.label}\n${text}`;
      const marker = "\n[...]\n";
      const excerptSize = Math.floor((2_000 - marker.length * 2) / 3);
      const middleStart = Math.floor((text.length - excerptSize) / 2);
      return [
        `### ${part.label}`,
        text.slice(0, excerptSize),
        marker,
        text.slice(middleStart, middleStart + excerptSize),
        marker,
        text.slice(-excerptSize),
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n----\n");
  const auditLimitations: string[] = [];
  if (parts.some((part) => part.inline.length > 0)) {
    auditLimitations.push("Binary PDF/image parts are not included in the coverage audit.");
  }
  if (parts.some((part) => (part.transcript?.length ?? 0) > 2_000)) {
    auditLimitations.push("Long text parts are represented by excerpts in the coverage audit.");
  }
  let audit: {
    missing?: Array<{ topic: string; detail?: string; where?: string }>;
    wrong?: Array<{ issue: string }>;
    unreadable?: string[];
    analyzed?: string[];
  } = {};
  let auditRaw: string | null = null;
  let auditCompleted = false;
  let auditError: string | undefined;
  let recoveryError: string | undefined;
  if (!sourceDigest) {
    auditError = "Coverage audit skipped because no text or transcript excerpts were available.";
  } else {
    try {
      auditRaw = await interactionText(
        {
          system: COVERAGE_SYSTEM,
          input: [
            {
              type: "text",
              text: [
                `DRAFT NOTES JSON:\n${JSON.stringify(composed).slice(0, 20_000)}`,
                `SOURCE MATERIAL DIGEST (verbatim excerpts):\n${sourceDigest}`,
                COVERAGE_PROMPT,
              ].join("\n\n"),
            },
          ],
          json: true,
          maxOutputTokens: 8_000,
        },
        { retries: 1 },
      );
      audit = JSON.parse(auditRaw);
      auditCompleted = auditLimitations.length === 0;
      if (auditLimitations.length > 0) auditError = auditLimitations.join(" ");
    } catch (e) {
      auditError = e instanceof Error ? e.message : String(e);
      console.error(`[ai] coverage audit failed: ${auditError}`);
    }
  }
  if (auditError && !auditCompleted) {
    console.warn(`[ai] coverage audit incomplete: ${auditError}`);
  }

  // ---- gap recovery (only when the audit found material) ----
  let final = composed;
  const missing = audit.missing?.length ?? 0;
  const wrongFound = audit.wrong?.length ?? 0;
  if (missing > 0) {
    await ctx.onStage("recovering gaps", 84);
    try {
      const recoveryRaw = await interactionText(
        {
          system: RECOVERY_SYSTEM,
          input: [
            {
              type: "text",
              text: [
                `DRAFT NOTES:\n${JSON.stringify(composed)}`,
                `AUDIT REPORT:\n${JSON.stringify({ missing, wrong: audit.wrong, unreadable: audit.unreadable })}`,
                `SOURCE MATERIAL DIGEST:\n${sourceDigest}`,
                `Requested output language: ${language}`,
              ].join("\n\n"),
            },
          ],
          json: true,
          maxOutputTokens: 32_000,
        },
        { retries: 1 },
      );
      const repaired = SummaryContent.safeParse(parseJsonOrThrow(recoveryRaw, "recovery"));
      if (repaired.success) final = repaired.data;
      else recoveryError = "Recovery response did not satisfy the summary schema";
    } catch (e) {
      recoveryError = e instanceof Error ? e.message : String(e);
      console.error(`[ai] gap recovery failed: ${recoveryError}`);
    }
  } else if (wrongFound > 0 || (audit.unreadable?.length ?? 0) > 0) {
    // No missing content, but wrong statements flagged → still run recovery once
    await ctx.onStage("correcting", 84);
    try {
      const recoveryRaw = await interactionText(
        {
          system: RECOVERY_SYSTEM,
          input: [
            { type: "text", text: `DRAFT NOTES:\n${JSON.stringify(composed)}\n\nAUDIT REPORT:\n${JSON.stringify({ wrong: audit.wrong, unreadable: audit.unreadable })}\n\nSOURCE DIGEST:\n${sourceDigest}\n\nOutput language: ${language}` },
          ],
          json: true,
          maxOutputTokens: 32_000,
        },
        { retries: 1 },
      );
      const repaired = SummaryContent.safeParse(parseJsonOrThrow(recoveryRaw, "recovery"));
      if (repaired.success) final = repaired.data;
      else recoveryError = "Correction response did not satisfy the summary schema";
    } catch (e) {
      recoveryError = e instanceof Error ? e.message : String(e);
      console.error(`[ai] summary correction failed: ${recoveryError}`);
    }
  }

  // merge audit insight into coverage
  final.language = language; // keep authoritative even after a repair pass
  final.coverage = {
    analyzed: [
      ...new Set([...(final.coverage.analyzed ?? []), ...(audit.analyzed ?? [])]),
    ].slice(0, 40),
    unreadable: [
      ...new Set([...(final.coverage.unreadable ?? []), ...(audit.unreadable ?? [])]),
    ].slice(0, 30),
    possibleGaps: [
      ...new Set([...(final.coverage.possibleGaps ?? []), ...(audit.missing ?? []).map((m) => `${m.topic}${m.detail ? ` — ${m.detail}` : ""}`)]),
    ].slice(0, 30),
  };

  const summaryWords = countSummaryWords(final);

  await onStage("finalizing", 94);
  return {
    content: final,
    model: envModel(),
    promptVersion: PROMPT_VERSION,
    sourceWords,
    summaryWords,
    transcripts,
    coverageAudit: {
      completed: auditCompleted,
      ...(auditError ? { error: auditError } : {}),
      ...(recoveryError ? { recoveryError } : {}),
    },
  };
}

function envModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
}
