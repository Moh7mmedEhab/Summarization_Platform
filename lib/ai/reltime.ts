/**
 * Locale-aware relative time for the library rows. Numbers/units live here;
 * translated via tiny lookup tables (both are small and reinforced by tests).
 */

type Unit = "now" | "min" | "hour" | "day" | "week" | "month" | "year";

const TABLE = {
  en: {
    now: () => "just now",
    min: (n: number) => `${n}m ago`,
    hour: (n: number) => `${n}h ago`,
    day: (n: number) => `${n}d ago`,
    week: (n: number) => `${n}w ago`,
    month: (n: number) => `${n}mo ago`,
    year: (n: number) => `${n}y ago`,
  },
  ar: {
    now: () => "للآن",
    min: (n: number) => `قبل ${n} د`,
    hour: (n: number) => `قبل ${n} س`,
    day: (n: number) => `قبل ${n} ي`,
    week: (n: number) => `قبل ${n} أ`,
    month: (n: number) => `قبل ${n} ش`,
    year: (n: number) => `قبل ${n} س`,
  },
} as const;

export function relTime(iso: string, locale: string): string {
  const table = locale === "ar" ? TABLE.ar : TABLE.en;
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return table.now();
  const pick = (u: Unit, n: number) => table[u](n);
  if (minutes < 60) return pick("min", minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return pick("hour", hours);
  const days = Math.floor(hours / 24);
  if (days < 7) return pick("day", days);
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return pick("week", weeks);
  const months = Math.floor(days / 30);
  if (months < 12) return pick("month", months);
  return pick("year", Math.floor(days / 365));
}
