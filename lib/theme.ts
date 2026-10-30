// The theme model: appearance and accent are independent axes.
// Light + rose is the fallback everywhere, so a page without attributes still renders whole.

export const STORAGE_KEY = "margins-theme";

export const APPEARANCES = ["light", "dark"] as const;
export type Appearance = (typeof APPEARANCES)[number];

export const ACCENTS = ["rose", "lavender", "peach", "berry", "mint", "sky", "plum"] as const;
export type Accent = (typeof ACCENTS)[number];

export const ACCENT_LABEL: Record<Accent, string> = {
  rose: "Rose",
  lavender: "Lavender",
  peach: "Peach",
  berry: "Berry",
  mint: "Mint",
  sky: "Sky",
  plum: "Plum",
};

export type Theme = { appearance: Appearance; accent: Accent };

export const DEFAULT_THEME: Theme = { appearance: "light", accent: "rose" };

const asAccent = (v: unknown): Accent =>
  (ACCENTS as readonly string[]).includes(String(v)) ? (v as Accent) : DEFAULT_THEME.accent;

const asAppearance = (v: unknown): Appearance =>
  v === "dark" ? "dark" : "light";

/** Accepts anything (parsed JSON, dataset values) and returns a valid theme. */
export function sanitizeTheme(v: unknown): Theme {
  const t = (v ?? {}) as Partial<Theme>;
  return { appearance: asAppearance(t.appearance), accent: asAccent(t.accent) };
}

/** Current theme: the <html> dataset (the inline init script mirrors the stored value). */
export function readTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const d = document.documentElement;
  return { appearance: asAppearance(d.dataset.appearance), accent: asAccent(d.dataset.accent) };
}

export function applyTheme(t: Theme): void {
  const d = document.documentElement;
  d.dataset.appearance = t.appearance;
  d.dataset.accent = t.accent;
}

function commit(next: Theme): Theme {
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode: the theme still lives until reload */
  }
  window.dispatchEvent(new Event("margins-theme-change"));
  return next;
}

export const onThemeChange = (cb: () => void) => {
  window.addEventListener("margins-theme-change", cb);
  return () => window.removeEventListener("margins-theme-change", cb);
};

export const setAppearance = (appearance: Appearance) =>
  commit({ ...readTheme(), appearance });

export const setAccent = (accent: Accent) => commit({ ...readTheme(), accent });
