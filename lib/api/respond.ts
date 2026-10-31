import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/features/documents/service";
import { AiError } from "@/lib/ai/gemini/client";
import { UploadError } from "@/lib/upload/validate";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid"
  | "too_large"
  | "failed";

export function failJson(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/**
 * Maps thrown errors to consistent, meaningful HTTP responses without leaking
 * internals (stack traces, secrets). Unknown errors stay 500 with a generic message.
 */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ZodError) {
    const message = e.issues[0]?.message ?? "Invalid input";
    return failJson(400, "bad_request", message);
  }
  if (e instanceof DomainError) {
    const status =
      e.code === "not_found" ? 404 :
      e.code === "forbidden" ? 403 :
      e.code === "conflict" ? 409 :
      e.code === "too_large" ? 413 : 400;
    return failJson(status, e.code, e.message);
  }
  if (e instanceof UploadError) return failJson(400, "invalid", e.message);
  if (e instanceof AiError) {
    const status = e.status === 401 ? 503 : 500;
    return failJson(status, "invalid", e.message);
  }
  if (e instanceof Error && e.message === "UNAUTHORIZED") {
    return failJson(401, "unauthorized", "Sign in to continue");
  }
  console.error("[api]", e);
  return failJson(500, "failed", "Something went wrong");
}

export const okJson = <T>(data: T, status = 200) =>
  NextResponse.json({ ok: true, ...(data as object) }, { status });

export const num = (v: string | null): number | undefined =>
  v === null || v === "" ? undefined : Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : undefined;
