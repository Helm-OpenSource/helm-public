#!/usr/bin/env tsx
/**
 * Golden Path docs guard.
 *
 * Keeps README, requirements, STATUS, package scripts, and the proof package
 * command aligned. This is a small contract check; public docs curation and
 * public-release scanning still enforce the broader public/private boundary.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type GoldenPathDocsViolation = {
  readonly rule:
    | "file:missing"
    | "marker:missing"
    | "package-script:missing"
    | "package-script:boundary-chain-missing";
  readonly path: string;
  readonly detail: string;
};

export type GoldenPathDocsCheckResult = {
  readonly passed: boolean;
  readonly violations: readonly GoldenPathDocsViolation[];
};

const REQUIRED_MARKERS: ReadonlyArray<{
  readonly path: string;
  readonly markers: readonly string[];
}> = [
  {
    path: "README.md",
    markers: [
      "npm run golden:path",
      "/tmp/helm-golden-path-proof",
      "CASE-SAMPLE-002",
      '"priorityScore": 82',
      "source-profiler",
      "not customer deployment readiness",
    ],
  },
  {
    path: "docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md",
    markers: [
      "Proof Package Contract",
      "npm run golden:path",
      "/tmp/helm-golden-path-proof",
      "MANIFEST.json",
      "doctor-receipt.json",
      "fixture-diff-summary.json",
      "source-profiler-receipt.json",
      "check:golden-path-docs",
      "not customer deployment readiness",
    ],
  },
  {
    path: "docs/STATUS.md",
    markers: ["npm run golden:path", "/tmp/helm-golden-path-proof"],
  },
];

const REQUIRED_PACKAGE_SCRIPTS: ReadonlyArray<[string, string]> = [
  ["golden:path", "node --import tsx scripts/golden-path-proof.ts"],
  ["check:golden-path-docs", "node --import tsx scripts/check-golden-path-docs.ts"],
];

function readRepoFile(repoRoot: string, relativePath: string): string | null {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return null;
  return readFileSync(absolutePath, "utf8");
}

function parsePackageScripts(repoRoot: string): Record<string, string> {
  const content = readRepoFile(repoRoot, "package.json");
  if (!content) return {};
  const parsed = JSON.parse(content) as { scripts?: unknown };
  if (!parsed.scripts || typeof parsed.scripts !== "object" || Array.isArray(parsed.scripts)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parsed.scripts).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    }),
  );
}

export function runGoldenPathDocsCheck(repoRoot: string = process.cwd()): GoldenPathDocsCheckResult {
  const violations: GoldenPathDocsViolation[] = [];

  for (const requirement of REQUIRED_MARKERS) {
    const content = readRepoFile(repoRoot, requirement.path);
    if (!content) {
      violations.push({
        rule: "file:missing",
        path: requirement.path,
        detail: "required Golden Path documentation file is missing",
      });
      continue;
    }
    for (const marker of requirement.markers) {
      if (!content.includes(marker)) {
        violations.push({
          rule: "marker:missing",
          path: requirement.path,
          detail: marker,
        });
      }
    }
  }

  const scripts = parsePackageScripts(repoRoot);
  for (const [name, command] of REQUIRED_PACKAGE_SCRIPTS) {
    if (scripts[name] !== command) {
      violations.push({
        rule: "package-script:missing",
        path: "package.json",
        detail: `${name} must be declared as ${command}`,
      });
    }
  }

  if (!scripts["check:boundaries"]?.includes("npm run check:golden-path-docs")) {
    violations.push({
      rule: "package-script:boundary-chain-missing",
      path: "package.json",
      detail: "check:boundaries must include npm run check:golden-path-docs",
    });
  }

  return { passed: violations.length === 0, violations };
}

const isDirect = process.argv[1] && /check-golden-path-docs\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  const result = runGoldenPathDocsCheck();
  if (result.passed) {
    process.stdout.write("golden-path-docs: PASS\n");
    process.exit(0);
  }
  process.stderr.write(`golden-path-docs: FAIL — ${result.violations.length} violation(s)\n`);
  for (const violation of result.violations) {
    process.stderr.write(`  [${violation.rule}] ${violation.path} — ${violation.detail}\n`);
  }
  process.exit(1);
}
