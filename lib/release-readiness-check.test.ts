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
  PUBLIC_MIRROR_CLEAN_RECEIPT_KIND,
  MANUAL_CHECKLIST_COUNT,
  MANUAL_CHECKLIST_ENV_KEYS,
  REQUIRED_CALIBRATION_REPORT_PATH,
  RELEASE_READINESS_AUTOMATED_STEP_COUNT,
  STEPS,
  buildReleaseTagStrategy,
  getPublicMirrorCleanReceiptPath,
  resolveReleaseTargetFromEnv,
  validatePublicMirrorCleanReceiptDocument,
  validateApprovalRecordId,
  validateCalibrationReportPathContract,
  validateCalibrationReportPath,
  validateReleaseReadinessDate,
  validateSecretHistoryReceipt,
} from "../scripts/release-readiness-check";

const EXPECTED_MANUAL_RECEIPT_ENV_KEYS = [
  "RELEASE_READINESS_CREDENTIAL_ROTATED",
  "RELEASE_READINESS_SECRET_HISTORY_REMEDIATED",
  "RELEASE_READINESS_DOCKER_SMOKE_PASSED",
  "RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY",
  "RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE",
  "RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID",
  "RELEASE_READINESS_CALIBRATION_REPORT",
] as const;

const EXPECTED_FAST_PUBLIC_COMMANDS = [
  "npm run validate:env",
  "npm run delivery:doctor",
  "npm run pack:fixture-check",
  "npm run eval:headless-signal-interface",
  "npm run eval:operating-signal-flow",
  "npm run check:public-release",
  "npm run check:secret-history",
  "npm run check:boundaries",
  "npm run self-check",
  "npm run typecheck",
  "npm run lint",
] as const;

const REPO_ROOT = process.cwd();

