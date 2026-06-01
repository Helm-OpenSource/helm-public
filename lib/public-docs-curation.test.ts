import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runPublicDocsCurationCheck } from "../scripts/check-public-docs-curation";

let fixtureRoot: string;

function writeFixture(relativePath: string, content: string): void {
  const fullPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

function writeManifest(allowedDocs: string[]): void {
  writeFixture(
    "docs/public-docs-manifest.json",
    `${JSON.stringify({ allowedDocs }, null, 2)}\n`,
  );
}

describe("public docs curation guard", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-public-docs-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("passes an explicitly curated public docs surface", () => {
    writeManifest([
      "docs/README.md",
      "docs/getting-started.md",
      "docs/public-docs-manifest.json",
    ]);
    writeFixture("README.md", "[Docs](docs/README.md)\n");
    writeFixture("docs/README.md", "[Getting started](getting-started.md)\n");
    writeFixture("docs/getting-started.md", "# Start\n");

    const result = runPublicDocsCurationCheck({ repoRoot: fixtureRoot });

    expect(result.exitCode).toBe(0);
    expect(result.violations).toEqual([]);
  });

  it("rejects docs that are not named in the manifest", () => {
    writeManifest(["docs/README.md", "docs/public-docs-manifest.json"]);
    writeFixture("docs/README.md", "# Public docs\n");
    writeFixture("docs/reviews/internal-closeout.md", "# Internal\n");

    const result = runPublicDocsCurationCheck({ repoRoot: fixtureRoot });

    expect(result.exitCode).toBe(1);
    expect(result.violations).toContainEqual({
      rule: "docs:unexpected-file",
      path: "docs/reviews/internal-closeout.md",
    });
  });

  it("rejects public entry links to missing or unapproved docs", () => {
    writeManifest([
      "docs/README.md",
      "docs/public-docs-manifest.json",
      "docs/visible.md",
    ]);
    writeFixture("README.md", "[Hidden](docs/hidden.md)\n[Missing](docs/missing.md)\n");
    writeFixture("docs/README.md", "[Visible](visible.md)\n");
    writeFixture("docs/visible.md", "# Visible\n");
    writeFixture("docs/hidden.md", "# Hidden\n");

    const result = runPublicDocsCurationCheck({ repoRoot: fixtureRoot });

    expect(result.exitCode).toBe(1);
    expect(result.violations.map((violation) => violation.rule)).toEqual([
      "docs:unexpected-file",
      "docs:unapproved-doc-link",
      "docs:broken-link",
    ]);
  });
});
