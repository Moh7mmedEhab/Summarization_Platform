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

export async function uploadGeminiFile(
  bytes: Uint8Array,
  mimeType: string,
  displayName: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<string> {
  const client = genai();
  const config = { mimeType, displayName, abortSignal: opts.signal };
  const uploaded = await failOnAbort(
    client.files.upload({ file: new Blob([bytes as BlobPart], { type: mimeType }), config }),
    opts,
    "Gemini Files API upload",
  );
  if (!uploaded.name) {
    throw new AiError("Gemini Files API upload returned no file name");
  }

  let info = uploaded;
  for (let attempt = 0; attempt < 24 && info.state === "PROCESSING"; attempt++) {
    await sleep(5_000);
    info = await failOnAbort(
      client.files.get({ name: uploaded.name, config: { abortSignal: opts.signal } }),
      opts,
      "Gemini Files API processing",
    );
  }
  if (info.state === "FAILED") {
    throw new AiError("Gemini Files API processing failed");
  }
  if (info.state === "PROCESSING") {
    throw new AiError("Gemini Files API processing did not finish within 120 seconds", undefined, true);
  }
  if (!info.uri) {
    throw new AiError("Gemini Files API upload returned no file URI");
  }
  return info.uri;
}

export type InteractionInput = Parameters<GoogleGenAI["interactions"]["create"]>[0];

export type InteractionPart =
  | { type: "text"; text: string }
  | { type: "document"; data: string; mime_type: string }
  | { type: "document"; uri: string; mime_type: string }
  | { type: "image"; data: string; mime_type: string }
  | { type: "image"; uri: string; mime_type: string }
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

/** Abort-aware wrapper: if the signal fires (job timeout/cancel), fail loudly with a clear message. */
async function failOnAbort<T>(p: Promise<T>, opts: { signal?: AbortSignal; timeoutMs?: number }, label: string): Promise<T> {
  if (!opts.signal && !opts.timeoutMs) return p;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = opts.timeoutMs
    ? new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AiError(`${label} timed out after ${Math.round(opts.timeoutMs! / 1000)}s`, undefined, true)), opts.timeoutMs);
      })
    : undefined;
  try {
    return await Promise.race([p, timeout!].filter(Boolean) as Promise<T>[]);
  } catch (e) {
    if (isAbortError(e)) throw new AiError(`${label} was aborted (worker shutting down or job timed out)`, undefined, true);
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError" || /abort/i.test(e.message));
}

export async function interactionText(
  params: {
    system?: string;
    input: InteractionPart[];
    maxOutputTokens?: number;
    json?: boolean;
  },
  opts: { retries?: number; signal?: AbortSignal } = {},
): Promise<string> {
  if (!hasKey()) {
    throw new AiError("GEMINI_API_KEY is not configured", 401, false);
  }
  if (opts.signal?.aborted) throw new AiError("Gemini call was aborted before it started", undefined, true);
  const client = genai();
  const retries = opts.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const interaction = await failOnAbort(
        client.interactions.create(
          {
            model: env().GEMINI_MODEL,
            system_instruction: params.system,
            input: params.input,
            generation_config: {
              max_output_tokens: params.maxOutputTokens,
              // Requests that must come back as JSON instruct it in the system prompt;
              // keeping sampling params default (Gemini 3.6+ ignores temperature/top_p).
            },
          },
          { fetchOptions: { signal: opts.signal } },
        ),
        opts,
        "Gemini request",
      );
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
  opts: { signal?: AbortSignal } = {},
): Promise<TranscriptSegment[]> {
  if (opts.signal?.aborted) throw new AiError("Transcription was aborted before it started", undefined, true);
  const client = genai();
  const interaction = await failOnAbort(
    client.interactions.create(
      {
        model: env().GEMINI_TRANSCRIBE_MODEL,
        input: [{ type: "audio", uri: fileUri, mime_type: mimeType }],
        generation_config: {
          transcription_config: {
            language_codes: languageHint ? [languageHint === "ar" ? "ar-EG" : "en-US"] : [],
            mode: { type: "verbatim", timestamp_granularities: ["word"] },
          },
        },
      },
      { fetchOptions: { signal: opts.signal } },
    ),
    opts,
    "Lecture transcription",
  );

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
        if (!Number.isFinite(start) || (Number.isFinite(end) && end < start)) continue;
        const segmentEnd = Number.isFinite(end) ? end : start;
        const gap = !current || current.end < start - 4;
        if (gap || segments.length === 0) {
          current = { start, end: segmentEnd, text: ` ${a.text}` };
          segments.push(current);
        } else if (current) {
          current.text += ` ${a.text}`;
          current.end = segmentEnd;
        }
      }
    }
  }
  return segments.map((s) => ({ ...s, text: s.text.trim() }));
}
