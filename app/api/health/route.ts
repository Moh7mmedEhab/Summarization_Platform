import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, okJson, failJson } from "@/lib/api/respond";
import { getSession } from "@/lib/auth/session";

/** GET /api/health — liveness + database reachability + config status. */
export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    let db = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "unreachable";
    }
    const ai = process.env.GEMINI_API_KEY ? "configured" : "missing_key";
    const mail = process.env.EMAIL_PROVIDER ?? "dev";
    return okJson({ status: db === "ok" ? "ok" : "degraded", db, ai, mail, signedIn: !!session });
  } catch (e) {
    return errorResponse(e);
  }
}
