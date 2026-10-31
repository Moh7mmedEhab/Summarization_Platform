// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitizeTheme,
  readTheme,
  applyTheme,
  setAppearance,
  setAccent,
  DEFAULT_THEME,
  APPEARANCES,
  ACCENTS,
  STORAGE_KEY,
} from "@/lib/theme";

describe("Theme Model (lib/theme.ts)", () => {
  beforeEach(() => {
    // Reset document element attributes
    delete document.documentElement.dataset.appearance;
    delete document.documentElement.dataset.accent;
    localStorage.clear();
  });

  describe("sanitizeTheme", () => {
    it("returns DEFAULT_THEME for null, undefined, or empty objects", () => {
      expect(sanitizeTheme(null)).toEqual(DEFAULT_THEME);
      expect(sanitizeTheme(undefined)).toEqual(DEFAULT_THEME);
      expect(sanitizeTheme({})).toEqual(DEFAULT_THEME);
    });

    it("sanitizes valid combinations correctly", () => {
      for (const appearance of APPEARANCES) {
        for (const accent of ACCENTS) {
          expect(sanitizeTheme({ appearance, accent })).toEqual({ appearance, accent });
        }
      }
    });

    it("falls back to default for invalid appearance and accent", () => {
      expect(sanitizeTheme({ appearance: "neon", accent: "rainbow" })).toEqual({
        appearance: "light",
        accent: "rose",
      });
      expect(sanitizeTheme({ appearance: "dark", accent: "invalid" })).toEqual({
        appearance: "dark",
        accent: "rose",
      });
      expect(sanitizeTheme({ appearance: 123, accent: null })).toEqual({
        appearance: "light",
        accent: "rose",
      });
    });
  });

  describe("readTheme and applyTheme", () => {
    it("reads default when dataset is unset", () => {
      expect(readTheme()).toEqual(DEFAULT_THEME);
    });

    it("applies theme to documentElement dataset and reads it back", () => {
      applyTheme({ appearance: "dark", accent: "mint" });
      expect(document.documentElement.dataset.appearance).toBe("dark");
      expect(document.documentElement.dataset.accent).toBe("mint");
      expect(readTheme()).toEqual({ appearance: "dark", accent: "mint" });
    });
  });

  describe("setAppearance and setAccent", () => {
    it("updates appearance while preserving accent, persisting to localStorage", () => {
      applyTheme({ appearance: "light", accent: "lavender" });
      const updated = setAppearance("dark");
      expect(updated).toEqual({ appearance: "dark", accent: "lavender" });
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ appearance: "dark", accent: "lavender" }));
    });

    it("updates accent while preserving appearance, persisting to localStorage", () => {
      applyTheme({ appearance: "dark", accent: "peach" });
      const updated = setAccent("sky");
      expect(updated).toEqual({ appearance: "dark", accent: "sky" });
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ appearance: "dark", accent: "sky" }));
    });
  });
});
