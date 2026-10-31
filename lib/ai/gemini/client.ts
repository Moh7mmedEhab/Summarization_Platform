import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";

/**
 * Server-only Gemini access via the current Interactions API.
 * The API key never leaves the server: no client component imports this module.
 */

let instance: GoogleGenAI | null = null;

export function hasKey(): boolean {
  return env().GEMINI_API_KEY.length > 0;
}

export function genai(): GoogleGenAI {
  if (!hasKey()) {
    throw new Error("GEMINI_API_KEY is not configured (Google AI Studio key, server-side only)");
  }
  if (!instance) instance = new GoogleGenAI({ apiKey: env().GEMINI_API_KEY });
  return instance;
}

export type InteractionInput = Parameters<GoogleGenAI["interactions"]["create"]>[0];

export type InteractionPart =
  | { type: "text"; text: string }
  | { type: "document"; data: string; mime_type: string }
  | { type: "document"; uri: string; mime_type: string }
  | { type: "image"; data: string; mime_type: string }
  | { type: "audio"; data: string; mime_type: string }
  | { type: "audio"; uri: string; mime_type: string };

export class AiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AiError";
  }
}

function extractJson(text: string): string {
  // Nimbus-safe: find the first balanced JSON object in the response.
  const start = text.indexOf("{");
  if (start === -1) throw new AiError("Model response contained no JSON");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === '"') inString = !inString;
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}" && depth-- === 1) {
      // Trim trailing commas that occasionally appear, then hand off to zod.
      return text.slice(start, i + 1).replace(/,\s*([}\]])/g, "$1");
    }
  }
  throw new AiError("Model response contained unterminated JSON");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function interactionText(
  params: {
    system?: string;
    input: InteractionPart[];
    maxOutputTokens?: number;
    json?: boolean;
  },
  opts: { retries?: number } = {},
): Promise<string> {
  if (!hasKey()) {
    throw new AiError("GEMINI_API_KEY is not configured", 401, false);
  }
  const client = genai();
  const retries = opts.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const interaction = await client.interactions.create({
        model: env().GEMINI_MODEL,
        system_instruction: params.system,
        input: params.input,
        generation_config: {
          max_output_tokens: params.maxOutputTokens,
          // Requests that must come back as JSON instruct it in the system prompt;
          // keeping sampling params default (Gemini 3.6+ ignores temperature/top_p).
        },
      });
      return params.json ? extractJson(interaction.output_text ?? "") : interaction.output_text ?? "";
    } catch (e) {
      lastError = e;
      const status = (e as { status?: number }).status;
      const retryable = status === 429 || status === 503 || status === 529 || status === 500;
      if (!retryable || attempt === retries) break;
      await sleep(2_000 * (attempt + 1));
    }
  }
  const err = lastError as { status?: number; message?: string };
  throw new AiError(
    `Gemini request failed: ${err?.message ?? String(lastError)}`,
    err?.status,
    false,
  );
}

/**
 * Transcribe a lecture recording. Word-level timestamps come back as
 * annotations; we fold them into timestamped segments with global offsets.
 */
export type TranscriptSegment = { start: number; end: number; text: string };

export async function transcribeAudio(
  fileUri: string,
  mimeType: string,
  languageHint?: string,
): Promise<TranscriptSegment[]> {
  const client = genai();
  const interaction = await client.interactions.create({
    model: env().GEMINI_TRANSCRIBE_MODEL,
    input: [{ type: "audio", uri: fileUri, mime_type: mimeType }],
    generation_config: {
      transcription_config: {
        language_codes: languageHint ? [languageHint === "ar" ? "ar-EG" : "en-US"] : [],
        mode: { type: "verbatim", timestamp_granularities: ["word"] },
      },
    },
  });

  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;
  const parseOffset = (v: unknown): number => {
    // Offsets arrive like "14.320s"
    const n = parseFloat(String(v).replace("s", ""));
    return Number.isFinite(n) ? n : NaN;
  };

  for (const step of interaction.steps ?? []) {
    for (const content of (step as { content?: Array<{ annotations?: unknown[] }> }).content ?? []) {
      for (const annotation of (content as { annotations?: unknown[] }).annotations ?? []) {
        const a = annotation as { type?: string; text?: string; speaker?: string; start_offset?: unknown; end_offset?: unknown };
        if (a.type !== "word_info" || !a.text) continue;
        const start = parseOffset(a.start_offset);
        const end = parseOffset(a.end_offset);
        const started = Number.isFinite(start);
        const gap = !current || current.end < start - 4;
        if (started && (gap || segments.length === 0)) {
          current = { start, end: Number.isFinite(end) ? end : start, text: ` ${a.text}` };
          segments.push(current);
        } else if (current) {
          current.text += ` ${a.text}`;
          if (Number.isFinite(end)) current.end = end;
        }
      }
    }
  }
  return segments.map((s) => ({ ...s, text: s.text.trim() }));
}
