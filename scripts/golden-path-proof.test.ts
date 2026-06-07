import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DeliveryDoctorSummary } from "@/lib/delivery-engineer/golden-path-doctor";
import type { PackFixtureCheckSummary } from "@/lib/delivery-engineer/pack-fixture-check";
import type { HsiEvalSummary } from "@/lib/evals/headless-signal-interface-evals";
import type { PublicDocsCurationResult } from "./check-public-docs-curation";
import type { PublicReleaseGuardResult } from "./public-release-guard";

import {
  buildFirstChangeDiffSummary,
  resolveGoldenPathProofOutputDir,
  writeGoldenPathProof,
  type SourceProfilerReceipt,
} from "./golden-path-proof";

let tempRoot: string;

function writeText(relativePath: string, content: string): void {
  const absolutePath = path.join(tempRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(tempRoot, relativePath), "utf8"));
}

const sampleCase = {
  workspaceId: "workspace-sample",
  caseId: "CASE-SAMPLE-002",
  ownerRefId: "employee-bob",
  stage: "active_followup" as const,
  ageDays: 1,
  priorityScore: 64,
  evidenceCount: 2,
  blockedReason: null,
  observedDate: "2026-05-18",
};

const doctorReceipt: DeliveryDoctorSummary = {
  version: "delivery_engineer_golden_path_doctor_v1",
  boundary: "read_only_local_repo_static_check",
  regionProfile: "global",
  passed: true,
  counts: { pass: 1, warn: 0, fail: 0 },
  checks: [],
  nextCommands: ["npm run golden:path"],
};

const packReceipt: PackFixtureCheckSummary = {
  version: "delivery_engineer_pack_fixture_check_v1",
  boundary: "read_only_pack_fixture_static_check",
  packPath: "extensions/case-management-sample",
  passed: true,
  counts: { pass: 1, warn: 0, fail: 0 },
  checks: [],
  nextCommands: [],
};

const hsiReceipt: HsiEvalSummary = {
  passed: true,
  version: "hsi-fixture-test",
  counts: {
    packsTotal: 1,
    packsPendingOwnerTruth: 0,
    nonSalesforceSourceCount: 1,
    signalFamilyPositiveCount: 1,
    boundaryCount: 1,
    nonScriptedSequenceCount: 1,
  },
  incidents: {
    authorityLeakCount: 0,
    rawDataLeakCount: 0,
    crossWorkspaceCount: 0,
    llmFinalRankingCount: 0,
    packetAsExecutionCount: 0,
  },
  coverage: {
    signalFamiliesCovered: [],
    signalFamiliesMissing: [],
    nonScriptedScenariosCovered: [],
    nonScriptedScenariosMissing: [],
    forbiddenFacadesCovered: [],
    forbiddenFacadesMissing: [],
  },
  failures: [],
};

function publicDocsReceipt(repoRoot: string): PublicDocsCurationResult {
  return {
    repoRoot,
    allowedDocs: [],
    actualDocs: [],
    checkedLinkSources: [],
    violations: [],
    exitCode: 0,
  };
}

const publicReleaseReceipt: PublicReleaseGuardResult = {
  scannedFiles: 1,
  violations: [],
};

const sourceProfilerReceipt: SourceProfilerReceipt = {
  boundary: "source_profiler_local_redacted_sample_only",
  passed: true,
  runDir: "<temp-source-profiler-run>",
  artifactRefs: ["run.json", "review-packet.redacted.json"],
  scannedFileCount: 2,
  discoveredObjectCount: 1,
  mappingCandidateCount: 1,
  aiCandidateCount: 0,
  redactedReviewPacketWritten: true,
  overlayMaterialized: false,
};

describe("golden-path proof package", () => {
  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), "helm-golden-proof-test-"));
    writeText("package.json", JSON.stringify({ scripts: {} }));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("rejects output outside temp roots", () => {
    expect(() => resolveGoldenPathProofOutputDir(process.cwd())).toThrow(/output must stay/);
  });

  it("rejects a temp symlink that resolves outside temp roots", () => {
    const linkPath = path.join(os.tmpdir(), `helm-golden-proof-link-${process.pid}-${Date.now()}`);
    try {
      symlinkSync(process.cwd(), linkPath, "dir");
      expect(() => resolveGoldenPathProofOutputDir(path.join(linkPath, "proof"))).toThrow(
        /output must stay/,
      );
    } finally {
      rmSync(linkPath, { force: true, recursive: true });
    }
  });

  it("captures the synthetic first-change mapper diff", () => {
    const diff = buildFirstChangeDiffSummary([sampleCase]);

    expect(diff.before).toMatchObject({ priorityScore: 64, severity: "info" });
    expect(diff.after).toMatchObject({ priorityScore: 82, severity: "warning" });
    expect(diff.interpretation).toContain("does not send");
  });

  it("writes a manifest and receipts without reading private context", async () => {
    const result = await writeGoldenPathProof({
      repoRoot: tempRoot,
      outputDir: path.join(tempRoot, "proof"),
      now: () => new Date("2026-06-07T00:00:00.000Z"),
      caseRecords: [sampleCase],
      runners: {
        runDoctor: () => doctorReceipt,
        runPackFixture: () => packReceipt,
        runHsiEval: () => hsiReceipt,
        runPublicDocs: () => publicDocsReceipt(tempRoot),
        runPublicRelease: () => publicReleaseReceipt,
        runSourceProfiler: async () => sourceProfilerReceipt,
      },
    });

    expect(result.manifest.passed).toBe(true);
    expect(existsSync(path.join(tempRoot, "proof", "MANIFEST.json"))).toBe(true);
    expect(existsSync(path.join(tempRoot, "proof", "source-profiler-receipt.json"))).toBe(true);
    expect(readJson("proof/MANIFEST.json")).toMatchObject({
      schemaVersion: "helm.golden-path-proof.v1",
      repoRoot: "<repo>",
      command: "npm run golden:path",
      summary: {
        firstChangeSeverityBefore: "info",
        firstChangeSeverityAfter: "warning",
      },
    });
    expect(JSON.stringify(readJson("proof/MANIFEST.json"))).toContain(
      "not customer deployment readiness",
    );
    expect(JSON.stringify(readJson("proof/MANIFEST.json"))).not.toContain(tempRoot);
    expect(JSON.stringify(readJson("proof/source-profiler-receipt.json"))).not.toContain(tempRoot);
  });
});
