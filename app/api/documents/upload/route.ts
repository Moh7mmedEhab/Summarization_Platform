import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, okJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/auth/session";
import { createDocument, type UploadedFile } from "@/features/documents/service";
import { env } from "@/lib/env";
import { sniff, isAudioMime, ACCEPTED_UPLOADS } from "@/lib/upload/validate";

const metaSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional(),
  text: z.string().max(200_000).optional(),
});

const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|webm|mp4)$/i;

/**
 * POST /api/documents/upload — multipart form.
 *   files: one more more educational files (PDF/DOCX/TXT/images/audio...)
 *   + fields title / description / text
 * Content signatures are verified server-side; size limits come from env.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const form = await request.formData();
    const meta = metaSchema.parse({
      title: form.get("title") || undefined,
      description: form.get("description") || undefined,
      text: form.get("text") || undefined,
    });

    const maxSource = env().UPLOAD_MAX_SOURCE_BYTES;
    const maxAudio = env().UPLOAD_MAX_AUDIO_BYTES;
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (meta.text && meta.text.trim().length > 0 && files.length === 0) {
      // text-only upload still allowed through this route for one-step convenience
    }
    if (files.length > 12) {
      return okJson({ error: { code: "invalid", message: "At most 12 files per upload" } }, 400);
    }

    const parsed: UploadedFile[] = [];
    const rejected: Array<{ name: string; reason: string }> = [];
    let sawAudio = false;

    for (const f of files) {
      const signature = new Uint8Array(await f.slice(0, 12).arrayBuffer());
      const isAudio =
        isAudioMime(f.type) || AUDIO_EXT.test(f.name) || sniffQuiet(signature) === "audio-sig";
      try {
        const limit = isAudio ? maxAudio : maxSource;
        if (f.size > limit) {
          rejected.push({ name: f.name, reason: `File exceeds the ${(limit / 1_048_576).toFixed(0)} MB limit` });
          continue;
        }
        const bytes = new Uint8Array(await f.arrayBuffer());
        const { kind, mime } = sniff(bytes, f.type || "application/octet-stream");
        parsed.push({ name: f.name || mime.replace("/", "."), mimeType: mime, bytes, kind });
        if (kind === "audio") sawAudio = true;
      } catch (e) {
        if (e instanceof Error && e.message === "Unsupported file type") {
          rejected.push({
            name: f.name,
            reason: isAudio ? "Unsupported audio type" : "Unsupported file type",
          });
        } else {
          rejected.push({ name: f.name, reason: "Could not read file" });
        }
      }
    }

    const hasText = !!meta.text?.trim();
    if (parsed.length === 0 && !hasText) {
      return okJson(
        {
          error: {
            code: "invalid",
            message: rejected[0]?.reason ?? "Provide pasted text or a supported file",
          },
        },
        400,
      );
    }

    const title =
      meta.title?.trim() ||
      parsed[0]?.name.replace(/\.[^.]+$/, "") ||
      "Untitled material";

    const { documentId } = await createDocument(session.user.id, {
      title,
      description: meta.description,
      text: hasText ? meta.text : undefined,
      files: parsed,
    });

    return okJson(
      { documentId, uploaded: parsed.length, sawAudio, rejected },
      201,
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/** Light signature check used only to classify the audio size limit correctly. */
function sniffQuiet(bytes: Uint8Array): string {
  if (bytes.length < 12) return "";
  const ascii = String.fromCharCode(...bytes.subarray(0, 12));
  if (ascii.startsWith("%PDF")) return "pdf";
  if (ascii.startsWith("RIFF")) return bytes[8] === 0x57 ? "audio-sig" : "riff";
  if (bytes.length > 4 && ascii.charCodeAt(4) === 0x66) return "ftyp";
  return "";
}

export const runtime = "nodejs";
export const maxDuration = 60;

/** Describe accepted types in the OpenAPI sense (docs). */
export const ACCEPTED = ACCEPTED_UPLOADS;
