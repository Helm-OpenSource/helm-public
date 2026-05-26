#!/usr/bin/env tsx
/**
 * Public .dockerignore builder.
 *
 * The private .dockerignore must mention tenant-private roots because the
 * private worktree can build private artifacts. Public mirrors should not
 * expose those root names, so the mirror preflight writes this generic file.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const PUBLIC_DOCKERIGNORE_CONTENT = `node_modules
.next
dist
build
coverage
playwright-report
test-results
.git
.env
.env.*
!.env.example
`;

export type PublicDockerignoreBuildStatus =
  | "already-projected"
  | "wrote-projection"
  | "not-projected";

export type PublicDockerignoreBuildOptions = {
  readonly repoRoot?: string;
  readonly outputPath?: string;
  readonly checkMode?: boolean;
};

export type PublicDockerignoreBuildResult = {
  readonly status: PublicDockerignoreBuildStatus;
  readonly outputPath: string;
  readonly exitCode: 0 | 1;
};

function resolveOutputPath(repoRoot: string, outputPath: string): string {
  return path.isAbsolute(outputPath) ? outputPath : path.join(repoRoot, outputPath);
}

export function buildPublicDockerignore(
  options: PublicDockerignoreBuildOptions = {},
): PublicDockerignoreBuildResult {
  const repoRoot = options.repoRoot ?? process.cwd();
  const outputPath = resolveOutputPath(repoRoot, options.outputPath ?? ".dockerignore");
  const existingContent = existsSync(outputPath)
    ? readFileSync(outputPath, "utf8")
    : null;
  const matches = existingContent === PUBLIC_DOCKERIGNORE_CONTENT;

  if (options.checkMode) {
    return {
      status: matches ? "already-projected" : "not-projected",
      outputPath,
      exitCode: matches ? 0 : 1,
    };
  }

  if (!matches) {
    writeFileSync(outputPath, PUBLIC_DOCKERIGNORE_CONTENT, "utf8");
  }

  return {
    status: matches ? "already-projected" : "wrote-projection",
    outputPath,
    exitCode: 0,
  };
}

function main(): number {
  const checkMode = process.argv.slice(2).includes("--check");
  const result = buildPublicDockerignore({ checkMode });
  const message = `public-dockerignore: ${result.status} — ${result.outputPath}`;
  if (result.exitCode === 0) {
    console.log(message);
  } else {
    console.error(`${message}; run without --check to write the projection.`);
  }
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}
