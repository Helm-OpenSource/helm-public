import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveReleaseBuildId } from "./lib/release-build-id";

const configuredAllowedDevOrigins =
  process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const projectRoot = dirname(fileURLToPath(import.meta.url));
const releaseBuildId = resolveReleaseBuildId(process.env.HELM_RELEASE_BUILD_ID);

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["ali-oss"],
  allowedDevOrigins: configuredAllowedDevOrigins,
  async headers() {
    return ["/activate-member", "/settings/member-activation"].map(source => ({ source, headers: [
      { key: "Cache-Control", value: "no-store, private" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] }));
  },
  generateBuildId: releaseBuildId ? async () => releaseBuildId : undefined,
};

export default nextConfig;
