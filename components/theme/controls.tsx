"use client";

import { useEffect, useState } from "react";
import {
  ACCENTS,
  ACCENT_LABEL,
  readTheme,
  setAccent,
  setAppearance,
  type Accent,
  type Theme,
} from "@/lib/theme";

/*

The appearance controls. The mode segmented control and the palette chips are plain
buttons (keyboard reachable, aria-pressed for the active state). Instantly live: both
routes write the tokens onto <html> and save to this browser.

*/

export default function ThemeControls() {
  const [theme, setTheme] = useState<Theme>({ appearance: "light", accent: "rose" });

  useEffect(() => setTheme(readTheme()), []);

  const pickAppearance = (appearance: Theme["appearance"]) => setTheme(setAppearance(appearance));
  const pickAccent = (accent: Accent) => setTheme(setAccent(accent));

  return (
    <div className="settingsform">
      <div className="field">
        <span className="fieldlabel" id="appearance-mode">Mode</span>
        <div className="segmented" role="group" aria-labelledby="appearance-mode">
          <button type="button" aria-pressed={theme.appearance === "light"} onClick={() => pickAppearance("light")}>
            Light
          </button>
          <button type="button" aria-pressed={theme.appearance === "dark"} onClick={() => pickAppearance("dark")}>
            Dark
          </button>
        </div>
      </div>

      <div className="field">
        <span className="fieldlabel" id="appearance-accent">Accent</span>
        <div className="themopts" role="group" aria-labelledby="appearance-accent">
          {ACCENTS.map((accent) => (
            <button
              key={accent}
              type="button"
              className="theme-chip"
              aria-pressed={theme.accent === accent}
              onClick={() => pickAccent(accent)}
            >
              <span className="swatch" data-accent={accent} aria-hidden="true"><i /></span>
              {ACCENT_LABEL[accent]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
