import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AGENTIC_SECURITY_COVERAGE_DOC_RELATIVE_PATH,
  REQUIRED_AGENTIC_SECURITY_COVERAGE_SNIPPETS,
  runAgenticSecurityGuardCoverageCheck,
} from "../scripts/check-agentic-security-guard-coverage";

let fixtureRoot: string;

function completeCoverageMap(): string {
  return REQUIRED_AGENTIC_SECURITY_COVERAGE_SNIPPETS.join("\n");
}

function writeFixture(relativePath: string, content: string): void {
  const fullPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

describe("agentic security guard coverage check", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-agentic-coverage-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("passes when the coverage map contains every required marker", () => {
    writeFixture(
      AGENTIC_SECURITY_COVERAGE_DOC_RELATIVE_PATH,
      completeCoverageMap(),
    );

    const result = runAgenticSecurityGuardCoverageCheck({
      repoRoot: fixtureRoot,
    });

    expect(result).toMatchObject({
      ok: true,
      docExists: true,
      missingSnippets: [],
      requiredSnippets: REQUIRED_AGENTIC_SECURITY_COVERAGE_SNIPPETS,
    });
    expect(result.docPath).toBe(
      path.join(fixtureRoot, AGENTIC_SECURITY_COVERAGE_DOC_RELATIVE_PATH),
    );
  });

  it("fails without exiting when the coverage map document is missing", () => {
    const result = runAgenticSecurityGuardCoverageCheck({
      repoRoot: fixtureRoot,
    });

    expect(result).toMatchObject({
      ok: false,
      docExists: false,
      missingSnippets: [],
      requiredSnippets: REQUIRED_AGENTIC_SECURITY_COVERAGE_SNIPPETS,
    });
    expect(result.docPath).toBe(
      path.join(fixtureRoot, AGENTIC_SECURITY_COVERAGE_DOC_RELATIVE_PATH),
    );
  });

  it("fails without exiting when a required marker is missing", () => {
    const [missingSnippet, ...remainingSnippets] =
      REQUIRED_AGENTIC_SECURITY_COVERAGE_SNIPPETS;
    writeFixture(
      AGENTIC_SECURITY_COVERAGE_DOC_RELATIVE_PATH,
      remainingSnippets.join("\n"),
    );

    const result = runAgenticSecurityGuardCoverageCheck({
      repoRoot: fixtureRoot,
    });

    expect(result).toMatchObject({
      ok: false,
      docExists: true,
      missingSnippets: [missingSnippet],
    });
  });
});
