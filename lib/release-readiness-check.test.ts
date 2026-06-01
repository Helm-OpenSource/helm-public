import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MANUAL_CHECKLIST,
  PUBLIC_MIRROR_CLEAN_RECEIPT_DIR,
  PUBLIC_MIRROR_CLEAN_RECEIPT_KIND,
  MANUAL_CHECKLIST_COUNT,
  MANUAL_CHECKLIST_ENV_KEYS,
  REQUIRED_CALIBRATION_REPORT_PATH,
  RELEASE_READINESS_AUTOMATED_STEP_COUNT,
  STEPS,
  getPublicMirrorCleanReceiptPath,
  validatePublicMirrorCleanReceiptDocument,
  validateApprovalRecordId,
  validateCalibrationReportPathContract,
  validateCalibrationReportPath,
  validateReleaseReadinessDate,
  validateSecretHistoryReceipt,
} from "../scripts/release-readiness-check";

const REPO_ROOT = process.cwd();

const EXPECTED_MANUAL_RECEIPT_ENV_KEYS = [
  "RELEASE_READINESS_CREDENTIAL_ROTATED",
  "RELEASE_READINESS_SECRET_HISTORY_REMEDIATED",
  "RELEASE_READINESS_DOCKER_SMOKE_PASSED",
  "RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY",
  "RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE",
  "RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID",
  "RELEASE_READINESS_CALIBRATION_REPORT",
] as const;

const CURRENT_RECEIPT_WORDING = /7 个 receipt|7 个人工 release receipt/;

const EXPECTED_FAST_GOVERNANCE_COMMANDS = [
  "npm run eval:agentic-governance",
  "npm run eval:intelligence-growth-boundary-static",
  "npm run eval:intelligence-growth-determinism",
  "npm run eval:business-advancement-trace-roi",
  "npm run eval:gate-consolidation",
  "npm run eval:external-agent-intake-p0-req-07",
] as const;

const LEGACY_FOUR_ITEM_WORDING = [
  new RegExp(["4", "项手动 checklist"].join(" ")),
  new RegExp(["4项手动", "checklist"].join(" ")),
  new RegExp(["4", "manual checklist"].join(" "), "i"),
  new RegExp(
    [
      "凭据轮换日期",
      "Docker smoke 日期",
      "Reviewer approval id",
      "calibration 报告路径",
    ].join(" / "),
  ),
] as const;

