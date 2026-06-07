import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runGoldenPathDocsCheck } from "./check-golden-path-docs";

let repoRoot: string;

function writeText(relativePath: string, content: string): void {
  const absolutePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

function seedAlignedDocs(): void {
  writeText(
    "README.md",
    [
      "npm run golden:path",
      "/tmp/helm-golden-path-proof",
      "CASE-SAMPLE-002",
      '"priorityScore": 82',
      "source-profiler",
      "not customer deployment readiness",
    ].join("\n"),
  );
  writeText(
    "docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md",
    [
      "Proof Package Contract",
      "npm run golden:path",
      "/tmp/helm-golden-path-proof",
      "MANIFEST.json",
      "doctor-receipt.json",
      "fixture-diff-summary.json",
      "source-profiler-receipt.json",
      "check:golden-path-docs",
      "not customer deployment readiness",
    ].join("\n"),
  );
  writeText(
    "docs/STATUS.md",
    ["npm run golden:path", "/tmp/helm-golden-path-proof"].join("\n"),
  );
  writeText(
    "package.json",
    JSON.stringify({
      scripts: {
        "golden:path": "node --import tsx scripts/golden-path-proof.ts",
        "check:golden-path-docs": "node --import tsx scripts/check-golden-path-docs.ts",
        "check:boundaries": "npm run check:golden-path-docs && npm run public:smoke:static",
      },
    }),
  );
}

describe("check-golden-path-docs", () => {
  beforeEach(() => {
    repoRoot = mkdtempSync(path.join(os.tmpdir(), "helm-golden-docs-"));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it("passes when docs and package scripts carry the proof package contract", () => {
    seedAlignedDocs();
    expect(runGoldenPathDocsCheck(repoRoot)).toEqual({
      passed: true,
      violations: [],
    });
  });

  it("fails when the /tmp proof package marker drifts out of README", () => {
    seedAlignedDocs();
    writeText(
      "README.md",
      ["npm run golden:path", "CASE-SAMPLE-002", '"priorityScore": 82', "source-profiler"].join("\n"),
    );

    const result = runGoldenPathDocsCheck(repoRoot);

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "marker:missing",
          path: "README.md",
          detail: "/tmp/helm-golden-path-proof",
        }),
      ]),
    );
  });

  it("fails when check:boundaries no longer runs the guard", () => {
    seedAlignedDocs();
    writeText(
      "package.json",
      JSON.stringify({
        scripts: {
          "golden:path": "node --import tsx scripts/golden-path-proof.ts",
          "check:golden-path-docs": "node --import tsx scripts/check-golden-path-docs.ts",
          "check:boundaries": "npm run public:smoke:static",
        },
      }),
    );

    expect(runGoldenPathDocsCheck(repoRoot).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "package-script:boundary-chain-missing" }),
      ]),
    );
  });
});
