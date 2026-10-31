import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth (and the pg buffer module) are Node-only; keep them out of the bundler
  serverExternalPackages: ["mammoth"],
};

export default nextConfig;