const DOCUMENTS_WITH_RECEIPT_TRUTH = [
  "docs/operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md",
  "docs/launch/HELM_V0_1_0_TRIAL_LAUNCH_POST_DRAFT_V1.md",
  "docs/STATUS.md",
  "CHANGELOG.md",
] as const;

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("release readiness manual receipt truth", () => {
  it("exports the stable 7-item manual checklist and env keys", () => {
    expect(RELEASE_READINESS_AUTOMATED_STEP_COUNT).toBe(17);
    expect(MANUAL_CHECKLIST_COUNT).toBe(7);
    expect(MANUAL_CHECKLIST).toHaveLength(7);
    expect(MANUAL_CHECKLIST_ENV_KEYS).toEqual([...EXPECTED_MANUAL_RECEIPT_ENV_KEYS]);
  });

  it("keeps governance offline gates in the FAST preflight chain", () => {
    const stepsByCommand = new Map(STEPS.map((step) => [step.command, step]));
    const fullOnlySteps = STEPS.filter((step) => step.fullChainOnly);

    for (const command of EXPECTED_FAST_GOVERNANCE_COMMANDS) {
      const step = stepsByCommand.get(command);
      expect(step, `${command} should be present in release readiness STEPS`).toBeDefined();
      expect(step?.fullChainOnly, `${command} should run in FAST mode`).not.toBe(true);
    }

    expect(fullOnlySteps.map((step) => step.id)).toEqual([
      "test",
      "build",
      "quality:regression",
      "e2e",
    ]);
  });

  it("keeps release docs aligned on the current 7 receipt wording", () => {
    for (const documentPath of DOCUMENTS_WITH_RECEIPT_TRUTH) {
      const content = readRepoFile(documentPath);

      expect(content, `${documentPath} should state the current 7 receipt posture`).toMatch(
        CURRENT_RECEIPT_WORDING,
      );

      for (const legacyPattern of LEGACY_FOUR_ITEM_WORDING) {
        expect(content, `${documentPath} should not retain the legacy 4-item wording`).not.toMatch(
          legacyPattern,
        );
      }
    }
  });

  it("keeps the checklist docs covering every release readiness env key", () => {
    const receiptChecklist = readRepoFile("docs/operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md");
    const changelog = readRepoFile("CHANGELOG.md");

    expect(changelog).toContain("17 步自动化");

    for (const envKey of EXPECTED_MANUAL_RECEIPT_ENV_KEYS) {
      expect(MANUAL_CHECKLIST_ENV_KEYS).toContain(envKey);
      expect(receiptChecklist).toContain(envKey);
      expect(changelog).toContain(envKey);
    }
  });

  it("rejects placeholder, invalid, and future manual receipt dates", () => {
    expect(validateReleaseReadinessDate("RELEASE_READINESS_CREDENTIAL_ROTATED", "2026-02-28")).toBe(
      undefined,
    );

    expect(validateReleaseReadinessDate("RELEASE_READINESS_CREDENTIAL_ROTATED", "done")).toContain(
      "YYYY-MM-DD",
    );
    expect(
      validateReleaseReadinessDate("RELEASE_READINESS_CREDENTIAL_ROTATED", "2026-02-30"),
    ).toContain("valid calendar date");
    expect(
      validateReleaseReadinessDate("RELEASE_READINESS_CREDENTIAL_ROTATED", "2099-01-01"),
    ).toContain("future date");
  });

  it("requires structured non-date release receipts", () => {
    expect(validateSecretHistoryReceipt("2026-02-28")).toBe(undefined);
    expect(validateSecretHistoryReceipt("2099-01-01")).toContain("future date");
    expect(validateSecretHistoryReceipt("mirror clean done")).toContain("mirror-clean:<receipt-id>");

    expect(validateApprovalRecordId("appr-2026-05-30-final-review")).toBe(undefined);
    expect(validateApprovalRecordId("550e8400-e29b-41d4-a716-446655440000")).toBe(undefined);
    expect(validateApprovalRecordId("approved")).toContain("UUID v4");
  });

  it("ties mirror-clean receipts to a checked public mirror receipt file", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "helm-release-receipt-"));
    const receiptId = "public-mirror-2026-05-02";
    const receiptPath = getPublicMirrorCleanReceiptPath(receiptId, { repoRoot });

    try {
      expect(validateSecretHistoryReceipt(`mirror-clean:${receiptId}`, { repoRoot })).toContain(
        "does not exist",
      );

      writeJson(receiptPath, {
        receiptId,
        kind: PUBLIC_MIRROR_CLEAN_RECEIPT_KIND,
        createdAt: "2026-05-02",
        sourceRef: "main@abcdef0",
        commandEvidence: [
          {
            command: "npm run public-mirror:build -- --mirror-root <candidate>",
            completedAt: "2026-05-02",
            exitCode: 0,
            scannedFiles: 2963,
          },
        ],
      });

      expect(validateSecretHistoryReceipt(`mirror-clean:${receiptId}`, { repoRoot })).toBe(
        undefined,
      );
    } finally {
      rmSync(repoRoot, { force: true, recursive: true });
    }
  });

  it("rejects forged or incomplete public mirror clean receipt documents", () => {
    const validReceipt = {
      receiptId: "public-mirror-2026-05-02",
      kind: PUBLIC_MIRROR_CLEAN_RECEIPT_KIND,
      createdAt: "2026-05-02",
      sourceRef: "main@abcdef0",
      commandEvidence: [
        {
          command: "npm run public-mirror:verify -- --mirror-root <candidate>",
          completedAt: "2026-05-02",
          exitCode: 0,
        },
      ],
    };

    expect(
      validatePublicMirrorCleanReceiptDocument("public-mirror-2026-05-02", validReceipt),
    ).toBe(undefined);
    expect(
      validatePublicMirrorCleanReceiptDocument("public-mirror-2026-05-02", {
        ...validReceipt,
        receiptId: "other-receipt",
      }),
    ).toContain("receiptId");
    expect(
      validatePublicMirrorCleanReceiptDocument("public-mirror-2026-05-02", {
        ...validReceipt,
        commandEvidence: [{ ...validReceipt.commandEvidence[0], exitCode: 1 }],
      }),
    ).toContain("exitCode must be 0");
    expect(
      validatePublicMirrorCleanReceiptDocument("public-mirror-2026-05-02", {
        ...validReceipt,
        commandEvidence: [
          {
            command: "npm run test -- lib/public-mirror-tree-builder.test.ts",
            completedAt: "2026-05-02",
            exitCode: 0,
          },
        ],
      }),
    ).toContain("public-mirror:build or public-mirror:verify");
  });

  it("documents the mirror-clean receipt evidence path and public mirror commands", () => {
    const receiptChecklist = readRepoFile("docs/operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md");
    const secretHistoryReceipt = MANUAL_CHECKLIST.find(
      (item) => item.id === "secret_history_remediated",
    );

    expect(secretHistoryReceipt?.howToSatisfy).toContain(PUBLIC_MIRROR_CLEAN_RECEIPT_DIR);
    expect(secretHistoryReceipt?.howToSatisfy).toContain("public-mirror:build");
    expect(secretHistoryReceipt?.howToSatisfy).toContain("public-mirror:verify");
    expect(receiptChecklist).toContain(PUBLIC_MIRROR_CLEAN_RECEIPT_DIR);
    expect(receiptChecklist).toContain("public-mirror:clean-receipt:check");
    expect(receiptChecklist).toContain("npm run public-mirror:build -- --mirror-root <candidate>");
    expect(receiptChecklist).toContain("npm run public-mirror:verify -- --mirror-root <candidate>");
  });

  it("keeps calibration receipt fixed to the required redacted live report", () => {
    expect(validateCalibrationReportPathContract(REQUIRED_CALIBRATION_REPORT_PATH)).toBe(undefined);
    expect(validateCalibrationReportPathContract("/tmp/report.md")).toContain(REQUIRED_CALIBRATION_REPORT_PATH);
    expect(validateCalibrationReportPathContract("../docs/reviews/report.md")).toContain(
      REQUIRED_CALIBRATION_REPORT_PATH,
    );
    expect(validateCalibrationReportPathContract("docs/product/report.md")).toContain(
      REQUIRED_CALIBRATION_REPORT_PATH,
    );
    expect(
      validateCalibrationReportPathContract(
        "docs/reviews/COMMITMENT_REINFORCEMENT_SENDABILITY_ALIGNMENT_REPORT.md",
      ),
    ).toContain(REQUIRED_CALIBRATION_REPORT_PATH);
    expect(validateCalibrationReportPath(REQUIRED_CALIBRATION_REPORT_PATH)).toContain("does not exist");
  });
});
