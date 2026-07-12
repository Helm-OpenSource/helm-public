import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { agentRunCapsuleSchema } from "../lib/agentic/run-capsule";
import { buildDefaultAgenticSarpFixtures } from "./check-agentic-sarp";
import {
  resolveSarpProofOutputDir,
  writeSarpProofPackage,
  type SarpProofManifest,
} from "./sarp-proof";

let tempRoot: string;

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(tempRoot, relativePath), "utf8")) as T;
}

describe("sarp proof package", () => {
  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), "helm-sarp-proof-test-"));
    mkdirSync(path.join(tempRoot, "repo"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("rejects output outside temp roots", () => {
    expect(() => resolveSarpProofOutputDir(process.cwd())).toThrow(/output must stay/);
  });

  it("rejects a temp symlink that resolves outside temp roots", () => {
    const linkPath = path.join(os.tmpdir(), `helm-sarp-proof-link-${process.pid}-${Date.now()}`);
    try {
      symlinkSync(process.cwd(), linkPath, "dir");
      expect(() => resolveSarpProofOutputDir(path.join(linkPath, "proof"))).toThrow(
        /output must stay/,
      );
    } finally {
      rmSync(linkPath, { force: true, recursive: true });
    }
  });

  it("writes synthetic capsules and deterministic SARP receipts without leaking local paths", async () => {
    const result = await writeSarpProofPackage({
      outputDir: path.join(tempRoot, "proof"),
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(result.manifest).toMatchObject({
      schemaVersion: "helm.sarp-proof.v1",
      outputDir: "<sarp-proof-output>",
      command: "npm run sarp:proof",
      passed: true,
      summary: {
        fixtureCount: 9,
        passedFixtureCount: 9,
        failedFixtureCount: 0,
        verdicts: { pass: 1, advisory: 1, block: 6, escalate: 1 },
        humanReviewRequiredCount: 7,
        trajectoryReceiptCount: 9,
        legacyFixtureCount: 0,
      },
    });
    expect(existsSync(path.join(tempRoot, "proof", "MANIFEST.json"))).toBe(true);
    expect(existsSync(path.join(tempRoot, "proof", "fixture-summary.json"))).toBe(true);
    expect(existsSync(path.join(tempRoot, "proof", "capsules", "clean-capsule.agent-run-capsule.json"))).toBe(true);
    expect(existsSync(path.join(tempRoot, "proof", "receipts", "clean-capsule.sarp-receipt.json"))).toBe(true);
    expect(
      existsSync(
        path.join(
          tempRoot,
          "proof",
          "trajectories",
          "clean-capsule.llm-task-trajectory-receipt.json",
        ),
      ),
    ).toBe(true);

    const manifestText = readFileSync(path.join(tempRoot, "proof", "MANIFEST.json"), "utf8");
    expect(manifestText).toContain("not approval");
    expect(manifestText).toContain("not workflow runtime activation");
    expect(manifestText).not.toContain(tempRoot);

    const receipt = readJson<{ verdict: string }>("proof/receipts/clean-capsule.sarp-receipt.json");
    expect(receipt.verdict).toBe("pass");
    expect(result.manifest.fixtureResults[0].trajectoryReceiptPath).toBe(
      "trajectories/clean-capsule.llm-task-trajectory-receipt.json",
    );
    expect(result.manifest.files).toContainEqual({
      path: "trajectories/clean-capsule.llm-task-trajectory-receipt.json",
      purpose: "clean-capsule public-safe LLM task trajectory receipt",
    });
    const trajectoryPaths = result.manifest.fixtureResults.flatMap((fixture) =>
      fixture.trajectoryReceiptPath ? [fixture.trajectoryReceiptPath] : [],
    );
    expect(trajectoryPaths).toHaveLength(9);
    expect(
      trajectoryPaths.every((trajectoryPath) =>
        existsSync(path.join(tempRoot, "proof", trajectoryPath)),
      ),
    ).toBe(true);
  });

  it("keeps a legacy fixture without an LLM trajectory receipt compatible", async () => {
    const [fixture] = buildDefaultAgenticSarpFixtures();
    const legacyFixture = {
      ...fixture,
      capsule: agentRunCapsuleSchema.parse({
        ...fixture.capsule,
        llmTrajectoryReceipt: undefined,
      }),
    };

    const result = await writeSarpProofPackage({
      outputDir: path.join(tempRoot, "proof"),
      fixtures: [legacyFixture],
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(result.manifest.passed).toBe(true);
    expect(result.manifest.summary).toMatchObject({
      fixtureCount: 1,
      trajectoryReceiptCount: 0,
      legacyFixtureCount: 1,
    });
    expect(result.manifest.fixtureResults[0].trajectoryReceiptPath).toBeNull();
    expect(result.manifest.files.some((file) => file.path.startsWith("trajectories/"))).toBe(false);
  });

  it("marks the manifest failed when a fixture verdict drifts", async () => {
    const [fixture] = buildDefaultAgenticSarpFixtures();
    const result = await writeSarpProofPackage({
      outputDir: path.join(tempRoot, "proof"),
      fixtures: [{ ...fixture, expectedVerdict: "block" }],
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(result.manifest.passed).toBe(false);
    expect(result.manifest.summary.failedFixtureCount).toBe(1);
    expect(readJson<SarpProofManifest>("proof/MANIFEST.json")).toMatchObject({
      passed: false,
      fixtureResults: [
        {
          name: fixture.name,
          expectedVerdict: "block",
          actualVerdict: "pass",
          passed: false,
        },
      ],
    });
  });
});
