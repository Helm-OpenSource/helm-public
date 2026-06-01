#!/usr/bin/env tsx
/**
 * Public mirror preflight.
 *
 * Runs the narrow public-mirror projections that are safe to apply after a
 * mirror tree has already been created:
 *   1. project package.json into its public shape
 *   2. replace .env.example with the public local-dev example
 *   3. replace .dockerignore with the public generic ignore list
 *   4. strip the migration-source banner from README.md (repo-split internals)
 *
 * Note (repo-split 5C): there is NO longer an extensions-registry projection.
 * Since 5A inverted the registry to a read-only seam, the real
 * lib/extensions/registry.tsx imports no tenant code and degrades to the
 * "no extension available" shape when no Pack registers (the mirror omits the
 * private extensions/pack-bootstrap.ts, so instrumentation finds no bootstrap
 * and the store stays empty). The mirror therefore ships the real registry
 * unchanged; the former build-public-mirror-extensions-stub.ts has been removed.
 * Evidence: lib/extensions/registry-core-only-mirror-parity.test.ts.
 *
 * This script does NOT copy the repo, delete tenant-private roots, rewrite git
 * history, scan source maps, or produce an SBOM. It is intentionally only the
 * coordinator for the two deterministic projections that already have their
 * own tests.
 *
 * Usage:
 *   npx tsx scripts/build-public-mirror-preflight.ts --mirror-root /path/to/mirror
 *   npx tsx scripts/build-public-mirror-preflight.ts --mirror-root /path/to/mirror --check
 */

import path from "node:path";

import {
  buildPublicDockerignore,
  type PublicDockerignoreBuildResult,
} from "./build-public-dockerignore";
import {
  buildPublicEnvExample,
  type PublicEnvExampleBuildResult,
} from "./build-public-env-example";
import {
  buildPublicPackageManifest,
  type PublicPackageManifestBuildResult,
} from "./build-public-package-manifest";
import {
  buildPublicReadme,
  type PublicReadmeBuildResult,
} from "./build-public-readme";

export type PublicMirrorPreflightOptions = {
  readonly mirrorRoot: string;
  readonly checkMode?: boolean;
};

export type PublicMirrorPreflightResult = {
  readonly mirrorRoot: string;
  readonly packageManifest: PublicPackageManifestBuildResult;
  readonly envExample: PublicEnvExampleBuildResult;
  readonly dockerignore: PublicDockerignoreBuildResult;
  readonly readme: PublicReadmeBuildResult;
  readonly exitCode: 0 | 1;
};

function resolveMirrorRoot(mirrorRoot: string): string {
  return path.resolve(mirrorRoot);
}

export function buildPublicMirrorPreflight(
  options: PublicMirrorPreflightOptions,
): PublicMirrorPreflightResult {
  const mirrorRoot = resolveMirrorRoot(options.mirrorRoot);
  const packageManifest = buildPublicPackageManifest({
    repoRoot: mirrorRoot,
    outputPath: "package.json",
    checkMode: options.checkMode,
  });
  const envExample = buildPublicEnvExample({
    repoRoot: mirrorRoot,
    checkMode: options.checkMode,
  });
  const dockerignore = buildPublicDockerignore({
    repoRoot: mirrorRoot,
    checkMode: options.checkMode,
  });
  const readme = buildPublicReadme({
    repoRoot: mirrorRoot,
    checkMode: options.checkMode,
  });
  const exitCode =
    packageManifest.exitCode === 0 &&
    envExample.exitCode === 0 &&
    dockerignore.exitCode === 0 &&
    readme.exitCode === 0
      ? 0
      : 1;

  return {
    mirrorRoot,
    packageManifest,
    envExample,
    dockerignore,
    readme,
    exitCode,
  };
}

function parseArgs(args: string[]): PublicMirrorPreflightOptions {
  let mirrorRoot: string | undefined;
  let checkMode = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") {
      checkMode = true;
      continue;
    }
    if (arg === "--mirror-root") {
      const value = args[index + 1];
      if (!value) throw new Error("--mirror-root requires a directory path");
      mirrorRoot = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!mirrorRoot) {
    throw new Error(
      "--mirror-root is required; run this only against a prepared public mirror tree.",
    );
  }

  return { checkMode, mirrorRoot };
}

function main(): number {
  let result: PublicMirrorPreflightResult;
  try {
    result = buildPublicMirrorPreflight(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const lines = [
    `public-mirror-preflight: ${result.exitCode === 0 ? "PASS" : "FAIL"} — ${result.mirrorRoot}`,
    `package-json: ${result.packageManifest.status}; removed ${result.packageManifest.removedScripts.length} private script(s)`,
    `extensions-registry: ships-real-registry (no stub; 5C)`,
    `env-example: ${result.envExample.status}`,
    `dockerignore: ${result.dockerignore.status}`,
    `readme: ${result.readme.status}`,
  ];

  if (result.exitCode === 0) {
    console.log(lines.join("\n"));
  } else {
    console.error(lines.join("\n"));
  }

  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}
