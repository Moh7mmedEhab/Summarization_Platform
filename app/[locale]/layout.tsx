import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, isRtl } from "@/lib/i18n/routing";
import "../globals.css";
import "../themes.css";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

// Runs before first paint: restores the saved theme, then QA-only URL overrides
// (?appearance=&accent=) that are deliberately not persisted.
const themeInit = `try{var t=JSON.parse(localStorage.getItem("margins-theme")||"{}");var a=t.appearance==="dark"?"dark":"light";var C=["rose","lavender","peach","berry","mint","sky","plum"];var c=C.indexOf(t.accent)>-1?t.accent:"rose";var q=new URLSearchParams(location.search);if(q.get("appearance")==="dark")a="dark";if(q.get("appearance")==="light")a="light";if(C.indexOf(q.get("accent"))>-1)c=q.get("accent");var d=document.documentElement;d.dataset.appearance=a;d.dataset.accent=c}catch(e){}`;

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enable static rendering for this subtree.
  setRequestLocale(locale);

  return (
    // suppressHydrationWarning: the theme-init script may lock in a different
    // saved appearance/accent before hydration without flicker.
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      data-appearance="light"
      data-accent="rose"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- false positive: this rule targets Pages Router (_document.js); in the App Router this root layout covers every page. */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
