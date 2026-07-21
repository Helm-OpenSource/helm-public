import { z } from "zod";

import {
  computeWorkUnitSnapshotHash,
  helmWorkUnitSchema,
  validateWorkUnitTransition,
  validateWorkUnitWithinPublicCore,
  workUnitActorSchema,
  type HelmWorkUnit,
  type WorkUnitViolation,
} from "./contracts";
import {
  reviewFindingDispositionSchema,
  validateReviewFindingDisposition,
} from "./mainline-ledger";

export const repairLearningPostureSchema = z.enum([
  "repair_not_needed",
  "repair_candidate_ready",
  "repair_blocked",
  "lesson_asset_required",
  "lesson_asset_ready",
  "owner_waiver_recorded",
]);
export type RepairLearningPosture = z.infer<typeof repairLearningPostureSchema>;

export const workUnitRepairCandidateRecordSchema = z
  .object({
    schemaVersion: z.literal("helm.work-unit-repair-candidate.v1"),
    repairId: z.string().min(1),
    originalWorkUnitId: z.string().min(1),
    repairedWorkUnitId: z.string().min(1),
    failedReceiptIds: z.array(z.string().min(1)).min(1),
    repairedBy: workUnitActorSchema,
    repairedAt: z.string().min(1),
    originalSnapshotHash: z.string().min(1),
    repairedSnapshotHash: z.string().min(1),
    changedArtifactRefs: z.array(z.string().min(1)).min(1),
    checkRuleChangeRefs: z.array(z.string().min(1)).default([]),
    changesCheckRules: z.boolean().default(false),
    publicCoreCarriesRealInstance: z.literal(false),
    publicCorePersists: z.literal(false),
    createsExternalEffect: z.literal(false),
    sendsExternally: z.literal(false),
    writesTarget: z.literal(false),
    grantsApproval: z.literal(false),
  })
  .strict();
export type WorkUnitRepairCandidateRecord = z.infer<
  typeof workUnitRepairCandidateRecordSchema
>;

export const learningFindingSourceSchema = z.enum([
  "error",
  "incident",
  "review_finding",
]);
export type LearningFindingSource = z.infer<typeof learningFindingSourceSchema>;

export const learningFindingSeveritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);
export type LearningFindingSeverity = z.infer<typeof learningFindingSeveritySchema>;

export const workUnitLearningFindingSchema = z
  .object({
    schemaVersion: z.literal("helm.work-unit-learning-finding.v1"),
    findingId: z.string().min(1),
    workUnitId: z.string().min(1),
    source: learningFindingSourceSchema,
    severity: learningFindingSeveritySchema,
    summary: z.string().min(1),
    sourceSnapshotHash: z.string().min(1),
    evidenceRefs: z.array(z.string().min(1)).default([]),
    recordedAt: z.string().min(1),
  })
  .strict();
export type WorkUnitLearningFinding = z.infer<typeof workUnitLearningFindingSchema>;

export const workUnitLearningAssetDraftSchema = z
  .object({
    schemaVersion: z.literal("helm.work-unit-learning-asset-draft.v1"),
    draftId: z.string().min(1),
    findingId: z.string().min(1),
    workUnitId: z.string().min(1),
    sourceSnapshotHash: z.string().min(1),
    disposition: reviewFindingDispositionSchema,
    publicCoreCarriesRealInstance: z.literal(false),
    publicCorePersists: z.literal(false),
    createsExternalEffect: z.literal(false),
    sendsExternally: z.literal(false),
    writesTarget: z.literal(false),
    grantsApproval: z.literal(false),
    appliesAsset: z.literal(false),
  })
  .strict();
export type WorkUnitLearningAssetDraft = z.infer<
  typeof workUnitLearningAssetDraftSchema
>;

export type WorkUnitRepairLearningAction = {
  readonly actionId:
    | "prepare_repair_candidate"
    | "record_learning_asset"
    | "record_owner_waiver_shape";
  readonly enabled: boolean;
  readonly label: {
    readonly zh: string;
    readonly en: string;
  };
  readonly publicCoreExecutes: false;
  readonly publicCorePersists: false;
  readonly createsExternalEffect: false;
  readonly sendsExternally: false;
  readonly writesTarget: false;
  readonly grantsApproval: false;
  readonly changesCheckRules: false;
};

