#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const AGENTIC_SECURITY_COVERAGE_DOC_RELATIVE_PATH =
  "docs/reviews/HELM_AGENTIC_SECURITY_GUARD_COVERAGE_MAP.md";

export const REQUIRED_AGENTIC_SECURITY_COVERAGE_SNIPPETS = [
  "status: active",
  "owner:",
  "created:",
  "review_after:",
  "archive_trigger:",
  "review-first",
  "no auto-send",
  "no broad auto-write",
  "no hidden production adoption",
  "N > 5",
  "npm run check:public-release",
  "npm run check:secret-history",
  "npm run check:boundaries",
  "npm run quality:regression",
  "lib/memory/write-governance-routes.test.ts",
  "lib/auth/insight-governance-routes.test.ts",
] as const;

export type AgenticSecurityGuardCoverageOptions = {
  readonly docPath?: string;
  readonly repoRoot?: string;
  readonly requiredSnippets?: readonly string[];
};

export type AgenticSecurityGuardCoverageResult = {
  readonly ok: boolean;
  readonly docPath: string;
  readonly docExists: boolean;
  readonly missingSnippets: readonly string[];
  readonly requiredSnippets: readonly string[];
};

export function runAgenticSecurityGuardCoverageCheck(
  options: AgenticSecurityGuardCoverageOptions = {},
): AgenticSecurityGuardCoverageResult {
  const docPath = resolve(
    options.repoRoot ?? process.cwd(),
    options.docPath ?? AGENTIC_SECURITY_COVERAGE_DOC_RELATIVE_PATH,
  );
  const requiredSnippets =
    options.requiredSnippets ?? REQUIRED_AGENTIC_SECURITY_COVERAGE_SNIPPETS;

  if (!existsSync(docPath)) {
    return {
      ok: false,
      docPath,
      docExists: false,
      missingSnippets: [],
      requiredSnippets,
    };
  }

  const docContent = readFileSync(docPath, "utf8");
  const missingSnippets = requiredSnippets.filter(
    (snippet) => !docContent.includes(snippet),
  );

  if (missingSnippets.length > 0) {
    return {
      ok: false,
      docPath,
      docExists: true,
      missingSnippets,
      requiredSnippets,
    };
  }

  return {
    ok: true,
    docPath,
    docExists: true,
    missingSnippets: [],
    requiredSnippets,
  };
}

function main(): number {
  const result = runAgenticSecurityGuardCoverageCheck();

  if (result.ok) {
    console.log(
      `[check:agentic-security-guard-coverage] OK — coverage map present and contains ${result.requiredSnippets.length} required marker(s).`,
    );
    return 0;
  }

  if (!result.docExists) {
    console.error(
      `[check:agentic-security-guard-coverage] FAIL — missing doc: ${result.docPath}`,
    );
    return 1;
  }

  console.error(
    `[check:agentic-security-guard-coverage] FAIL — missing required marker(s):\n- ${result.missingSnippets.join("\n- ")}`,
  );
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
