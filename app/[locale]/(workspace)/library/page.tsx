import { setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/lib/i18n/routing";
import LibraryClient from "./page-client";

type Props = { params: Promise<{ locale: string }> };

/** Library screen — this page auth-checks itself (defense in depth vs. the layout gate). */
export default async function LibraryPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await requireSession();
  setRequestLocale(locale);
  return <LibraryClient />;
}
