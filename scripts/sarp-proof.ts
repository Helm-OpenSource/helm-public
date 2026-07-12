#!/usr/bin/env tsx
/**
 * SARP proof package generator.
 *
 * Builds one local, public-safe evidence packet from synthetic AgentRunCapsule
 * fixtures and deterministic SARP receipts. It writes only under a temp
 * directory and never grants approval, runtime authority, or external effects.
 */

import {
  existsSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { runSarpReview } from "../lib/agentic/sarp-eval";
import {
  SARP_REVIEW_VERSION,
  type SarpReviewReceipt,
  type SarpVerdictCode,
} from "../lib/agentic/sarp-contracts";
import {
  buildDefaultAgenticSarpFixtures,
  type AgenticSarpBoundaryFixture,
} from "./check-agentic-sarp";

export const DEFAULT_SARP_PROOF_OUTPUT = "/tmp/helm-sarp-proof";

const FIXTURE_TIME = "2026-06-08T00:00:00.000Z";

const NON_CLAIMS = [
  "not approval",
  "not customer deployment readiness",
  "not production deployment proof",
  "not connector authorization",
  "not external send",
  "not writeback",
  "not memory promotion",
  "not workflow runtime activation",
] as const;

export type SarpProofFile = {
  readonly path: string;
  readonly purpose: string;
};

export type SarpProofFixtureResult = {
  readonly name: string;
  readonly expectedVerdict: SarpVerdictCode;
  readonly actualVerdict: SarpVerdictCode;
  readonly passed: boolean;
  readonly capsulePath: string;
  readonly receiptPath: string;
  readonly trajectoryReceiptPath: string | null;
};

export type SarpProofManifest = {
  readonly schemaVersion: "helm.sarp-proof.v1";
  readonly generatedAt: string;
  readonly boundary: "local_tmp_public_safe_synthetic_sarp_fixtures";
  readonly outputDir: string;
  readonly command: "npm run sarp:proof";
  readonly sarpVersion: typeof SARP_REVIEW_VERSION;
  readonly passed: boolean;
  readonly nonClaims: readonly string[];
  readonly files: readonly SarpProofFile[];
  readonly summary: {
    readonly fixtureCount: number;
    readonly passedFixtureCount: number;
    readonly failedFixtureCount: number;
    readonly verdicts: Record<SarpVerdictCode, number>;
    readonly humanReviewRequiredCount: number;
    readonly trajectoryReceiptCount: number;
    readonly legacyFixtureCount: number;
  };
  readonly fixtureResults: readonly SarpProofFixtureResult[];
};

export type SarpProofPackageResult = {
  readonly outputDir: string;
  readonly manifest: SarpProofManifest;
};

export type WriteSarpProofPackageOptions = {
  readonly outputDir?: string;
  readonly now?: () => Date;
  readonly fixtures?: readonly AgenticSarpBoundaryFixture[];
};

function isInsideDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
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

export function resolveSarpProofOutputDir(
  outputDir: string = DEFAULT_SARP_PROOF_OUTPUT,
): string {
  const resolved = path.resolve(outputDir);
  const realResolved = resolveRealCandidatePath(resolved);
  const allowedRoots = [...new Set([path.resolve("/tmp"), path.resolve(os.tmpdir())])].map((root) =>
    realpathSync(root),
  );
  const insideAllowedTemp = allowedRoots.some((root) => isInsideDirectory(root, realResolved));

  if (!insideAllowedTemp) {
    throw new Error(`sarp:proof output must stay under /tmp or os.tmpdir(); received ${outputDir}`);
  }

  return resolved;
}

function slugForFixture(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fixture";
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMarkdown(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function writeCapsuleAndReceipt(
  outputDir: string,
  fixture: AgenticSarpBoundaryFixture,
  receipt: SarpReviewReceipt,
): SarpProofFixtureResult {
  const slug = slugForFixture(fixture.name);
  const capsulePath = `capsules/${slug}.agent-run-capsule.json`;
  const receiptPath = `receipts/${slug}.sarp-receipt.json`;
  const trajectoryReceiptPath = fixture.capsule.llmTrajectoryReceipt
    ? `trajectories/${slug}.llm-task-trajectory-receipt.json`
    : null;
  writeJson(path.join(outputDir, capsulePath), fixture.capsule);
  writeJson(path.join(outputDir, receiptPath), receipt);
  if (trajectoryReceiptPath && fixture.capsule.llmTrajectoryReceipt) {
    writeJson(
      path.join(outputDir, trajectoryReceiptPath),
      fixture.capsule.llmTrajectoryReceipt,
    );
  }
  return {
    name: fixture.name,
    expectedVerdict: fixture.expectedVerdict,
    actualVerdict: receipt.verdict,
    passed: receipt.verdict === fixture.expectedVerdict,
    capsulePath,
    receiptPath,
    trajectoryReceiptPath,
  };
}

function summarizeVerdicts(receipts: readonly SarpReviewReceipt[]): Record<SarpVerdictCode, number> {
  return receipts.reduce<Record<SarpVerdictCode, number>>(
    (counts, receipt) => ({
      ...counts,
      [receipt.verdict]: counts[receipt.verdict] + 1,
    }),
    { pass: 0, advisory: 0, block: 0, escalate: 0 },
  );
}

function filesForManifest(fixtureResults: readonly SarpProofFixtureResult[]): SarpProofFile[] {
  return [
    { path: "MANIFEST.json", purpose: "SARP proof package contract and verdict summary" },
    { path: "README.md", purpose: "human-readable local packet entry" },
    { path: "fixture-summary.json", purpose: "synthetic fixture verdict comparison" },
    { path: "boundary-note.md", purpose: "explicit non-claim and forbidden-action boundary" },
    { path: "next-safe-actions.md", purpose: "review-first follow-up checklist" },
    ...fixtureResults.flatMap((fixture) => {
      const files: SarpProofFile[] = [
        { path: fixture.capsulePath, purpose: `${fixture.name} synthetic AgentRunCapsule` },
        { path: fixture.receiptPath, purpose: `${fixture.name} deterministic SARP receipt` },
      ];
      if (fixture.trajectoryReceiptPath) {
        files.push({
          path: fixture.trajectoryReceiptPath,
          purpose: `${fixture.name} public-safe LLM task trajectory receipt`,
        });
      }
      return files;
    }),
  ];
}

function buildReadme(manifest: SarpProofManifest): string {
  return [
    "# Helm SARP Proof",
    "",
    "Local public-safe evidence packet for deterministic SARP v0.1 review receipts.",
    "",
    "This packet is generated from checked-in synthetic AgentRunCapsule fixtures. It is not approval, customer deployment readiness, production deployment proof, connector authorization, external send, writeback, memory promotion, or workflow runtime activation.",
    "",
    "## Files",
    "",
    ...manifest.files.map((file) => `- \`${file.path}\` - ${file.purpose}`),
    "",
    "## Re-run",
    "",
    "```bash",
    "npm run sarp:proof",
    "```",
    "",
  ].join("\n");
}

function buildBoundaryNote(): string {
  return [
    "# Boundary Note",
    "",
    "The SARP proof package stays local and writes only under `/tmp/helm-sarp-proof` by default.",
    "",
    "It does not call an LLM, activate a connector, send externally, write back to a source system, approve an action, assign an owner, promote official memory, claim release readiness, or prove customer deployment readiness.",
    "",
  ].join("\n");
}

function buildNextSafeActions(): string {
  return [
    "# Next Safe Actions",
    "",
    "1. Inspect `fixture-summary.json` and confirm each synthetic fixture verdict matches the expected closed-set verdict.",
    "2. Inspect `receipts/*.sarp-receipt.json` before treating a capsule as review evidence.",
    "3. Treat `block` and `escalate` verdicts as requiring human review; never as automatic approval or execution.",
    "4. Run `npm run check:agentic-sarp` and `npm run check:boundaries` before turning related changes into a PR.",
    "",
  ].join("\n");
}

export async function writeSarpProofPackage(
  options: WriteSarpProofPackageOptions = {},
): Promise<SarpProofPackageResult> {
  const outputDir = resolveSarpProofOutputDir(options.outputDir);
  const now = options.now ?? (() => new Date());
  const fixtures = options.fixtures ?? buildDefaultAgenticSarpFixtures();

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const receipts = fixtures.map((fixture) =>
    runSarpReview(fixture.capsule, { now: () => new Date(FIXTURE_TIME) }),
  );
  const fixtureResults = fixtures.map((fixture, index) =>
    writeCapsuleAndReceipt(outputDir, fixture, receipts[index]),
  );
  const passedFixtureCount = fixtureResults.filter((fixture) => fixture.passed).length;
  const manifest: SarpProofManifest = {
    schemaVersion: "helm.sarp-proof.v1",
    generatedAt: now().toISOString(),
    boundary: "local_tmp_public_safe_synthetic_sarp_fixtures",
    outputDir: "<sarp-proof-output>",
    command: "npm run sarp:proof",
    sarpVersion: SARP_REVIEW_VERSION,
    passed: passedFixtureCount === fixtureResults.length,
    nonClaims: NON_CLAIMS,
    files: filesForManifest(fixtureResults),
    summary: {
      fixtureCount: fixtureResults.length,
      passedFixtureCount,
      failedFixtureCount: fixtureResults.length - passedFixtureCount,
      verdicts: summarizeVerdicts(receipts),
      humanReviewRequiredCount: receipts.filter((receipt) => receipt.humanReviewRequired).length,
      trajectoryReceiptCount: fixtureResults.filter(
        (fixture) => fixture.trajectoryReceiptPath !== null,
      ).length,
      legacyFixtureCount: fixtureResults.filter(
        (fixture) => fixture.trajectoryReceiptPath === null,
      ).length,
    },
    fixtureResults,
  };

  writeJson(path.join(outputDir, "MANIFEST.json"), manifest);
  writeMarkdown(path.join(outputDir, "README.md"), buildReadme(manifest));
  writeJson(path.join(outputDir, "fixture-summary.json"), fixtureResults);
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

async function main(): Promise<number> {
  const result = await writeSarpProofPackage({
    outputDir: parseOutputDir(process.argv.slice(2)),
  });
  process.stdout.write(
    `sarp:proof: ${result.manifest.passed ? "PASS" : "FAIL"} — wrote ${result.outputDir}\n`,
  );
  return result.manifest.passed ? 0 : 1;
}

if (require.main === module) {
  void main().then((code) => process.exit(code)).catch((error) => {
    process.stderr.write(`sarp:proof: error: ${(error as Error).message}\n`);
    process.exit(2);
  });
}
