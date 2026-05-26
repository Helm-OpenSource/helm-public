#!/usr/bin/env tsx
/**
 * Public package manifest builder.
 *
 * Generates the public-mirror `package.json` projection without mutating the
 * private worktree by default. Mirror pipelines can either capture stdout or
 * pass `--out <path>` after copying the repo into a public-mirror directory.
 *
 * Usage:
 *   npx tsx scripts/build-public-package-manifest.ts
 *   npx tsx scripts/build-public-package-manifest.ts --out package.json
 *   npx tsx scripts/build-public-package-manifest.ts --check --out package.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  projectPublicPackageManifest,
  validatePublicPackageManifestProjection,
  type PublicPackageManifestProjection,
  type Violation,
} from "./public-release-guard";

export type PublicPackageManifestBuildStatus =
  | "printed-projection"
  | "already-projected"
  | "wrote-projection"
  | "not-projected"
  | "invalid-projection";

export type PublicPackageManifestBuildOptions = {
  readonly repoRoot?: string;
  readonly sourcePath?: string;
  readonly outputPath?: string;
  readonly checkMode?: boolean;
  readonly stdout?: (content: string) => void;
};

export type PublicPackageManifestBuildResult = {
  readonly status: PublicPackageManifestBuildStatus;
  readonly sourcePath: string;
  readonly outputPath: string | null;
  readonly removedScripts: ReadonlyArray<string>;
  readonly violations: ReadonlyArray<Violation>;
  readonly exitCode: 0 | 1;
};

function resolveFilePath(repoRoot: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
}

function readJsonObject(filePath: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function stringifyManifest(projection: PublicPackageManifestProjection): string {
  return `${JSON.stringify(projection.manifest, null, 2)}\n`;
}

export function buildPublicPackageManifest(
  options: PublicPackageManifestBuildOptions = {},
): PublicPackageManifestBuildResult {
  const repoRoot = options.repoRoot ?? process.cwd();
  const sourcePath = resolveFilePath(repoRoot, options.sourcePath ?? "package.json");
  const outputPath = options.outputPath
    ? resolveFilePath(repoRoot, options.outputPath)
    : null;
  const projection = projectPublicPackageManifest(readJsonObject(sourcePath));
  const relativeSourcePath = path.relative(repoRoot, sourcePath) || "package.json";
  const violations = validatePublicPackageManifestProjection(
    projection,
    relativeSourcePath,
  );

  if (violations.length > 0) {
    return {
      status: "invalid-projection",
      sourcePath,
      outputPath,
      removedScripts: projection.removedScripts,
      violations,
      exitCode: 1,
    };
  }

  const projectedContent = stringifyManifest(projection);

  if (!outputPath) {
    if (options.checkMode) {
      const sourceContent = readFileSync(sourcePath, "utf8");
      const matches = sourceContent === projectedContent;
      return {
        status: matches ? "already-projected" : "not-projected",
        sourcePath,
        outputPath: null,
        removedScripts: projection.removedScripts,
        violations: [],
        exitCode: matches ? 0 : 1,
      };
    }

    options.stdout?.(projectedContent);
    return {
      status: "printed-projection",
      sourcePath,
      outputPath: null,
      removedScripts: projection.removedScripts,
      violations: [],
      exitCode: 0,
    };
  }

  const existingContent = existsSync(outputPath)
    ? readFileSync(outputPath, "utf8")
    : null;
  const matches = existingContent === projectedContent;

  if (options.checkMode) {
    return {
      status: matches ? "already-projected" : "not-projected",
      sourcePath,
      outputPath,
      removedScripts: projection.removedScripts,
      violations: [],
      exitCode: matches ? 0 : 1,
    };
  }

  if (!matches) {
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, projectedContent, "utf8");
  }

  return {
    status: matches ? "already-projected" : "wrote-projection",
    sourcePath,
    outputPath,
    removedScripts: projection.removedScripts,
    violations: [],
    exitCode: 0,
  };
}

function parseArgs(args: string[]): PublicPackageManifestBuildOptions {
  const options: {
    checkMode?: boolean;
    outputPath?: string;
    sourcePath?: string;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") {
      options.checkMode = true;
      continue;
    }
    if (arg === "--out") {
      const value = args[index + 1];
      if (!value) throw new Error("--out requires a file path");
      options.outputPath = value;
      index += 1;
      continue;
    }
    if (arg === "--source") {
      const value = args[index + 1];
      if (!value) throw new Error("--source requires a file path");
      options.sourcePath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function main(): number {
  let result: PublicPackageManifestBuildResult;
  try {
    result = buildPublicPackageManifest({
      ...parseArgs(process.argv.slice(2)),
      stdout: (content) => process.stdout.write(content),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (result.status === "printed-projection") return result.exitCode;

  const outputLabel = result.outputPath ?? result.sourcePath;
  if (result.exitCode === 0) {
    console.log(
      `public-package-manifest: ${result.status} — ${outputLabel}; removed ${result.removedScripts.length} private script(s).`,
    );
    return 0;
  }

  if (result.violations.length > 0) {
    console.error(
      `public-package-manifest: ${result.status} — ${result.violations.length} projection violation(s).`,
    );
    for (const violation of result.violations) {
      console.error(`${violation.path}:${violation.line}: ${violation.rule}`);
    }
    return result.exitCode;
  }

  console.error(
    `public-package-manifest: ${result.status} — ${outputLabel}; run without --check to write the projection.`,
  );
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}
