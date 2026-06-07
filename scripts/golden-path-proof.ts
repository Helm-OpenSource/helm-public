#!/usr/bin/env tsx
/**
 * Golden Path proof package generator.
 *
 * Builds one local, public-safe evidence packet for delivery engineers. The
 * script writes only under a temp directory, reads the current repo, and reuses
 * existing offline checks instead of introducing a new execution surface.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  runDeliveryEngineerGoldenPathDoctor,
  type DeliveryDoctorSummary,
} from "@/lib/delivery-engineer/golden-path-doctor";
import {
  runPackFixtureCheck,
  type PackFixtureCheckSummary,
} from "@/lib/delivery-engineer/pack-fixture-check";
import {
  runHeadlessSignalInterfaceEval,
  type HsiEvalSummary,
} from "@/lib/evals/headless-signal-interface-evals";
import {
  mapCaseRecordToSignals,
  type SampleCaseRecord,
} from "@/extensions/case-management-sample/signals/case/case-mapper";
import { runProfileCommand, type ProfileCommandResult } from "@/tools/source-profiler/src/cli/profile";

import { runPublicDocsCurationCheck, type PublicDocsCurationResult } from "./check-public-docs-curation";
import { runPublicReleaseGuard, type PublicReleaseGuardResult } from "./public-release-guard";

export const DEFAULT_GOLDEN_PATH_PROOF_OUTPUT = "/tmp/helm-golden-path-proof";
const CASE_FIXTURE_PATH = "extensions/case-management-sample/fixtures/case.sample.json";
const SOURCE_PROFILER_SAMPLE_PATH = "tools/source-profiler/fixtures/sample-app";

const NON_CLAIMS = [
  "not customer deployment readiness",
  "not release readiness",
  "not connector authorization",
  "not external send",
  "not writeback",
  "not approval execution",
  "not owner assignment",
  "not official memory promotion",
] as const;

export type GoldenPathProofFile = {
  readonly path: string;
  readonly purpose: string;
};

export type GoldenPathProofManifest = {
  readonly schemaVersion: "helm.golden-path-proof.v1";
  readonly generatedAt: string;
  readonly boundary: "local_tmp_public_safe_read_only_repo_checks";
  readonly repoRoot: string;
  readonly outputDir: string;
  readonly command: "npm run golden:path";
  readonly passed: boolean;
  readonly nonClaims: readonly string[];
  readonly files: readonly GoldenPathProofFile[];
  readonly summary: {
    readonly doctorPassed: boolean;
    readonly packFixturePassed: boolean;
    readonly hsiEvalPassed: boolean;
    readonly publicReleaseGuardPassed: boolean;
    readonly sourceProfilerPassed: boolean | "skipped";
    readonly firstChangeSeverityBefore: string;
    readonly firstChangeSeverityAfter: string;
  };
};

export type FirstChangeSignalSnapshot = {
  readonly caseId: string;
  readonly priorityScore: number;
  readonly severity: string;
  readonly nextAction: string;
  readonly confidence: string;
  readonly reviewRequired: boolean;
};

export type FirstChangeDiffSummary = {
  readonly boundary: "synthetic_fixture_mapper_diff_only";
  readonly fixturePath: string;
  readonly changedField: "priorityScore";
  readonly before: FirstChangeSignalSnapshot;
  readonly after: FirstChangeSignalSnapshot;
  readonly interpretation: string;
};

export type PublicReleaseReceipt = {
  readonly boundary: "public_docs_and_public_release_guard_read_only";
  readonly passed: boolean;
  readonly publicDocs: {
    readonly allowedDocs: number;
    readonly actualDocs: number;
    readonly checkedLinkSources: number;
    readonly violations: PublicDocsCurationResult["violations"];
  };
  readonly publicRelease: {
    readonly scannedFiles: number;
    readonly violations: PublicReleaseGuardResult["violations"];
  };
};

export type SourceProfilerReceipt = {
  readonly boundary: "source_profiler_local_redacted_sample_only";
  readonly passed: boolean;
  readonly skipped?: boolean;
  readonly runDir?: string;
  readonly artifactRefs?: readonly string[];
  readonly scannedFileCount?: number;
  readonly discoveredObjectCount?: number;
  readonly mappingCandidateCount?: number;
  readonly aiCandidateCount?: number;
  readonly redactedReviewPacketWritten?: boolean;
  readonly overlayMaterialized: false;
  readonly error?: string;
};

type GoldenPathProofRunners = {
  readonly runDoctor?: () => DeliveryDoctorSummary;
  readonly runPackFixture?: () => PackFixtureCheckSummary;
  readonly runHsiEval?: () => HsiEvalSummary;
  readonly runPublicDocs?: () => PublicDocsCurationResult;
  readonly runPublicRelease?: () => PublicReleaseGuardResult;
  readonly runSourceProfiler?: (outputDir: string) => Promise<SourceProfilerReceipt>;
};

export type WriteGoldenPathProofOptions = {
  readonly repoRoot?: string;
  readonly outputDir?: string;
  readonly includeSourceProfiler?: boolean;
  readonly now?: () => Date;
  readonly caseRecords?: readonly SampleCaseRecord[];
  readonly runners?: GoldenPathProofRunners;
};

export type GoldenPathProofResult = {
  readonly outputDir: string;
  readonly manifest: GoldenPathProofManifest;
};

function isInsideDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function resolveGoldenPathProofOutputDir(
  outputDir: string = DEFAULT_GOLDEN_PATH_PROOF_OUTPUT,
): string {
  const resolved = path.resolve(outputDir);
  const realResolved = resolveRealCandidatePath(resolved);
  const allowedRoots = [...new Set([path.resolve("/tmp"), path.resolve(os.tmpdir())])].map((root) =>
    realpathSync(root),
  );
  const insideAllowedTemp = allowedRoots.some((root) => isInsideDirectory(root, realResolved));

  if (!insideAllowedTemp) {
    throw new Error(
      `golden:path output must stay under /tmp or os.tmpdir(); received ${outputDir}`,
    );
  }

  return resolved;
}

function resolveRealCandidatePath(candidate: string): string {
  let nearestExisting = candidate;
  while (!existsSync(nearestExisting)) {
    const parent = path.dirname(nearestExisting);
    if (parent === nearestExisting) break;
    nearestExisting = parent;
  }

  const realNearest = realpathSync(nearestExisting);
  const remainder = path.relative(nearestExisting, candidate);
  return remainder ? path.resolve(realNearest, remainder) : realNearest;
}

function readCaseRecords(repoRoot: string): SampleCaseRecord[] {
  const absolutePath = path.join(repoRoot, CASE_FIXTURE_PATH);
  const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${CASE_FIXTURE_PATH} must be an array fixture`);
  }
  return parsed as SampleCaseRecord[];
}

function snapshotFor(record: SampleCaseRecord): FirstChangeSignalSnapshot {
  const signal = mapCaseRecordToSignals(record)[0];
  if (!signal) {
    throw new Error(`case ${record.caseId} did not produce a signal`);
  }

  return {
    caseId: record.caseId,
    priorityScore: record.priorityScore,
    severity: signal.identity.severity,
    nextAction: signal.payload.nextAction,
    confidence: signal.confidence,
    reviewRequired: signal.payload.reviewRequired,
  };
}

export function buildFirstChangeDiffSummary(
  records: readonly SampleCaseRecord[],
): FirstChangeDiffSummary {
  const beforeRecord = records.find((record) => record.caseId === "CASE-SAMPLE-002");
  if (!beforeRecord) {
    throw new Error("CASE-SAMPLE-002 is required for the Golden Path first-change proof");
  }

  const afterRecord: SampleCaseRecord = {
    ...beforeRecord,
    priorityScore: 82,
  };
  const before = snapshotFor(beforeRecord);
  const after = snapshotFor(afterRecord);

  return {
    boundary: "synthetic_fixture_mapper_diff_only",
    fixturePath: CASE_FIXTURE_PATH,
    changedField: "priorityScore",
    before,
    after,
    interpretation:
      "Changing the synthetic case priority from 64 to 82 changes the local mapper severity from info to warning; it does not send, write back, approve, assign, or promote memory.",
  };
}

function buildPublicReleaseReceipt(
  publicDocs: PublicDocsCurationResult,
  publicRelease: PublicReleaseGuardResult,
): PublicReleaseReceipt {
  return {
    boundary: "public_docs_and_public_release_guard_read_only",
    passed: publicDocs.exitCode === 0 && publicRelease.violations.length === 0,
    publicDocs: {
      allowedDocs: publicDocs.allowedDocs.length,
      actualDocs: publicDocs.actualDocs.length,
      checkedLinkSources: publicDocs.checkedLinkSources.length,
      violations: publicDocs.violations,
    },
    publicRelease: {
      scannedFiles: publicRelease.scannedFiles,
      violations: publicRelease.violations,
    },
  };
}

function sourceProfilerReceiptFromResult(
  result: ProfileCommandResult,
): SourceProfilerReceipt {
  return {
    boundary: "source_profiler_local_redacted_sample_only",
    passed: true,
    runDir: "<temp-source-profiler-run>",
    artifactRefs: result.artifactRefs,
    scannedFileCount: result.result.codeScan.scannedFileCount,
    discoveredObjectCount: result.result.codeScan.objects.length,
    mappingCandidateCount: result.result.candidates.length,
    aiCandidateCount: result.aiCandidateCount ?? 0,
    redactedReviewPacketWritten: result.artifactRefs.includes("review-packet.redacted.json"),
    overlayMaterialized: false,
  };
}

async function runSourceProfilerSmoke(repoRoot: string, now: () => Date) {
  const sourceProfilerTempDir = path.join(
    os.tmpdir(),
    `helm-golden-path-source-profiler-${process.pid}`,
  );
  try {
    rmSync(sourceProfilerTempDir, { recursive: true, force: true });
    const result = await runProfileCommand({
      cwd: repoRoot,
      source: SOURCE_PROFILER_SAMPLE_PATH,
      output: sourceProfilerTempDir,
      redact: true,
      aiProvider: "local",
      aiConsent: false,
      now,
    });
    return sourceProfilerReceiptFromResult(result);
  } catch (error) {
    return {
      boundary: "source_profiler_local_redacted_sample_only",
      passed: false,
      overlayMaterialized: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies SourceProfilerReceipt;
  } finally {
    rmSync(sourceProfilerTempDir, { recursive: true, force: true });
  }
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMarkdown(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function buildReadme(manifest: GoldenPathProofManifest): string {
  return [
    "# Helm Golden Path Proof",
    "",
    "Local public-safe evidence packet for delivery engineers.",
    "",
    "This packet is generated from checked-in synthetic fixtures and read-only local checks. It is not customer deployment readiness, release readiness, connector authorization, external send, writeback, approval execution, owner assignment, or official memory promotion.",
    "",
    "## Files",
    "",
    ...manifest.files.map((file) => `- \`${file.path}\` - ${file.purpose}`),
    "",
    "## Re-run",
    "",
    "```bash",
    "npm run golden:path",
    "```",
    "",
  ].join("\n");
}

function buildBoundaryNote(): string {
  return [
    "# Boundary Note",
    "",
    "The Golden Path proof package stays local and writes only under `/tmp/helm-golden-path-proof` by default.",
    "",
    "It does not activate a connector, send externally, write back to a source system, approve an action, assign an owner, promote official memory, claim release readiness, or prove customer deployment readiness.",
    "",
  ].join("\n");
}

function buildNextSafeActions(): string {
  return [
    "# Next Safe Actions",
    "",
    "1. Inspect `fixture-diff-summary.json` and confirm the first-change mapper behavior is expected.",
    "2. Inspect `doctor-receipt.json`, `pack-fixture-receipt.json`, and `hsi-eval-result.json` before changing a sample pack.",
    "3. Use `source-profiler-receipt.json` only as offline candidate-mapping evidence; it does not approve an overlay or connector.",
    "4. Run `npm run check:boundaries` before turning this into a PR.",
    "",
  ].join("\n");
}

function filesForManifest(includeSourceProfiler: boolean): GoldenPathProofFile[] {
  const files: GoldenPathProofFile[] = [
    { path: "MANIFEST.json", purpose: "proof package contract and pass/fail summary" },
    { path: "README.md", purpose: "human-readable local packet entry" },
    { path: "doctor-receipt.json", purpose: "Golden Path doctor receipt" },
    { path: "pack-fixture-receipt.json", purpose: "case-management sample pack fixture receipt" },
    { path: "fixture-diff-summary.json", purpose: "CASE-SAMPLE-002 first-change mapper diff" },
    { path: "hsi-eval-result.json", purpose: "Headless Signal Interface offline eval receipt" },
    { path: "public-release-guard-receipt.json", purpose: "public docs and public-release guard receipt" },
    { path: "boundary-note.md", purpose: "explicit non-claim and forbidden-action boundary" },
    { path: "next-safe-actions.md", purpose: "review-first follow-up checklist" },
  ];
  if (includeSourceProfiler) {
    files.push({
      path: "source-profiler-receipt.json",
      purpose: "offline source-profiler sample-app smoke receipt with redacted review packet",
    });
  }
  return files;
}

export async function writeGoldenPathProof(
  options: WriteGoldenPathProofOptions = {},
): Promise<GoldenPathProofResult> {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const outputDir = resolveGoldenPathProofOutputDir(options.outputDir);
  const includeSourceProfiler = options.includeSourceProfiler ?? true;
  const now = options.now ?? (() => new Date());

  if (!existsSync(path.join(repoRoot, "package.json"))) {
    throw new Error(`repo root does not contain package.json: ${repoRoot}`);
  }

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const doctor = options.runners?.runDoctor?.() ??
    runDeliveryEngineerGoldenPathDoctor({ rootDir: repoRoot });
  const packFixture = options.runners?.runPackFixture?.() ??
    runPackFixtureCheck({ rootDir: repoRoot });
  const hsiEval = options.runners?.runHsiEval?.() ?? runHeadlessSignalInterfaceEval();
  const publicDocs = options.runners?.runPublicDocs?.() ??
    runPublicDocsCurationCheck({ repoRoot });
  const publicRelease = options.runners?.runPublicRelease?.() ??
    runPublicReleaseGuard({ repoRoot });
  const publicReleaseReceipt = buildPublicReleaseReceipt(publicDocs, publicRelease);
  const firstChange = buildFirstChangeDiffSummary(
    options.caseRecords ? [...options.caseRecords] : readCaseRecords(repoRoot),
  );
  const sourceProfiler = includeSourceProfiler
    ? options.runners?.runSourceProfiler
      ? await options.runners.runSourceProfiler(outputDir)
      : await runSourceProfilerSmoke(repoRoot, now)
    : ({
        boundary: "source_profiler_local_redacted_sample_only",
        passed: false,
        skipped: true,
        overlayMaterialized: false,
      } satisfies SourceProfilerReceipt);

  const manifest: GoldenPathProofManifest = {
    schemaVersion: "helm.golden-path-proof.v1",
    generatedAt: now().toISOString(),
    boundary: "local_tmp_public_safe_read_only_repo_checks",
    repoRoot: "<repo>",
    outputDir: "<proof-output>",
    command: "npm run golden:path",
    passed:
      doctor.passed &&
      packFixture.passed &&
      hsiEval.passed &&
      publicReleaseReceipt.passed &&
      (includeSourceProfiler ? sourceProfiler.passed : true),
    nonClaims: NON_CLAIMS,
    files: filesForManifest(includeSourceProfiler),
    summary: {
      doctorPassed: doctor.passed,
      packFixturePassed: packFixture.passed,
      hsiEvalPassed: hsiEval.passed,
      publicReleaseGuardPassed: publicReleaseReceipt.passed,
      sourceProfilerPassed: includeSourceProfiler ? sourceProfiler.passed : "skipped",
      firstChangeSeverityBefore: firstChange.before.severity,
      firstChangeSeverityAfter: firstChange.after.severity,
    },
  };

  writeJson(path.join(outputDir, "MANIFEST.json"), manifest);
  writeMarkdown(path.join(outputDir, "README.md"), buildReadme(manifest));
  writeJson(path.join(outputDir, "doctor-receipt.json"), doctor);
  writeJson(path.join(outputDir, "pack-fixture-receipt.json"), packFixture);
  writeJson(path.join(outputDir, "fixture-diff-summary.json"), firstChange);
  writeJson(path.join(outputDir, "hsi-eval-result.json"), hsiEval);
  writeJson(path.join(outputDir, "public-release-guard-receipt.json"), publicReleaseReceipt);
  if (includeSourceProfiler) {
    writeJson(path.join(outputDir, "source-profiler-receipt.json"), sourceProfiler);
  }
  writeMarkdown(path.join(outputDir, "boundary-note.md"), buildBoundaryNote());
  writeMarkdown(path.join(outputDir, "next-safe-actions.md"), buildNextSafeActions());

  return { outputDir, manifest };
}

function parseOutputDir(argv: readonly string[]): string | undefined {
  const index = argv.findIndex((arg) => arg === "--output");
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((arg) => arg.startsWith("--output="));
  return inline ? inline.slice("--output=".length) : undefined;
}

function hasFlag(argv: readonly string[], flag: string): boolean {
  return argv.includes(flag);
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const result = await writeGoldenPathProof({
    outputDir: parseOutputDir(argv),
    includeSourceProfiler: !hasFlag(argv, "--skip-source-profiler"),
  });
  process.stdout.write(
    `golden:path: ${result.manifest.passed ? "PASS" : "FAIL"} — wrote ${result.outputDir}\n`,
  );
  return result.manifest.passed ? 0 : 1;
}

const isDirect = process.argv[1] && /golden-path-proof\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  void main().then((code) => process.exit(code)).catch((error) => {
    process.stderr.write(`golden:path: error: ${(error as Error).message}\n`);
    process.exit(2);
  });
}
