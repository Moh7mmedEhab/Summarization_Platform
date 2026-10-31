import { getTranslations, setRequestLocale } from "next-intl/server";
import Composer from "@/components/summarizer/composer";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

/** The main screen: the real composer (uploads, pasted text, style, language). */
export default async function SummarizePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
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
