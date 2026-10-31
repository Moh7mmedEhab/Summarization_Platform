import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // mammoth (DOCX extraction) is Node-only; keep it out of the bundler
  serverExternalPackages: ["mammoth"],
};

export default withNextIntl(nextConfig);