export type WorkUnitRepairLearningReadout = {
  readonly originalWorkUnitId: string;
  readonly repairedWorkUnitId: string | null;
  readonly posture: RepairLearningPosture;
  readonly failedChecks: readonly {
    readonly receiptId: string;
    readonly name: string;
    readonly summary: string;
  }[];
  readonly learningItems: readonly {
    readonly findingId: string;
    readonly disposition: "missing" | "asset_recorded" | "owner_waived";
    readonly label: {
      readonly zh: string;
      readonly en: string;
    };
  }[];
  readonly blockers: readonly WorkUnitViolation[];
  readonly actions: readonly WorkUnitRepairLearningAction[];
  readonly publicCoreCarriesRealInstance: false;
  readonly publicCorePersists: false;
  readonly createsExternalEffect: false;
  readonly sendsExternally: false;
  readonly writesTarget: false;
  readonly grantsApproval: false;
  readonly changesCheckRules: false;
  readonly userVisible: {
    readonly title: {
      readonly zh: string;
      readonly en: string;
    };
    readonly status: {
      readonly zh: string;
      readonly en: string;
    };
    readonly boundary: {
      readonly zh: string;
      readonly en: string;
    };
    readonly primaryAction: {
      readonly zh: string;
      readonly en: string;
    };
  };
};

function schemaViolations(prefix: string, error: z.ZodError): WorkUnitViolation[] {
  return error.issues.map((issue) => ({
    rule: `${prefix}-schema`,
    detail: `${issue.path.join(".") || "<root>"}: ${issue.message}`,
  }));
}

