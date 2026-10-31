import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import ProfileClient from "./page-client";

type Props = { params: Promise<{ locale: string }> };

/** Profile screen: account info + usage, over owned data. */
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const [preference, documents, summaries] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId: session.user.id } }),
    prisma.document.count({ where: { userId: session.user.id } }),
    prisma.summary.count({ where: { userId: session.user.id, current: true } }),
  ]);
  void preference;

  return (
    <ProfileClient
      locale={locale}
      profile={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt.toISOString(),
        counts: { documents, summaries },
      }}
    />
  );
}
