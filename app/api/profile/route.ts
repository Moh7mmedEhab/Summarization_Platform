import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, okJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/auth/session";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(200).optional(), // handled by auth email change flow
  language: z.enum(["en", "ar"]).optional(),
  appearanceMode: z.enum(["light", "dark"]).optional(),
  accentPalette: z
    .enum(["rose", "lavender", "peach", "berry", "mint", "sky", "plum"])
    .optional(),
});

/** GET /api/profile — session user + preferences + counts. */
export async function GET() {
  try {
    const session = await requireSession();
    const [preference, counts] = await Promise.all([
      prisma.userPreference.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id },
        update: {},
      }),
      Promise.all([
        prisma.document.count({ where: { userId: session.user.id } }),
        prisma.summary.count({ where: { userId: session.user.id, current: true } }),
      ]),
    ]);
    return okJson({
      profile: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt.toISOString(),
        preference,
        counts: { documents: counts[0], summaries: counts[1] },
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PATCH /api/profile — update name and/or preferences. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = patchSchema.parse(await request.json());

    if (body.name && body.name !== session.user.name) {
      await auth.api.updateUser({
        body: { name: body.name },
        headers: request.headers,
      });
    }

    const preferencePatch: Record<string, string> = {};
    if (body.language) preferencePatch.language = body.language;
    if (body.appearanceMode) preferencePatch.appearanceMode = body.appearanceMode;
    if (body.accentPalette) preferencePatch.accentPalette = body.accentPalette;

    const preference = await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...preferencePatch },
      update: preferencePatch,
    });

    return okJson({ profileUpdatedAt: true, preference });
  } catch (e) {
    return errorResponse(e);
  }
}
