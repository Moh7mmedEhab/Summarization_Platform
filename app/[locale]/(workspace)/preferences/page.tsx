import "server-only";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import PreferencesClient from "./page-client";

type Props = { params: Promise<{ locale: string }> };

/** Preferences screen: seeded from the account's persisted preferences. */
export default async function PreferencesPage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  const session = await requireSession();
  const preference =
    (await prisma.userPreference.findUnique({ where: { userId: session.user.id } })) ?? {
      appearanceMode: "light" as const,
      accentPalette: "rose",
      language: "en",
    };

  return (
    <PreferencesClient
      initialAppearance={preference.appearanceMode === "dark" ? "dark" : "light"}
      initialAccent={preference.accentPalette}
    />
  );
}
