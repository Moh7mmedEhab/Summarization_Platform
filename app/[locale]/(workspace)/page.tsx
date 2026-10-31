import { getTranslations, setRequestLocale } from "next-intl/server";
import Composer from "@/components/summarizer/composer";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";
import { requireSession } from "@/lib/auth/session";

type Props = { params: Promise<{ locale: string }> };

/** Composer: this page auth-checks itself (defense in depth vs. the layout gate). */
export default async function SummarizePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await requireSession();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "composer" });

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{t("title")}</h1>
          <p className="sub">{t("sub")}</p>
        </div>
      </div>
      <Composer />
    </>
  );
}
