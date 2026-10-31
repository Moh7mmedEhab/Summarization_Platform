/**
 * Upload validation: content-signature sniffing (never trusting the client's
 * filename/extension), size limits, and a safe SourceKind for each accepted file.
 */

import type { SourceKind } from "@/generated/prisma/enums";

export const SOURCE_MIME: Record<SourceKind, string> = {
  text: "text/plain",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  image: "image/unknown",
  audio: "audio/unknown",
};

export const ACCEPTED_UPLOADS =
  ".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.ogg,.webm";

const IMAGE_KINDS = new Set(["image/png", "image/jpeg", "image/webp"]);
const AUDIO_KINDS = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/vnd.wave",
  "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/ogg", "audio/webm",
]);

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, offset: number, len: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + len));
}

export type Sniffed = { kind: SourceKind; mime: string };

/**
 * Maps raw bytes + client-reported type to the server-side truth.
 * Throws UploadError for anything that is neither document material, image,
 * lecture audio, or plain text.
 */
export function sniff(bytes: Uint8Array, clientType: string): Sniffed {
  const b = bytes;
  if (b.length >= 4) {
    if (ascii(b, 0, 4) === "%PDF") return { kind: "pdf", mime: "application/pdf" };
    if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return { kind: "image", mime: "image/png" };
    if (startsWith(b, [0xff, 0xd8, 0xff])) return { kind: "image", mime: "image/jpeg" };
    if (ascii(b, 0, 4) === "RIFF") {
      const second = ascii(b, 8, 4);
      if (second === "WEBP") return { kind: "image", mime: "image/webp" };
      if (second === "WAVE") return { kind: "audio", mime: "audio/wav" };
    }
    if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "audio", mime: "audio/webm" };
    if (ascii(b, 0, 4) === "OggS") return { kind: "audio", mime: "audio/ogg" };
    if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) {
      // A ZIP container: DOCX (a .docx is a zip; .xlsx/.pptx are rejected by name check)
      return { kind: "docx", mime: SOURCE_MIME.docx };
    }
    if (startsWith(b, [0xff, 0xfb]) || startsWith(b, [0xff, 0xf3]) || ascii(b, 0, 3) === "ID3") {
      return { kind: "audio", mime: "audio/mpeg" };
    }
    if (ascii(b, 4, 4) === "ftyp") {
      return { kind: "audio", mime: "audio/m4a" };
    }
  }
  // Plain text with an explicit text declaration, or a .txt filename signal is
  // validated at the call site; here we only accept declared text.
  // Guard against script/code content that would pass isProbablyText (all printable
  // ASCII) being uploaded as "text/plain": reject common interpreter headers and
  // embedded code prefixes regardless of the client-declared MIME type.
  if (clientType.startsWith("text/") && isProbablyText(b)) {
    if (isDangerousTextContent(b)) {
      throw new UploadError("Executable or script content is not allowed");
    }
    return { kind: "text", mime: "text/plain" };
  }
  throw new UploadError("Unsupported file type");
}

export function isProbablyText(bytes: Uint8Array): boolean {
  const probe = bytes.subarray(0, 2048);
  let nonText = 0;
  for (const byte of probe) if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte === 0x7f) nonText++;
  return nonText / Math.max(1, probe.length) < 0.02;
}

/**
 * Detects dangerous text-format content that passes isProbablyText (all
 * printable ASCII) but should never be stored as study material:
 * shell scripts, PHP, HTML, XML, and other interpreted languages.
 * Checked against the first bytes of the file before allowing text uploads.
 */
export function isDangerousTextContent(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const head = String.fromCharCode(...bytes.subarray(0, Math.min(bytes.length, 64)));
  const trimmed = head.trimStart();
  // Shell / interpreter shebang lines
  if (trimmed.startsWith("#!")) return true;
  // PHP
  if (trimmed.startsWith("<?php") || trimmed.startsWith("<?PHP")) return true;
  // HTML / XML / SVG — these could contain JS
  if (trimmed.startsWith("<html") || trimmed.startsWith("<HTML")) return true;
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<!doctype")) return true;
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<?XML")) return true;
  if (trimmed.startsWith("<svg") || trimmed.startsWith("<SVG")) return true;
  return false;
}

export function isImageMime(mime: string): boolean {
  return IMAGE_KINDS.has(mime);
}

export function isAudioMime(mime: string): boolean {
  return AUDIO_KINDS.has(mime);
}
