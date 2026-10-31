/**
 * tests/unit/api-401.test.ts
 *
 * Every API route handler must perform its own session check: an
 * unauthenticated request gets 401 — no handler relies on middleware or the
 * workspace layout. The session module is mocked so NO database access
 * happens; each handler must reject before touching anything else.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const noSession = vi.hoisted(() => ({}));

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => null,
  requireSession: async () => {
    throw new Error("UNAUTHORIZED");
  },
  userIdOf: () => {
    throw new Error("no session");
  },
  ...noSession,
}));

// Import all handlers AFTER the session mock is in place.
import { GET as documentsGet, POST as documentsPost } from "@/app/api/documents/route";
import { POST as uploadPost } from "@/app/api/documents/upload/route";
import {
  GET as documentGet,
  PATCH as documentPatch,
  DELETE as documentDelete,
} from "@/app/api/documents/[documentId]/route";
import { GET as downloadGet } from "@/app/api/documents/[documentId]/download/route";
import { POST as summarizePost } from "@/app/api/documents/[documentId]/summarize/route";
import { GET as jobGet, DELETE as jobDelete } from "@/app/api/jobs/[jobId]/route";
import {
  GET as summaryGet,
  PATCH as summaryPatch,
} from "@/app/api/summaries/[summaryId]/route";
import { GET as profileGet, PATCH as profilePatch } from "@/app/api/profile/route";
import { POST as passwordPost } from "@/app/api/profile/password/route";

const req = (path: string): NextRequest =>
  new (require("next/server").NextRequest)(`http://localhost:3000${path}`);

// `Promise<never>` is assignable to any Promise<Params>, so the helper stays
// usable against every handler's distinct params type.
const dynamicParams = (key: string, value: string): { params: Promise<never> } =>
  ({ params: Promise.resolve({ [key]: value }) }) as { params: Promise<never> };

describe("unauthenticated API requests are rejected with 401", () => {
  beforeEach(() => {
    // handlers may construct NextRequest etc.; no shared state expected
  });

  it("GET /api/documents → 401", async () => {
    const res = await documentsGet(req("/api/documents"));
    expect(res.status).toBe(401);
  });

  it("POST /api/documents → 401", async () => {
    const res = await documentsPost(req("/api/documents"));
    expect(res.status).toBe(401);
  });

  it("POST /api/documents/upload → 401 before parsing the body", async () => {
    const res = await uploadPost(
      req("/api/documents/upload"),
    );
    expect(res.status).toBe(401);
  });

  it.each([
    ["GET", documentGet],
    ["PATCH", documentPatch],
    ["DELETE", documentDelete],
  ])("%s /api/documents/:id → 401", async (_method, handler) => {
    const res = await handler(req("/api/documents/x"), dynamicParams("documentId", "x"));
    expect(res.status).toBe(401);
  });

  it("GET /api/documents/:id/download → 401", async () => {
    const res = await downloadGet(
      req("/api/documents/x/download"),
      dynamicParams("documentId", "x"),
    );
    expect(res.status).toBe(401);
  });

  it("POST /api/documents/:id/summarize → 401", async () => {
    const res = await summarizePost(
      req("/api/documents/x/summarize"),
      dynamicParams("documentId", "x"),
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/jobs/:id → 401", async () => {
    const res = await jobGet(req("/api/jobs/x"), dynamicParams("jobId", "x"));
    expect(res.status).toBe(401);
  });

  it.each([
    ["GET", summaryGet],
    ["PATCH", summaryPatch],
  ])("%s /api/summaries/:id → 401", async (_method, handler) => {
    const res = await handler(req("/api/summaries/x"), dynamicParams("summaryId", "x"));
    expect(res.status).toBe(401);
  });

  it("DELETE /api/jobs/:id (cancel) → 401", async () => {
    const res = await jobDelete(req("/api/jobs/x"), dynamicParams("jobId", "x"));
    expect(res.status).toBe(401);
  });

  it.each([
    ["GET", profileGet],
    ["PATCH", profilePatch],
  ])("%s /api/profile → 401", async (_method, handler) => {
    const res = await handler(req("/api/profile"));
    expect(res.status).toBe(401);
  });

  it("POST /api/profile/password → 401", async () => {
    const res = await passwordPost(req("/api/profile/password"));
    expect(res.status).toBe(401);
  });
});
