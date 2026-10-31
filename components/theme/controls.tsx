"use client";

import { useSyncExternalStore } from "react";
import {
  ACCENTS,
  DEFAULT_THEME,
  onThemeChange,
  themeSnapshot,
  applyTheme,
  setAccent,
  setAppearance,
  type Accent,
  type Theme,
} from "@/lib/theme";

/*
The appearance controls. The mode segmented control and the palette chips are
plain buttons (keyboard reachable, aria-pressed for the active state).
Instantly live: both routes write the tokens onto <html> and save to this
browser; when `onPersist` is given (the signed-in preferences screen), the
account's stored preference is updated too.
*/

export type ThemeLabels = {
  mode: string;
  light: string;
  dark: string;
  accent: string;
  accentNames: Record<Accent, string>;
};

export default function ThemeControls({
  onPersist,
  labels,
}: {
  onPersist?: (theme: Theme) => void | Promise<void>;
  labels?: ThemeLabels;
}) {
  // The theme lives on <html>'s dataset and is subscribed via the
  // margins-theme-change event — no mirrored state, no cascading effect.
  const theme = useSyncExternalStore(onThemeChange, themeSnapshot, () => DEFAULT_THEME);

  const pickAppearance = (appearance: Theme["appearance"]) => {
    const next = setAppearance(appearance);
    void onPersist?.(next);
  };
  const pickAccent = (accent: Accent) => {
    const next = setAccent(accent);
    void onPersist?.(next);
  };
  const modeLabel = (a: Theme["appearance"]) =>
    labels ? (a === "dark" ? labels.dark : labels.light) : a[0].toUpperCase() + a.slice(1);
  const accentLabel = (a: Accent) => labels?.accentNames[a] ?? a[0].toUpperCase() + a.slice(1);

  return (
    <div className="settingsform">
      <div className="field">
        <span className="fieldlabel" id="appearance-mode">
          {labels?.mode ?? "Mode"}
        </span>
        <div className="segmented" role="group" aria-labelledby="appearance-mode">
          {(["light", "dark"] as const).map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={theme.appearance === a}
              onClick={() => pickAppearance(a)}
            >
              {modeLabel(a)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="fieldlabel" id="appearance-accent">
          {labels?.accent ?? "Accent"}
        </span>
        <div className="themopts" role="group" aria-labelledby="appearance-accent">
          {ACCENTS.map((accent) => (
            <button
              key={accent}
              type="button"
              className="theme-chip"
              aria-pressed={theme.accent === accent}
              onClick={() => pickAccent(accent)}
            >
              <span className="swatch" data-accent={accent} aria-hidden="true">
                <i />
              </span>
              {accentLabel(accent)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Used by the layout route to adopt an account theme on first visit. */
export { applyTheme };