function dedupeViolations(violations: readonly WorkUnitViolation[]): WorkUnitViolation[] {
  const seen = new Set<string>();
  const result: WorkUnitViolation[] = [];
  for (const violation of violations) {
    const key = `${violation.rule}\0${violation.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(violation);
  }
  return result;
}

function failedReceiptIds(workUnit: HelmWorkUnit): string[] {
  return workUnit.validationReceipts
    .filter((receipt) => !receipt.ok)
    .map((receipt) => receipt.receiptId);
}

function action(input: {
  readonly actionId: WorkUnitRepairLearningAction["actionId"];
  readonly enabled: boolean;
  readonly zh: string;
  readonly en: string;
}): WorkUnitRepairLearningAction {
  return {
    actionId: input.actionId,
    enabled: input.enabled,
    label: { zh: input.zh, en: input.en },
    publicCoreExecutes: false,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    grantsApproval: false,
    changesCheckRules: false,
  };
}

export function validateWorkUnitRepairCandidate(input: {
  readonly original: unknown;
  readonly repaired: unknown;
  readonly repair: unknown;
}): WorkUnitViolation[] {
  const originalParse = helmWorkUnitSchema.safeParse(input.original);
  const repairedParse = helmWorkUnitSchema.safeParse(input.repaired);
  const repairParse = workUnitRepairCandidateRecordSchema.safeParse(input.repair);
  const parseViolations: WorkUnitViolation[] = [];

  if (!originalParse.success) {
    parseViolations.push(...schemaViolations("repair-original-work-unit", originalParse.error));
  }
  if (!repairedParse.success) {
    parseViolations.push(...schemaViolations("repair-repaired-work-unit", repairedParse.error));
  }
  if (!repairParse.success) {
    parseViolations.push(...schemaViolations("repair-candidate", repairParse.error));
  }
  if (!originalParse.success || !repairedParse.success || !repairParse.success) {
    return parseViolations;
  }

  const original = originalParse.data;
  const repaired = repairedParse.data;
  const repair = repairParse.data;
  const violations: WorkUnitViolation[] = [
    ...validateWorkUnitWithinPublicCore(repaired),
    ...validateWorkUnitTransition({
      current: original,
      next: repaired,
      actor: repair.repairedBy,
    }),
  ];
  const failedIds = failedReceiptIds(original);
  const originalSnapshotHash = computeWorkUnitSnapshotHash(original);
  const repairedSnapshotHash = computeWorkUnitSnapshotHash(repaired);

  if (failedIds.length === 0) {
    violations.push({
      rule: "repair-candidate-needs-failed-check",
      detail: original.id,
    });
  }

  if (repair.originalWorkUnitId !== original.id) {
    violations.push({
      rule: "repair-original-work-unit-mismatch",
      detail: `${repair.originalWorkUnitId} != ${original.id}`,
    });
  }
  if (repair.repairedWorkUnitId !== repaired.id) {
    violations.push({
      rule: "repair-repaired-work-unit-mismatch",
      detail: `${repair.repairedWorkUnitId} != ${repaired.id}`,
    });
  }
  for (const receiptId of repair.failedReceiptIds) {
    if (!failedIds.includes(receiptId)) {
      violations.push({
        rule: "repair-failed-receipt-mismatch",
        detail: receiptId,
      });
    }
  }
  for (const failedId of failedIds) {
    if (!repair.failedReceiptIds.includes(failedId)) {
      violations.push({
        rule: "repair-failed-receipt-missing",
        detail: failedId,
      });
    }
  }
  const repairedArtifactIds = new Set(
    repaired.candidateArtifacts.map((artifact) => artifact.artifactId),
  );
  for (const artifactRef of repair.changedArtifactRefs) {
    if (!repairedArtifactIds.has(artifactRef)) {
      violations.push({
        rule: "repair-changed-artifact-mismatch",
        detail: artifactRef,
      });
    }
  }
  if (repair.originalSnapshotHash !== originalSnapshotHash) {
    violations.push({
      rule: "repair-original-snapshot-mismatch",
      detail: repair.repairId,
    });
  }
  if (repair.repairedSnapshotHash !== repairedSnapshotHash) {
    violations.push({
      rule: "repair-repaired-snapshot-mismatch",
      detail: repair.repairId,
    });
  }
  if (originalSnapshotHash === repairedSnapshotHash) {
    violations.push({
      rule: "repair-candidate-must-change-snapshot",
      detail: repair.repairId,
    });
  }
  if (repaired.status !== "candidate" || repaired.agentRole !== "repair") {
    violations.push({
      rule: "repair-must-return-new-candidate",
      detail: `${repaired.status}/${repaired.agentRole}`,
    });
  }
  if (
    repaired.decision ||
    repaired.decisionSnapshotHash ||
    repaired.mergeReceipt ||
    repaired.activationReceipt
  ) {
    violations.push({
      rule: "repair-candidate-cannot-carry-authority",
      detail: repaired.id,
    });
  }
  if (repair.changesCheckRules || repair.checkRuleChangeRefs.length > 0) {
    violations.push({
      rule:
        repair.repairedBy.actorType === "ai"
          ? "ai-repair-cannot-change-check-rules"
          : "repair-candidate-cannot-change-check-rules",
      detail: repair.repairId,
    });
  }

  return dedupeViolations(violations);
}

export function validateLearningAssetDraft(input: unknown): WorkUnitViolation[] {
  const parsed = workUnitLearningAssetDraftSchema.safeParse(input);
  if (!parsed.success) {
    return schemaViolations("learning-asset-draft", parsed.error);
  }

  const draft = parsed.data;
  const violations = [...validateReviewFindingDisposition(draft.disposition)];

  if (draft.disposition.findingId !== draft.findingId) {
    violations.push({
      rule: "learning-disposition-finding-mismatch",
      detail: `${draft.disposition.findingId} != ${draft.findingId}`,
    });
  }

  return violations;
}

export function validateLearningFindingResolution(input: {
  readonly finding: unknown;
  readonly draft?: unknown;
}): WorkUnitViolation[] {
  const findingParse = workUnitLearningFindingSchema.safeParse(input.finding);
  if (!findingParse.success) {
    return schemaViolations("learning-finding", findingParse.error);
  }
  const finding = findingParse.data;

  if (!input.draft) {
    return [
      {
        rule: "learning-finding-needs-executable-asset-or-owner-waiver",
        detail: finding.findingId,
      },
    ];
  }

  const draftParse = workUnitLearningAssetDraftSchema.safeParse(input.draft);
  if (!draftParse.success) {
    return schemaViolations("learning-asset-draft", draftParse.error);
  }
  const draft = draftParse.data;
  const violations = validateLearningAssetDraft(draft);

  if (draft.findingId !== finding.findingId) {
    violations.push({
      rule: "learning-draft-finding-mismatch",
      detail: `${draft.findingId} != ${finding.findingId}`,
    });
  }
  if (draft.workUnitId !== finding.workUnitId) {
    violations.push({
      rule: "learning-draft-work-unit-mismatch",
      detail: `${draft.workUnitId} != ${finding.workUnitId}`,
    });
  }
  if (draft.sourceSnapshotHash !== finding.sourceSnapshotHash) {
    violations.push({
      rule: "learning-draft-snapshot-mismatch",
      detail: draft.draftId,
    });
  }

  return dedupeViolations(violations);
}

function postureCopy(posture: RepairLearningPosture): WorkUnitRepairLearningReadout["userVisible"]["status"] {
  const copy: Record<RepairLearningPosture, WorkUnitRepairLearningReadout["userVisible"]["status"]> = {
    repair_not_needed: { zh: "无需修复", en: "No repair needed" },
    repair_candidate_ready: { zh: "新候选方案已准备", en: "New candidate prepared" },
    repair_blocked: { zh: "修复被阻断", en: "Repair blocked" },
    lesson_asset_required: { zh: "需要沉淀经验资产", en: "Learning asset required" },
    lesson_asset_ready: { zh: "可执行资产已准备", en: "Executable asset prepared" },
    owner_waiver_recorded: { zh: "负责人豁免已成形", en: "Owner waiver shaped" },
  };
  return copy[posture];
}

export function buildRepairLearningReadout(input: {
  readonly original: HelmWorkUnit;
  readonly repaired?: HelmWorkUnit;
  readonly repair?: WorkUnitRepairCandidateRecord;
  readonly findings?: readonly WorkUnitLearningFinding[];
  readonly learningDrafts?: readonly WorkUnitLearningAssetDraft[];
}): WorkUnitRepairLearningReadout {
  const original = helmWorkUnitSchema.parse(input.original);
  const repaired = input.repaired ? helmWorkUnitSchema.parse(input.repaired) : undefined;
  const repair = input.repair
    ? workUnitRepairCandidateRecordSchema.parse(input.repair)
    : undefined;
  const findings = (input.findings ?? []).map((finding) =>
    workUnitLearningFindingSchema.parse(finding),
  );
  const drafts = (input.learningDrafts ?? []).map((draft) =>
    workUnitLearningAssetDraftSchema.parse(draft),
  );
  const draftsByFinding = new Map(drafts.map((draft) => [draft.findingId, draft]));
  const failedChecks = original.validationReceipts
    .filter((receipt) => !receipt.ok)
    .map((receipt) => ({
      receiptId: receipt.receiptId,
      name: receipt.name,
      summary: receipt.summary,
    }));
  const repairViolations =
    repaired && repair
      ? validateWorkUnitRepairCandidate({ original, repaired, repair })
      : failedChecks.length > 0
        ? [
            {
              rule: "repair-candidate-not-prepared",
              detail: original.id,
            },
          ]
        : [];
  const learningViolations = findings.flatMap((finding) =>
    validateLearningFindingResolution({
      finding,
      draft: draftsByFinding.get(finding.findingId),
    }),
  );
  const blockers = dedupeViolations([...repairViolations, ...learningViolations]);
  const learningItems = findings.map((finding) => {
    const draft = draftsByFinding.get(finding.findingId);
    const disposition: WorkUnitRepairLearningReadout["learningItems"][number]["disposition"] =
      draft?.disposition.disposition ?? "missing";
    return {
      findingId: finding.findingId,
      disposition,
      label:
        disposition === "asset_recorded"
          ? { zh: "可执行资产", en: "Executable asset" }
          : disposition === "owner_waived"
            ? { zh: "负责人豁免", en: "Owner waiver" }
            : { zh: "待沉淀", en: "Pending learning asset" },
    };
  });
  const hasOwnerWaiver = learningItems.some((item) => item.disposition === "owner_waived");
  const posture: RepairLearningPosture =
    repairViolations.length > 0
      ? "repair_blocked"
      : learningViolations.length > 0
        ? "lesson_asset_required"
        : hasOwnerWaiver
          ? "owner_waiver_recorded"
          : findings.length > 0
            ? "lesson_asset_ready"
            : failedChecks.length === 0
              ? "repair_not_needed"
              : "repair_candidate_ready";

  return {
    originalWorkUnitId: original.id,
    repairedWorkUnitId: repaired?.id ?? null,
    posture,
    failedChecks,
    learningItems,
    blockers,
    actions: [
      action({
        actionId: "prepare_repair_candidate",
        enabled: failedChecks.length > 0 && repairViolations.length > 0,
        zh: "准备新候选方案",
        en: "Prepare new candidate",
      }),
      action({
        actionId: "record_learning_asset",
        enabled: repairViolations.length === 0 && learningViolations.length > 0,
        zh: "准备可执行资产",
        en: "Prepare executable asset",
      }),
      action({
        actionId: "record_owner_waiver_shape",
        enabled: repairViolations.length === 0 && learningViolations.length > 0,
        zh: "准备负责人豁免形状",
        en: "Prepare owner waiver shape",
      }),
    ],
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    grantsApproval: false,
    changesCheckRules: false,
    userVisible: {
      title: { zh: "修复与经验入库", en: "Repair and learning capture" },
      status: postureCopy(posture),
      boundary: {
        zh: "公开 Core 只准备新候选方案和经验资产形状；不自动批准、不写回、不外发、不生效、不自动修改检查规则。",
        en: "Public Core only prepares a new candidate and learning-asset shape; it does not approve, write back, send externally, activate, or modify checks automatically.",
      },
      primaryAction:
        posture === "repair_blocked"
          ? { zh: "先修复失败检查", en: "Repair the failed check first" }
          : posture === "lesson_asset_required"
            ? { zh: "把教训沉淀成资产", en: "Capture the lesson as an asset" }
            : { zh: "交给负责人复核", en: "Route to owner review" },
    },
  };
}
