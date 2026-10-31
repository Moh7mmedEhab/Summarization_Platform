import createMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";

/**
 * Locale routing only. Auth gating happens server-side in the workspace
 * layout (session check + redirect), which cannot be bypassed.
 */
export default createMiddleware(routing);

export const config = {
  // Skip /api, _next, files with extensions (assets), and favicon.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
