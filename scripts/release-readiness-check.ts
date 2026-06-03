#!/usr/bin/env tsx
/**
 * Helm public Core release readiness gate
 *
 * Single-command public Core pre-tag check: runs the public-safe validation
 * chain plus prints a manual-action checklist for items that depend on
 * external coordination (credential rotation, secret-history remediation,
 * response/on-call posture, audit-trace public posture, Required Reviewer
 * approval, redacted live DB calibration, Docker smoke).
 *
 * Exit code:
 *   0 — every automated check passed AND every manual checklist item is
 *       acknowledged via env var
 *   1 — any automated check failed, OR a manual checklist item is missing
 *
 * Usage:
 *   # Local pre-tag rehearsal (skips the heavier suite):
 *   npm run release:check
 *
 *   # Full pre-tag run:
 *   RELEASE_READINESS_FULL=true npm run release:check
 *
 *   # Configure the next release train when not checking the default v0.1.0-trial:
 *   HELM_RELEASE_CHANNEL=trial \
 *   HELM_RELEASE_TARGET_TAG=v0.2.0-trial \
 *   HELM_RELEASE_TARGET_TITLE="Helm v0.2.0-trial" \
 *   RELEASE_READINESS_FULL=true \
 *   npm run release:check
 *
 *   # Acknowledge each manual item before final tag:
 *   RELEASE_READINESS_CREDENTIAL_ROTATED=2026-04-27 \
 *   RELEASE_READINESS_SECRET_HISTORY_REMEDIATED=2026-05-02 \
 *   RELEASE_READINESS_DOCKER_SMOKE_PASSED=2026-04-27 \
 *   RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY=2026-05-02 \
 *   RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE=claim_withdrawn \
 *   RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID=appr-2026-05-30-... \
 *   RELEASE_READINESS_CALIBRATION_REPORT=docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md \
 *   RELEASE_READINESS_FULL=true \
 *   npm run release:check
 *
 * This script does NOT tag a release. It only decides whether the configured
 * release target is allowed to enter the manual tagging step.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIRROR_CLEAN_RECEIPT_PATTERN = /^mirror-clean:[A-Za-z0-9][A-Za-z0-9._-]{5,119}$/;
const MIRROR_CLEAN_RECEIPT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{5,119}$/;
const APPROVAL_RECORD_ID_PATTERN = /^appr-[A-Za-z0-9][A-Za-z0-9._-]{7,119}$/;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const REQUIRED_CALIBRATION_REPORT_PATH =
  "docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md";
export const PUBLIC_MIRROR_CLEAN_RECEIPT_DIR =
  "docs/operations/release-readiness-receipts";
export const PUBLIC_MIRROR_CLEAN_RECEIPT_KIND = "public-mirror-clean";
export const RELEASE_READINESS_TARGET_TAG = "v0.1.0-trial";
export const RELEASE_READINESS_TARGET_TITLE = "Helm v0.1.0-trial";
export const RELEASE_READINESS_DEFAULT_CHANNEL = "trial";

export type ReleaseChannel = "trial" | "stable";

type Step = {
  readonly id: string;
  readonly description: string;
  readonly command: string;
  readonly fullChainOnly?: boolean;
};

type ManualChecklistItem = {
  readonly id: string;
  readonly envKey: string;
  readonly description: string;
  readonly howToSatisfy: string;
  readonly validate?: (value: string) => string | undefined;
};

export type ExistingReleaseTag = {
  readonly name: string;
  readonly targetCommit?: string;
};

export type ReleaseTagStrategyInput = {
  readonly currentHead: string;
  readonly existingTags: ReadonlyArray<ExistingReleaseTag>;
  readonly targetTag?: string;
  readonly targetTitle?: string;
  readonly releaseChannel?: ReleaseChannel;
};

export type ReleaseTagStrategy = {
  readonly targetTag: string;
  readonly targetCommit: string;
  readonly releaseFlags: ReadonlyArray<string>;
  readonly manualCommands: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly blockingIssues: ReadonlyArray<string>;
};

export type ReleaseTargetConfig = {
  readonly targetTag: string;
  readonly targetTitle: string;
  readonly releaseChannel: ReleaseChannel;
  readonly configurationErrors: ReadonlyArray<string>;
};

export type PublicMirrorCleanReceiptCommandEvidence = {
  readonly command: string;
  readonly completedAt: string;
  readonly exitCode: number;
  readonly scannedFiles?: number;
};

export type PublicMirrorCleanReceipt = {
  readonly receiptId: string;
  readonly kind: typeof PUBLIC_MIRROR_CLEAN_RECEIPT_KIND;
  readonly createdAt: string;
  readonly sourceRef: string;
  readonly commandEvidence: ReadonlyArray<PublicMirrorCleanReceiptCommandEvidence>;
  readonly notes?: string;
};

type SecretHistoryReceiptValidationOptions = {
  readonly repoRoot?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCommit(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}

function shortCommit(value: string | undefined): string {
  return value ? value.slice(0, 8) : "unknown";
}

function parseTagVersionBase(tagName: string): [number, number, number] | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i.exec(tagName.trim());
  return match
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : undefined;
}

function parseStableTagVersion(tagName: string): [number, number, number] | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/i.exec(tagName.trim());
  return match
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : undefined;
}

function compareVersionTuple(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function findHighestStableTag(
  existingTags: ReadonlyArray<ExistingReleaseTag>,
): ExistingReleaseTag | undefined {
  return existingTags
    .filter((tag) => parseStableTagVersion(tag.name))
    .sort((a, b) =>
      compareVersionTuple(
        parseStableTagVersion(b.name) ?? [0, 0, 0],
        parseStableTagVersion(a.name) ?? [0, 0, 0],
      ),
    )[0];
}

export function resolveReleaseTargetFromEnv(
  env: Record<string, string | undefined> = process.env,
): ReleaseTargetConfig {
  const targetTag = env.HELM_RELEASE_TARGET_TAG?.trim() || RELEASE_READINESS_TARGET_TAG;
  const targetTitle = env.HELM_RELEASE_TARGET_TITLE?.trim() || `Helm ${targetTag}`;
  const configuredChannel = env.HELM_RELEASE_CHANNEL?.trim();
  const configurationErrors: string[] = [];
  let releaseChannel: ReleaseChannel = RELEASE_READINESS_DEFAULT_CHANNEL;

  if (configuredChannel === "stable" || configuredChannel === "trial") {
    releaseChannel = configuredChannel;
  } else if (configuredChannel) {
    configurationErrors.push("HELM_RELEASE_CHANNEL must be trial or stable.");
  }

  return {
    targetTag,
    targetTitle,
    releaseChannel,
    configurationErrors,
  };
}

function releaseFlagsForTagPlan(
  releaseChannel: ReleaseChannel,
  highestStableTag: ExistingReleaseTag | undefined,
): string[] {
  const flags =
    releaseChannel === "stable"
      ? ["--latest", "--generate-notes"]
      : ["--prerelease", "--latest=false", "--generate-notes"];
  if (highestStableTag) {
    flags.push(`--notes-start-tag ${highestStableTag.name}`);
  }
  return flags;
}

export function buildReleaseTagStrategy(input: ReleaseTagStrategyInput): ReleaseTagStrategy {
  const targetTag = input.targetTag ?? RELEASE_READINESS_TARGET_TAG;
  const targetTitle = input.targetTitle ?? `Helm ${targetTag}`;
  const releaseChannel = input.releaseChannel ?? RELEASE_READINESS_DEFAULT_CHANNEL;
  const targetCommit = input.currentHead.trim();
  const targetVersion = parseTagVersionBase(targetTag);
  const targetTagRecord = input.existingTags.find((tag) => tag.name === targetTag);
  const highestStableTag = findHighestStableTag(input.existingTags);
  const releaseFlags = releaseFlagsForTagPlan(releaseChannel, highestStableTag);
  const warnings: string[] = [];
  const blockingIssues: string[] = [];

  if (targetTagRecord?.targetCommit) {
    const current = normalizeCommit(targetCommit);
    const existing = normalizeCommit(targetTagRecord.targetCommit);
    if (current && existing && current !== existing) {
      blockingIssues.push(
        `${targetTag} already exists at ${shortCommit(targetTagRecord.targetCommit)}, not current HEAD ${shortCommit(targetCommit)}. Do not create or publish a release until the tag target is reconciled.`,
      );
    }
  }

  if (highestStableTag && targetVersion) {
    const highestStableVersion = parseStableTagVersion(highestStableTag.name);
    const stableComparison = highestStableVersion
      ? compareVersionTuple(highestStableVersion, targetVersion)
      : 0;
    if (highestStableVersion && stableComparison > 0) {
      if (releaseChannel === "stable") {
        blockingIssues.push(
          `Stable release target ${targetTag} must be greater than existing stable release tag ${highestStableTag.name}. Use releaseChannel=trial for prereleases, or update the version strategy before tagging.`,
        );
      } else {
        warnings.push(
          `Existing stable release tag ${highestStableTag.name} is higher than ${targetTag}; publish ${targetTag} only as a prerelease with --latest=false, or update the version strategy before tagging.`,
        );
      }
    }
    if (releaseChannel === "stable" && highestStableVersion && stableComparison === 0) {
      blockingIssues.push(
        `Stable release target ${targetTag} must be greater than existing stable release tag ${highestStableTag.name}. Reusing the same stable version would create release-latest ambiguity.`,
      );
    }
  }

  if (releaseChannel === "stable" && !parseStableTagVersion(targetTag)) {
    blockingIssues.push(
      `Stable release target ${targetTag} must be a stable semver tag such as v1.0.1.`,
    );
  }

  if (blockingIssues.length > 0) {
    return {
      targetTag,
      targetCommit,
      releaseFlags,
      manualCommands: [],
      warnings,
      blockingIssues,
    };
  }

  const releaseCommand = [
    "gh release create",
    targetTag,
    "--verify-tag",
    `--title "${targetTitle}"`,
    ...releaseFlags,
  ].join(" ");
  const manualCommands = targetTagRecord
    ? [releaseCommand]
    : [
        `git tag -a ${targetTag} ${targetCommit} -m "${targetTitle} release gate passed"`,
        `git push origin ${targetTag}`,
        releaseCommand,
      ];

  return {
    targetTag,
    targetCommit,
    releaseFlags,
    manualCommands,
    warnings,
    blockingIssues,
  };
}

export function validateReleaseReadinessDate(envKey: string, value: string): string | undefined {
  if (!ISO_DATE_PATTERN.test(value)) {
    return `${envKey} must be a YYYY-MM-DD date.`;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return `${envKey} must be a valid calendar date.`;
  }

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  if (value > today) {
    return `${envKey} must not be a future date.`;
  }

  return undefined;
}

export function validateSecretHistoryReceipt(
  value: string,
  options: SecretHistoryReceiptValidationOptions = {},
): string | undefined {
  if (ISO_DATE_PATTERN.test(value)) {
    return validateReleaseReadinessDate("RELEASE_READINESS_SECRET_HISTORY_REMEDIATED", value);
  }

  if (!MIRROR_CLEAN_RECEIPT_PATTERN.test(value)) {
    return "RELEASE_READINESS_SECRET_HISTORY_REMEDIATED must be a YYYY-MM-DD date or mirror-clean:<receipt-id>.";
  }

  return validatePublicMirrorCleanReceiptFile(value.slice("mirror-clean:".length), options);
}

export function getPublicMirrorCleanReceiptPath(
  receiptId: string,
  options: SecretHistoryReceiptValidationOptions = {},
): string {
  return join(
    options.repoRoot ?? process.cwd(),
    PUBLIC_MIRROR_CLEAN_RECEIPT_DIR,
    `${receiptId}.json`,
  );
}

function commandEvidenceUsesPublicMirrorGate(
  evidence: PublicMirrorCleanReceiptCommandEvidence,
): boolean {
  if (evidence.exitCode !== 0) return false;
  return (
    evidence.command.includes("npm run public-mirror:build -- --mirror-root") ||
    evidence.command.includes("npm run public-mirror:verify -- --mirror-root")
  );
}

export function validatePublicMirrorCleanReceiptDocument(
  receiptId: string,
  receipt: unknown,
): string | undefined {
  if (!MIRROR_CLEAN_RECEIPT_ID_PATTERN.test(receiptId)) {
    return `Invalid public mirror clean receipt id: ${receiptId}`;
  }
  if (!isRecord(receipt)) {
    return "Public mirror clean receipt must be a JSON object.";
  }
  if (receipt.receiptId !== receiptId) {
    return "Public mirror clean receipt receiptId must match mirror-clean:<receipt-id>.";
  }
  if (receipt.kind !== PUBLIC_MIRROR_CLEAN_RECEIPT_KIND) {
    return `Public mirror clean receipt kind must be ${PUBLIC_MIRROR_CLEAN_RECEIPT_KIND}.`;
  }
  if (typeof receipt.createdAt !== "string") {
    return "Public mirror clean receipt createdAt must be a YYYY-MM-DD date.";
  }
  const createdAtError = validateReleaseReadinessDate(
    "public mirror clean receipt createdAt",
    receipt.createdAt,
  );
  if (createdAtError) return createdAtError;
  if (typeof receipt.sourceRef !== "string" || receipt.sourceRef.trim().length === 0) {
    return "Public mirror clean receipt sourceRef must be a non-empty string.";
  }
  if (!Array.isArray(receipt.commandEvidence) || receipt.commandEvidence.length === 0) {
    return "Public mirror clean receipt commandEvidence must include at least one command.";
  }

  const commandEvidence: PublicMirrorCleanReceiptCommandEvidence[] = [];
  for (const evidence of receipt.commandEvidence) {
    if (!isRecord(evidence)) {
      return "Public mirror clean receipt commandEvidence entries must be JSON objects.";
    }
    if (typeof evidence.command !== "string" || evidence.command.trim().length === 0) {
      return "Public mirror clean receipt commandEvidence.command must be non-empty.";
    }
    if (typeof evidence.completedAt !== "string") {
      return "Public mirror clean receipt commandEvidence.completedAt must be a YYYY-MM-DD date.";
    }
    const completedAtError = validateReleaseReadinessDate(
      "public mirror clean receipt commandEvidence.completedAt",
      evidence.completedAt,
    );
    if (completedAtError) return completedAtError;
    if (evidence.exitCode !== 0) {
      return "Public mirror clean receipt commandEvidence.exitCode must be 0.";
    }
    const scannedFiles = evidence.scannedFiles;
    if (
      scannedFiles !== undefined &&
      (typeof scannedFiles !== "number" ||
        !Number.isInteger(scannedFiles) ||
        scannedFiles < 0)
    ) {
      return "Public mirror clean receipt commandEvidence.scannedFiles must be a non-negative integer.";
    }
    commandEvidence.push({
      command: evidence.command,
      completedAt: evidence.completedAt,
      exitCode: evidence.exitCode,
      scannedFiles: scannedFiles as number | undefined,
    });
  }

  if (!commandEvidence.some(commandEvidenceUsesPublicMirrorGate)) {
    return "Public mirror clean receipt must include a successful public-mirror:build or public-mirror:verify command.";
  }

  return undefined;
}

export function validatePublicMirrorCleanReceiptFile(
  receiptId: string,
  options: SecretHistoryReceiptValidationOptions = {},
): string | undefined {
  const receiptPath = getPublicMirrorCleanReceiptPath(receiptId, options);
  if (!existsSync(receiptPath)) {
    return `${receiptPath} does not exist; create a public mirror clean receipt before using mirror-clean:${receiptId}.`;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(receiptPath, "utf8")) as unknown;
  } catch (error) {
    return `${receiptPath} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`;
  }

  return validatePublicMirrorCleanReceiptDocument(receiptId, parsed);
}

export function validateApprovalRecordId(value: string): string | undefined {
  return APPROVAL_RECORD_ID_PATTERN.test(value) || UUID_V4_PATTERN.test(value)
    ? undefined
    : "RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID must be an appr- prefixed approval record id or UUID v4.";
}

export function validateCalibrationReportPathContract(value: string): string | undefined {
  if (value !== REQUIRED_CALIBRATION_REPORT_PATH) {
    return `RELEASE_READINESS_CALIBRATION_REPORT must be ${REQUIRED_CALIBRATION_REPORT_PATH}.`;
  }

  return undefined;
}

export function validateCalibrationReportPath(value: string): string | undefined {
  const contractError = validateCalibrationReportPathContract(value);
  if (contractError) {
    return contractError;
  }

  return existsSync(value)
    ? undefined
    : `${value} does not exist; create the calibration report first.`;
}

export const STEPS: ReadonlyArray<Step> = [
  {
    id: "validate:env",
    description: "Validate environment variable tiers (MUST / OPTIONAL_AI / OPTIONAL_CONNECTORS)",
    command: "npm run validate:env",
  },
  {
    id: "delivery:doctor",
    description: "Delivery Engineer Golden Path static doctor",
    command: "npm run delivery:doctor",
  },
  {
    id: "pack:fixture-check",
    description: "Public reference pack static fixture gate",
    command: "npm run pack:fixture-check",
  },
  {
    id: "eval:headless-signal-interface",
    description: "Headless Signal Interface public offline eval",
    command: "npm run eval:headless-signal-interface",
  },
  {
    id: "eval:operating-signal-flow",
    description: "Operating Signal Flow public offline eval",
    command: "npm run eval:operating-signal-flow",
  },
  {
    id: "check:public-release",
    description: "Public-release guard (tenant-slug / private-path / internal-host / credential)",
    command: "npm run check:public-release",
  },
  {
    id: "check:secret-history",
    description: "Secret-history reachability guard for known compromised commits",
    command: "npm run check:secret-history",
  },
  {
    id: "check:boundaries",
    description: "Public Core boundary checks",
    command: "npm run check:boundaries",
  },
  {
    id: "self-check",
    description: "Public Core self-check",
    command: "npm run self-check",
  },
  {
    id: "typecheck",
    description: "TypeScript strict typecheck",
    command: "npm run typecheck",
  },
  {
    id: "lint",
    description: "ESLint",
    command: "npm run lint",
  },
  {
    id: "test",
    description: "Vitest unit + integration",
    command: "npm run test",
    fullChainOnly: true,
  },
  {
    id: "build",
    description: "Next.js production build",
    command: "npm run build",
    fullChainOnly: true,
  },
  {
    id: "quality:regression",
    description: "Quality regression suite (lib/presentation + worker-skill-resource)",
    command: "npm run quality:regression",
    fullChainOnly: true,
  },
  {
    id: "e2e",
    description: "Playwright end-to-end (requires DB + dev server)",
    command: "npm run e2e",
    fullChainOnly: true,
  },
];

export const MANUAL_CHECKLIST: ReadonlyArray<ManualChecklistItem> = [
  {
    id: "credential_rotated",
    envKey: "RELEASE_READINESS_CREDENTIAL_ROTATED",
    description:
      "CI MySQL root password rotated (Aliyun RDS console + internal secret stores updated + access logs reviewed)",
    howToSatisfy:
      "Set RELEASE_READINESS_CREDENTIAL_ROTATED=<YYYY-MM-DD rotation date> after the operations team confirms rotation.",
    validate: (value) => validateReleaseReadinessDate("RELEASE_READINESS_CREDENTIAL_ROTATED", value),
  },
  {
    id: "secret_history_remediated",
    envKey: "RELEASE_READINESS_SECRET_HISTORY_REMEDIATED",
    description:
      "compromised credential history remediated (formal history rewrite pushed or public mirror verified clean after cloud credential rotation)",
    howToSatisfy:
      "Set RELEASE_READINESS_SECRET_HISTORY_REMEDIATED=<YYYY-MM-DD remediation date or mirror-clean:<receipt-id>> only after check:secret-history passes on the release source and a valid docs/operations/release-readiness-receipts/<receipt-id>.json records `npm run public-mirror:build -- --mirror-root <candidate>` or `npm run public-mirror:verify -- --mirror-root <candidate>` passing.",
    validate: validateSecretHistoryReceipt,
  },
  {
    id: "docker_smoke_passed",
    envKey: "RELEASE_READINESS_DOCKER_SMOKE_PASSED",
    description:
      "Docker quickstart runtime smoke completed against a clean checkout (`docker compose up --build` reaches /mobile)",
    howToSatisfy:
      "Set RELEASE_READINESS_DOCKER_SMOKE_PASSED=<YYYY-MM-DD smoke date> after running on a Docker-enabled host.",
    validate: (value) => validateReleaseReadinessDate("RELEASE_READINESS_DOCKER_SMOKE_PASSED", value),
  },
  {
    id: "oncall_response_policy_ready",
    envKey: "RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY",
    description:
      "on-call / response operating policy has an assigned first responder, escalation path, business-day definition and public failure wording",
    howToSatisfy:
      "Set RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY=<YYYY-MM-DD approval date> after docs/operations/ON_CALL_AND_RESPONSE_SLA.md is owner-approved for the release.",
    validate: (value) =>
      validateReleaseReadinessDate("RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY", value),
  },
  {
    id: "audit_trace_public_posture",
    envKey: "RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE",
    description:
      "audit-trace public claim is safe: either user-visible trace timeline is ready or the 0-second replay claim is withdrawn from public docs",
    howToSatisfy:
      "Set RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE=claim_withdrawn or visualization_ready.",
    validate: (value) =>
      value === "claim_withdrawn" || value === "visualization_ready"
        ? undefined
        : "RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE must be claim_withdrawn or visualization_ready.",
  },
  {
    id: "reviewer_approval_record_id",
    envKey: "RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID",
    description:
      "5-role Required Reviewer approval record (final / Week 5 meeting) attaches every canonical role with decision = approved on the same plan version",
    howToSatisfy:
      "Set RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID to the approvalRecordId persisted per HELM_BUSINESS_ADVANCEMENT_REQUIRED_REVIEWER_APPROVAL_PROTOCOL_V1.md.",
    validate: validateApprovalRecordId,
  },
  {
    id: "calibration_report",
    envKey: "RELEASE_READINESS_CALIBRATION_REPORT",
    description:
      "redacted live DB calibration report exists at docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md and meets the Phase 3 review V1 §2.1 thresholds",
    howToSatisfy:
      "Set RELEASE_READINESS_CALIBRATION_REPORT to the relative path of the calibration report. The script verifies the file exists.",
    validate: validateCalibrationReportPath,
  },
];

export const MANUAL_CHECKLIST_COUNT = MANUAL_CHECKLIST.length;

export const MANUAL_CHECKLIST_ENV_KEYS = MANUAL_CHECKLIST.map((item) => item.envKey);

export const RELEASE_READINESS_AUTOMATED_STEP_COUNT = STEPS.length;

type StepResult =
  | { readonly id: string; readonly status: "ok" | "skipped" | "failed"; readonly note?: string };

function readCurrentHeadForReleaseTagStrategy(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "<current-head-unavailable>";
  }
}

function readLocalTagsForReleaseTagStrategy(): ExistingReleaseTag[] {
  try {
    return execFileSync(
      "git",
      ["for-each-ref", "refs/tags", "--format=%(refname:short)%09%(objectname)%09%(*objectname)"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, objectName, peeledObjectName] = line.split("\t");
        return { name, targetCommit: peeledObjectName || objectName };
      });
  } catch {
    return [];
  }
}

function printReleaseTagStrategy(strategy: ReleaseTagStrategy): void {
  console.log("\n=== Manual tagging strategy (read-only guidance) ===");
  console.log(`  Target tag: ${strategy.targetTag}`);
  console.log(`  Target commit: ${strategy.targetCommit}`);
  for (const warning of strategy.warnings) {
    console.log(`  ! ${warning}`);
  }
  for (const issue of strategy.blockingIssues) {
    console.log(`  ✗ ${issue}`);
  }
  if (strategy.blockingIssues.length === 0) {
    console.log("  Suggested manual commands:");
    for (const command of strategy.manualCommands) {
      console.log(`    ${command}`);
    }
    console.log("  These commands are not executed by release:check.");
  }
}

function runStep(step: Step, isFullChain: boolean): StepResult {
  if (step.fullChainOnly && !isFullChain) {
    return {
      id: step.id,
      status: "skipped",
      note: "skipped — set RELEASE_READINESS_FULL=true to include the heavy suite",
    };
  }
  process.stdout.write(`\n[${step.id}] ${step.command}\n`);
  try {
    execSync(step.command, { stdio: "inherit" });
    return { id: step.id, status: "ok" };
  } catch {
    return { id: step.id, status: "failed" };
  }
}

type ChecklistResult =
  | { readonly id: string; readonly satisfied: true; readonly value: string }
  | { readonly id: string; readonly satisfied: false; readonly missingHint: string };

function evaluateChecklist(): ChecklistResult[] {
  return MANUAL_CHECKLIST.map((item) => {
    const value = process.env[item.envKey]?.trim();
    if (!value) {
      return {
        id: item.id,
        satisfied: false,
        missingHint: `${item.envKey} unset — ${item.howToSatisfy}`,
      };
    }
    const validationError = item.validate?.(value);
    if (validationError) {
      return {
        id: item.id,
        satisfied: false,
        missingHint: validationError,
      };
    }
    return { id: item.id, satisfied: true, value };
  });
}

function main(): number {
  const isFullChain = process.env.RELEASE_READINESS_FULL?.toLowerCase() === "true";
  const releaseTarget = resolveReleaseTargetFromEnv();
  console.log(
    `\n=== ${releaseTarget.targetTitle} release readiness check (${isFullChain ? "FULL" : "FAST"} / ${releaseTarget.releaseChannel}) ===`,
  );
  if (releaseTarget.configurationErrors.length > 0) {
    console.log("\n=== Release target configuration errors ===");
    for (const error of releaseTarget.configurationErrors) {
      console.log(`  ✗ ${error}`);
    }
    return 1;
  }

  const stepResults: StepResult[] = [];
  for (const step of STEPS) {
    stepResults.push(runStep(step, isFullChain));
  }

  console.log("\n=== Automated step summary ===");
  for (const r of stepResults) {
    const icon = r.status === "ok" ? "✓" : r.status === "skipped" ? "↷" : "✗";
    console.log(`  ${icon} ${r.id}${r.note ? "  (" + r.note + ")" : ""}`);
  }

  const checklistResults = evaluateChecklist();
  console.log("\n=== Manual checklist (set env vars to acknowledge) ===");
  for (const r of checklistResults) {
    if (r.satisfied) {
      console.log(`  ✓ ${r.id} = ${r.value}`);
    } else {
      console.log(`  ✗ ${r.id}\n      ${r.missingHint}`);
    }
  }

  const failedSteps = stepResults.filter((r) => r.status === "failed");
  const unmetChecklist = checklistResults.filter((r) => !r.satisfied);
  const tagStrategy = buildReleaseTagStrategy({
    currentHead: readCurrentHeadForReleaseTagStrategy(),
    existingTags: readLocalTagsForReleaseTagStrategy(),
    releaseChannel: releaseTarget.releaseChannel,
    targetTag: releaseTarget.targetTag,
    targetTitle: releaseTarget.targetTitle,
  });
  printReleaseTagStrategy(tagStrategy);

  if (
    failedSteps.length === 0 &&
    unmetChecklist.length === 0 &&
    tagStrategy.blockingIssues.length === 0
  ) {
    console.log(
      `\nALL CLEAR — ${releaseTarget.targetTag} may proceed to the manual tagging step.`,
    );
    if (!isFullChain) {
      console.log(
        "  (Note: FAST mode skipped test/build/e2e/quality:regression. Re-run with RELEASE_READINESS_FULL=true before tagging.)",
      );
    }
    return 0;
  }

  console.log(
    `\nNOT READY — ${failedSteps.length} failed automated step(s), ${unmetChecklist.length} unmet manual item(s), and ${tagStrategy.blockingIssues.length} tag strategy blocker(s).`,
  );
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
