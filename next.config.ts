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
  allowedDevOrigins: configuredAllowedDevOrigins,
  generateBuildId: releaseBuildId ? async () => releaseBuildId : undefined,
};

export default nextConfig;
