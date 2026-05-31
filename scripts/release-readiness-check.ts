#!/usr/bin/env tsx
/**
 * v0.1.0-trial release readiness gate
 *
 * Single-command pre-tag check: runs the AGENTS.md §10 validation chain
 * **plus** prints a manual-action checklist for the items that depend on
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
 *   # Full pre-tag run (use before tagging v0.1.0-trial):
 *   RELEASE_READINESS_FULL=true npm run release:check
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
 * This script does NOT tag a release. It only decides whether v0.1.0-trial
 * is allowed to enter the manual tagging step.
 */
import { execSync } from "node:child_process";
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
    description:
      "Decision-first boundary checks (200+ rules including Phase 3 runtime adoption and env-derived spawn inventory)",
    command: "npm run check:boundaries",
  },
  {
    id: "self-check",
    description: "Helm self-check (file inventory, contract markers, tenant separation)",
    command: "npm run self-check",
  },
  {
    id: "eval:agentic-governance",
    description:
      "Agentic Governance offline gate (trace, connector permission summary, messaging, provider-class drift)",
    command: "npm run eval:agentic-governance",
  },
  {
    id: "eval:intelligence-growth-boundary-static",
    description:
      "IGS boundary static no-go gate (DB/API/runtime/provider/network drift)",
    command: "npm run eval:intelligence-growth-boundary-static",
  },
  {
    id: "eval:intelligence-growth-determinism",
    description:
      "IGS determinism gate (canonical summaries remain stable across repeated offline runs)",
    command: "npm run eval:intelligence-growth-determinism",
  },
  {
    id: "eval:business-advancement-trace-roi",
    description:
      "P0-REQ-05 trace + ROI scorecard gate (6-question coverage, 0 wrong-commitment incident)",
    command: "npm run eval:business-advancement-trace-roi",
  },
  {
    id: "eval:gate-consolidation",
    description:
      "P0-REQ-06 gate consolidation registry gate (active keep gates declare customer-visible risk + 5 required keep klasses)",
    command: "npm run eval:gate-consolidation",
  },
  {
    id: "eval:external-agent-intake-p0-req-07",
    description:
      "P0-REQ-07 external agent strict boundary gate (cross-tenant / unredacted / no-trace / stale / missing-metadata quarantine)",
    command: "npm run eval:external-agent-intake-p0-req-07",
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
  console.log(
    `\n=== Helm v0.1.0-trial release readiness check (${isFullChain ? "FULL" : "FAST"}) ===`,
  );

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

  if (failedSteps.length === 0 && unmetChecklist.length === 0) {
    console.log("\nALL CLEAR — v0.1.0-trial may proceed to the manual tagging step.");
    if (!isFullChain) {
      console.log(
        "  (Note: FAST mode skipped test/build/e2e/quality:regression. Re-run with RELEASE_READINESS_FULL=true before tagging.)",
      );
    }
    return 0;
  }

  console.log(
    `\nNOT READY — ${failedSteps.length} failed automated step(s) and ${unmetChecklist.length} unmet manual item(s).`,
  );
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
