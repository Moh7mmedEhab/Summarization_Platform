import createMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";

/**
 * Locale routing only — auth is NOT enforced here. Every server component and
 * every route handler performs its own session check (workspace layout gate +
 * per-page requireSession; API handlers per-handler). This file deliberately
 * stays session-free so /api and middleware never duplicate auth logic.
 */
export default createMiddleware(routing);

export const config = {
  // Skip /api, _next, files with extensions (assets), and favicon.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
