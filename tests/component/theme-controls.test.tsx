// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeControls from "@/components/theme/controls";
import ThemeStamp from "@/components/theme/stamp";
import { applyTheme } from "@/lib/theme";

describe("Theme Components (ThemeControls & ThemeStamp)", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.appearance;
    delete document.documentElement.dataset.accent;
    localStorage.clear();
  });

  describe("ThemeControls", () => {
    it("renders light/dark segmented control and 7 palette chips", () => {
      render(<ThemeControls />);
      const lightBtn = screen.getByRole("button", { name: /light/i });
      const darkBtn = screen.getByRole("button", { name: /dark/i });
      expect(lightBtn).toBeInTheDocument();
      expect(darkBtn).toBeInTheDocument();

      const chips = screen.getAllByRole("button");
      // 2 mode buttons + 7 palette chips = 9 buttons total
      expect(chips.length).toBe(9);
    });

    it("toggles mode to dark and triggers onPersist", () => {
      const onPersist = vi.fn();
      render(<ThemeControls onPersist={onPersist} />);

      const darkBtn = screen.getByRole("button", { name: /dark/i });
      fireEvent.click(darkBtn);

      expect(darkBtn).toHaveAttribute("aria-pressed", "true");
      expect(document.documentElement.dataset.appearance).toBe("dark");
      expect(onPersist).toHaveBeenCalledWith(
        expect.objectContaining({ appearance: "dark" })
      );
    });

    it("switches palette chip to mint and triggers onPersist", () => {
      const onPersist = vi.fn();
      render(<ThemeControls onPersist={onPersist} />);

      const mintBtn = screen.getByRole("button", { name: /mint/i });
      fireEvent.click(mintBtn);

      expect(mintBtn).toHaveAttribute("aria-pressed", "true");
      expect(document.documentElement.dataset.accent).toBe("mint");
      expect(onPersist).toHaveBeenCalledWith(
        expect.objectContaining({ accent: "mint" })
      );
    });
  });

  describe("ThemeStamp", () => {
    it("renders live theme stamp and updates on margins-theme-change event", () => {
      applyTheme({ appearance: "light", accent: "rose" });
      render(<ThemeStamp />);
      expect(screen.getByText("light, Rose")).toBeInTheDocument();

      // Trigger theme change wrapped in act
      act(() => {
        applyTheme({ appearance: "dark", accent: "sky" });
        window.dispatchEvent(new Event("margins-theme-change"));
      });

      expect(screen.getByText("dark, Sky")).toBeInTheDocument();
    });
  });
});
