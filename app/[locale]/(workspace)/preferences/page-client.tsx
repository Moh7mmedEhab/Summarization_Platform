"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import ThemeControls from "@/components/theme/controls";
import SummaryNote from "@/components/summary/note";
import { readTheme, type Theme } from "@/lib/theme";
import { GlobeIcon } from "@/components/icons";

/*
Preferences: language switch (re-routes without losing the page) and the
appearance theme. Both persist to the account (PATCH /api/profile) so they
follow the user; the theme also stays in localStorage for pre-paint restore.
*/

const patch = (body: Record<string, string>) =>
  fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const ACCENT_KEYS = ["rose", "lavender", "peach", "berry", "mint", "sky", "plum"] as const;

export default function PreferencesClient({
  initialAppearance,
  initialAccent,
}: {
  initialAppearance: "light" | "dark";
  initialAccent: string;
}) {
  const t = useTranslations("preferences");
  const tAppearance = useTranslations("appearance");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  // First visit on this device: adopt the account's theme so no flash occurs
  // on the next loads (localStorage is written by the controls below).
  useEffect(() => {
    if (!localStorage.getItem("margins-theme")) {
      const el = document.documentElement;
      el.dataset.appearance = initialAppearance;
      const accents = ACCENT_KEYS as readonly string[];
      if (accents.includes(initialAccent)) el.dataset.accent = initialAccent;
    }
  }, [initialAppearance, initialAccent]);

  async function setLocale(next: "en" | "ar") {
    if (next === locale) return;
    await patch({ language: next });
    router.replace(pathname, { locale: next });
  }

  const [theme, setTheme] = useState<Theme>(readTheme());

  useEffect(() => setTheme(readTheme()), []);

  async function persistTheme(next: Theme) {
    setTheme(next);
    await patch({ appearanceMode: next.appearance, accentPalette: next.accent });
  }

  const accents = ACCENT_KEYS;

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{t("title")}</h1>
          <p className="sub">{t("sub")}</p>
        </div>
      </div>

      <section className="setsec" aria-labelledby="lang-h">
        <div className="lab">
          <h2 id="lang-h">
            <GlobeIcon /> {t("sectionLanguage.title")}
          </h2>
          <p>{t("sectionLanguage.desc")}</p>
        </div>
        <div className="panel">
          <div className="settingsform">
            <div className="field">
              <span className="fieldlabel" id="ui-language">
                {t("sectionLanguage.title")}
              </span>
              <div className="segmented" role="group" aria-labelledby="ui-language">
                <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
                  {t("sectionLanguage.en")}
                </button>
                <button type="button" aria-pressed={locale === "ar"} onClick={() => setLocale("ar")}>
                  {t("sectionLanguage.ar")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="setsec" aria-labelledby="theme-h">
        <div className="lab">
          <h2 id="theme-h">{tAppearance("theme")}</h2>
          <p>{tAppearance("themeDesc")}</p>
        </div>
        <div className="panel">
          <ThemeControls
            onPersist={persistTheme}
            labels={{
              mode: tAppearance("mode.label"),
              light: tAppearance("mode.light"),
              dark: tAppearance("mode.dark"),
              accent: tAppearance("accent"),
              accentNames: Object.fromEntries(accents.map((a) => [a, tAppearance(`accents.${a}`)])) as Record<
                (typeof ACCENT_KEYS)[number],
                string
              >,
            }}
          />
        </div>
      </section>

      <section className="setsec" aria-labelledby="preview-h">
        <div className="lab">
          <h2 id="preview-h">{tAppearance("livePreview")}</h2>
          <p>{tAppearance("previewDesc")}</p>
          <p className="now num">
            {tAppearance("now", {
              stamp: `${theme.appearance}, ${labelsOf(theme.accent, tAppearance)}`,
            })}
          </p>
        </div>
        <div className="panel">
          <SummaryNote />
        </div>
      </section>
    </>
  );
}

function labelsOf(accent: string, tAppearance: ReturnType<typeof useTranslations<"appearance">>): string {
  const key = (ACCENT_KEYS as readonly string[]).includes(accent) ? accent : "rose";
  try {
    return tAppearance(`accents.${key}` as never);
  } catch {
    return key;
  }
}
