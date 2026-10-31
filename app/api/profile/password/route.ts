import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, failJson, okJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/auth/session";
import { auth } from "@/lib/auth/auth";

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

/** POST /api/profile/password — change password; other sessions are revoked. */
export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const { currentPassword, newPassword } = passwordSchema.parse(await request.json());
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: request.headers,
    });
    return okJson({ passwordChanged: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/invalid|password|credential/i.test(msg)) {
      return failJson(400, "invalid", "Current password is not correct, or the new one was rejected");
    }
    return errorResponse(e);
  }
}