const PUBLIC_RELEASE_GATE_DOCS = [
  "README.md",
  "docs/product/HELM_RELEASE_REALITY_ALIGNMENT.md",
  "docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md",
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
    expect(RELEASE_READINESS_AUTOMATED_STEP_COUNT).toBe(15);
    expect(MANUAL_CHECKLIST_COUNT).toBe(7);
    expect(MANUAL_CHECKLIST).toHaveLength(7);
    expect(MANUAL_CHECKLIST_ENV_KEYS).toEqual([...EXPECTED_MANUAL_RECEIPT_ENV_KEYS]);
  });

  it("keeps public Core gates in the FAST preflight chain", () => {
    const stepsByCommand = new Map(STEPS.map((step) => [step.command, step]));
    const fullOnlySteps = STEPS.filter((step) => step.fullChainOnly);

    for (const command of EXPECTED_FAST_PUBLIC_COMMANDS) {
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

  it("keeps public release docs aligned with the runnable release gate", () => {
    for (const documentPath of PUBLIC_RELEASE_GATE_DOCS) {
      expect(readRepoFile(documentPath), `${documentPath} should reference release:check`).toContain(
        "npm run release:check",
      );
    }

    const releaseReality = readRepoFile("docs/product/HELM_RELEASE_REALITY_ALIGNMENT.md");
    for (const envKey of EXPECTED_MANUAL_RECEIPT_ENV_KEYS) {
      expect(
        releaseReality,
        `HELM_RELEASE_REALITY_ALIGNMENT should document ${envKey}`,
      ).toContain(envKey);
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
    expect(validateCalibrationReportPath(REQUIRED_CALIBRATION_REPORT_PATH)).toBe(undefined);
  });

  it("prints a prerelease non-latest tagging plan when a higher stable release tag already exists", () => {
    const strategy = buildReleaseTagStrategy({
      currentHead: "79bc11653a7ce99787f1ae350ee1d89749f3b4dd",
      existingTags: [
        {
          name: "V1.0.0",
          targetCommit: "bc0413ff8fce20a43dd0a3452970f8971e76de1d",
        },
      ],
    });

    expect(strategy.blockingIssues).toEqual([]);
    expect(strategy.warnings.join("\n")).toContain("V1.0.0");
    expect(strategy.releaseFlags).toContain("--prerelease");
    expect(strategy.releaseFlags).toContain("--latest=false");
    expect(strategy.releaseFlags).toContain("--notes-start-tag V1.0.0");
    expect(strategy.manualCommands).toEqual([
      'git tag -a v0.1.0-trial 79bc11653a7ce99787f1ae350ee1d89749f3b4dd -m "Helm v0.1.0-trial release gate passed"',
      "git push origin v0.1.0-trial",
      'gh release create v0.1.0-trial --verify-tag --title "Helm v0.1.0-trial" --prerelease --latest=false --generate-notes --notes-start-tag V1.0.0',
    ]);
  });

  it("uses configured trial release target and title without marking it latest", () => {
    const strategy = buildReleaseTagStrategy({
      currentHead: "79bc11653a7ce99787f1ae350ee1d89749f3b4dd",
      existingTags: [
        {
          name: "V1.0.0",
          targetCommit: "bc0413ff8fce20a43dd0a3452970f8971e76de1d",
        },
      ],
      targetTag: "v0.2.0-trial",
      targetTitle: "Helm v0.2.0-trial",
      releaseChannel: "trial",
    });

    expect(strategy.blockingIssues).toEqual([]);
    expect(strategy.releaseFlags).toEqual([
      "--prerelease",
      "--latest=false",
      "--generate-notes",
      "--notes-start-tag V1.0.0",
    ]);
    expect(strategy.manualCommands).toEqual([
      'git tag -a v0.2.0-trial 79bc11653a7ce99787f1ae350ee1d89749f3b4dd -m "Helm v0.2.0-trial release gate passed"',
      "git push origin v0.2.0-trial",
      'gh release create v0.2.0-trial --verify-tag --title "Helm v0.2.0-trial" --prerelease --latest=false --generate-notes --notes-start-tag V1.0.0',
    ]);
  });

  it("uses stable release flags only when the configured stable tag advances the stable line", () => {
    const strategy = buildReleaseTagStrategy({
      currentHead: "79bc11653a7ce99787f1ae350ee1d89749f3b4dd",
      existingTags: [
        {
          name: "V1.0.0",
          targetCommit: "bc0413ff8fce20a43dd0a3452970f8971e76de1d",
        },
      ],
      targetTag: "v1.0.1",
      targetTitle: "Helm v1.0.1",
      releaseChannel: "stable",
    });

    expect(strategy.blockingIssues).toEqual([]);
    expect(strategy.releaseFlags).toEqual([
      "--latest",
      "--generate-notes",
      "--notes-start-tag V1.0.0",
    ]);
    expect(strategy.manualCommands).toEqual([
      'git tag -a v1.0.1 79bc11653a7ce99787f1ae350ee1d89749f3b4dd -m "Helm v1.0.1 release gate passed"',
      "git push origin v1.0.1",
      'gh release create v1.0.1 --verify-tag --title "Helm v1.0.1" --latest --generate-notes --notes-start-tag V1.0.0',
    ]);
  });

  it("blocks stable release targets that do not advance the existing stable line", () => {
    const strategy = buildReleaseTagStrategy({
      currentHead: "79bc11653a7ce99787f1ae350ee1d89749f3b4dd",
      existingTags: [
        {
          name: "V1.0.0",
          targetCommit: "bc0413ff8fce20a43dd0a3452970f8971e76de1d",
        },
      ],
      targetTag: "v0.2.0",
      targetTitle: "Helm v0.2.0",
      releaseChannel: "stable",
    });

    expect(strategy.blockingIssues.join("\n")).toContain(
      "must be greater than existing stable release tag V1.0.0",
    );
    expect(strategy.manualCommands).toEqual([]);
  });

  it("blocks stable release targets that only duplicate the existing stable version", () => {
    const strategy = buildReleaseTagStrategy({
      currentHead: "79bc11653a7ce99787f1ae350ee1d89749f3b4dd",
      existingTags: [
        {
          name: "V1.0.0",
          targetCommit: "bc0413ff8fce20a43dd0a3452970f8971e76de1d",
        },
      ],
      targetTag: "v1.0.0",
      targetTitle: "Helm v1.0.0",
      releaseChannel: "stable",
    });

    expect(strategy.blockingIssues.join("\n")).toContain(
      "must be greater than existing stable release tag V1.0.0",
    );
    expect(strategy.manualCommands).toEqual([]);
  });

  it("resolves release target configuration from env while preserving trial defaults", () => {
    expect(resolveReleaseTargetFromEnv({})).toEqual({
      configurationErrors: [],
      releaseChannel: "trial",
      targetTag: "v0.1.0-trial",
      targetTitle: "Helm v0.1.0-trial",
    });

    expect(
      resolveReleaseTargetFromEnv({
        HELM_RELEASE_CHANNEL: "stable",
        HELM_RELEASE_TARGET_TAG: "v1.0.1",
        HELM_RELEASE_TARGET_TITLE: "Helm v1.0.1",
      }),
    ).toEqual({
      configurationErrors: [],
      releaseChannel: "stable",
      targetTag: "v1.0.1",
      targetTitle: "Helm v1.0.1",
    });
  });

  it("fails closed when release channel configuration is invalid", () => {
    expect(
      resolveReleaseTargetFromEnv({
        HELM_RELEASE_CHANNEL: "production",
        HELM_RELEASE_TARGET_TAG: "v1.0.1",
      }),
    ).toEqual({
      configurationErrors: ["HELM_RELEASE_CHANNEL must be trial or stable."],
      releaseChannel: "trial",
      targetTag: "v1.0.1",
      targetTitle: "Helm v1.0.1",
    });
  });

  it("blocks manual tagging when the target release tag already points at another commit", () => {
    const strategy = buildReleaseTagStrategy({
      currentHead: "79bc11653a7ce99787f1ae350ee1d89749f3b4dd",
      existingTags: [
        {
          name: "v0.1.0-trial",
          targetCommit: "bc0413ff8fce20a43dd0a3452970f8971e76de1d",
        },
      ],
    });

    expect(strategy.blockingIssues.join("\n")).toContain("already exists");
    expect(strategy.blockingIssues.join("\n")).toContain("bc0413ff");
    expect(strategy.manualCommands).toEqual([]);
  });
});
