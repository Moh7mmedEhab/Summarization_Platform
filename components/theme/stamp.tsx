"use client";

import { useEffect, useState } from "react";
import { ACCENT_LABEL, onThemeChange, readTheme } from "@/lib/theme";

/* The label column's per-8.2 "summary of current values": it updates with every pick. */

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function ThemeStamp() {
  const [stamp, setStamp] = useState("light, Rose");

  useEffect(() => {
    const sync = () => {
      const t = readTheme();
      setStamp(`${t.appearance}, ${ACCENT_LABEL[t.accent]}`);
    };
    sync();
    return onThemeChange(sync);
  }, []);

  return <>{stamp}</>;
}
