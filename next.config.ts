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
  // Next dev logs Server Function arguments by default; keep credentials and payloads out of stdout.
  logging: { serverFunctions: false },
  async headers() {
    const privatePage = [
      { key: "Cache-Control", value: "no-store, private" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    // Seat device pairing pages refuse to be framed (design D1 §4.3, clickjacking).
    const noFraming = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    ];
    return [
      ...["/activate-member", "/settings/member-activation"].map(source => ({ source, headers: privatePage })),
      { source: "/device", headers: [...privatePage, ...noFraming] },
    ];
  },
  generateBuildId: releaseBuildId ? async () => releaseBuildId : undefined,
};

export default nextConfig;
