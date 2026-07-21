import { z } from "zod";

import {
  computeWorkUnitSnapshotHash,
  hwuAcceptanceChecklist,
  helmWorkUnitSchema,
  validateWorkUnitWithinPublicCore,
  workUnitActorSchema,
  type HelmWorkUnit,
  type WorkUnitViolation,
} from "./contracts";
import {
  activationAuthorityReceiptSchema,
  activationHandoffRequestSchema,
  type ActivationAuthorityReceipt,
  type ActivationHandoffRequest,
} from "./activation-handoff";
import {
  workUnitLearningAssetDraftSchema,
  workUnitRepairCandidateRecordSchema,
  type WorkUnitLearningAssetDraft,
  type WorkUnitRepairCandidateRecord,
} from "./repair-learning-loop";
import { redactionStatusSchema } from "../diagnostics/doctor-packet";

export const workUnitProofEntryKindSchema = z.enum([
  "work_unit_snapshot",
  "decision_card",
  "candidate_artifact",
  "evidence_manifest",
  "validation_receipt",
  "owner_decision",
  "merge_receipt",
  "activation_handoff_request",
  "activation_authority_receipt",
  "repair_candidate",
  "learning_asset_draft",
]);
export type WorkUnitProofEntryKind = z.infer<typeof workUnitProofEntryKindSchema>;

export const workUnitProofReadinessClaimSchema = z.literal("not_readiness");
export type WorkUnitProofReadinessClaim = z.infer<
  typeof workUnitProofReadinessClaimSchema
>;

export const workUnitProofCoverageStatusSchema = z.enum([
  "covered",
  "missing",
  "not_applicable",
]);
export type WorkUnitProofCoverageStatus = z.infer<
  typeof workUnitProofCoverageStatusSchema
>;

export const workUnitProofEntrySchema = z
  .object({
    entryId: z.string().min(1),
    kind: workUnitProofEntryKindSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    ref: z.string().min(1),
    redactionStatus: redactionStatusSchema,
    observedBy: workUnitActorSchema,
    observedAt: z.string().min(1),
    snapshotHash: z.string().min(1),
    publicCoreCarriesRealInstance: z.literal(false),
  })
  .strict();
export type WorkUnitProofEntry = z.infer<typeof workUnitProofEntrySchema>;

export const workUnitProofRequirementCoverageSchema = z
  .object({
    requirementId: z.string().regex(/^HWU-\d{2}$/),
    status: workUnitProofCoverageStatusSchema,
    evidenceEntryIds: z.array(z.string().min(1)).default([]),
    summary: z.string().min(1),
  })
  .strict();
export type WorkUnitProofRequirementCoverage = z.infer<
  typeof workUnitProofRequirementCoverageSchema
>;

export const workUnitProofPackageSchema = z
  .object({
    schemaVersion: z.literal("helm.work-unit-proof-package.v1"),
    packageId: z.string().min(1),
    workUnitId: z.string().min(1),
    generatedAt: z.string().min(1),
    generatedBy: workUnitActorSchema,
    snapshotHash: z.string().min(1),
    readinessClaim: workUnitProofReadinessClaimSchema,
    entries: z.array(workUnitProofEntrySchema).min(1),
    requirementCoverage: z.array(workUnitProofRequirementCoverageSchema).min(1),
    publicCoreCarriesRealInstance: z.literal(false),
    publicCorePersists: z.literal(false),
    createsExternalEffect: z.literal(false),
    sendsExternally: z.literal(false),
    writesTarget: z.literal(false),
    grantsApproval: z.literal(false),
    grantsReadiness: z.literal(false),
    activatesRuntime: z.literal(false),
    appliesLearningAsset: z.literal(false),
  })
  .strict();
export type WorkUnitProofPackage = z.infer<typeof workUnitProofPackageSchema>;

export type WorkUnitProofPackageReadout = {
  readonly packageId: string;
  readonly workUnitId: string;
  readonly snapshotHash: string;
  readonly entryCount: number;
  readonly coveredRequirementCount: number;
  readonly missingRequirementCount: number;
  readonly entries: readonly WorkUnitProofEntry[];
  readonly requirementCoverage: readonly WorkUnitProofRequirementCoverage[];
  readonly publicCoreCarriesRealInstance: false;
  readonly publicCorePersists: false;
  readonly createsExternalEffect: false;
  readonly sendsExternally: false;
  readonly writesTarget: false;
  readonly grantsApproval: false;
  readonly grantsReadiness: false;
  readonly activatesRuntime: false;
  readonly appliesLearningAsset: false;
  readonly userVisible: {
    readonly title: {
      readonly zh: string;
      readonly en: string;
    };
    readonly summary: {
      readonly zh: string;
      readonly en: string;
    };
    readonly boundary: {
      readonly zh: string;
      readonly en: string;
    };
  };
};

export type BuildWorkUnitProofPackageInput = {
  readonly workUnit: HelmWorkUnit;
  readonly generatedAt?: string;
  readonly generatedBy?: WorkUnitProofPackage["generatedBy"];
  readonly activationRequest?: ActivationHandoffRequest;
  readonly activationReceipt?: ActivationAuthorityReceipt;
  readonly repair?: WorkUnitRepairCandidateRecord;
  readonly learningDrafts?: readonly WorkUnitLearningAssetDraft[];
};

const PUBLIC_SAFE_REDACTION_STATUSES = new Set([
  "synthetic",
  "redacted",
  "alias_only",
]);

function schemaViolations(prefix: string, error: z.ZodError): WorkUnitViolation[] {
  return error.issues.map((issue) => ({
    rule: `${prefix}-schema`,
    detail: `${issue.path.join(".") || "<root>"}: ${issue.message}`,
  }));
}

function entry(input: Omit<WorkUnitProofEntry, "publicCoreCarriesRealInstance">): WorkUnitProofEntry {
  return workUnitProofEntrySchema.parse({
    ...input,
    publicCoreCarriesRealInstance: false,
  });
}

function addIf<T>(value: T | undefined, list: T[]): void {
  if (value) list.push(value);
}

function evidenceIdsForRequirement(
  requirementId: string,
  entries: readonly WorkUnitProofEntry[],
): string[] {
  const kindsByRequirement: Record<string, readonly WorkUnitProofEntryKind[]> = {
    "HWU-01": ["work_unit_snapshot"],
    "HWU-02": ["work_unit_snapshot", "candidate_artifact"],
    "HWU-03": ["owner_decision", "merge_receipt"],
    "HWU-04": ["merge_receipt"],
    "HWU-05": ["decision_card"],
    "HWU-06": ["owner_decision"],
    "HWU-07": ["validation_receipt"],
    "HWU-08": ["work_unit_snapshot", "merge_receipt"],
    "HWU-09": ["activation_handoff_request", "activation_authority_receipt"],
    "HWU-10": ["work_unit_snapshot"],
    "HWU-11": ["owner_decision"],
    "HWU-12": ["repair_candidate"],
    "HWU-13": ["learning_asset_draft"],
    "HWU-14": ["owner_decision", "merge_receipt", "activation_authority_receipt"],
    "HWU-15": ["decision_card"],
  };
  const wantedKinds = new Set(kindsByRequirement[requirementId] ?? []);
  return entries
    .filter((proofEntry) => wantedKinds.has(proofEntry.kind))
    .map((proofEntry) => proofEntry.entryId);
}

function buildRequirementCoverage(
  entries: readonly WorkUnitProofEntry[],
): WorkUnitProofRequirementCoverage[] {
  return hwuAcceptanceChecklist.map((item) => {
    const evidenceEntryIds = evidenceIdsForRequirement(item.requirementId, entries);
    const status: WorkUnitProofCoverageStatus =
      evidenceEntryIds.length > 0 ? "covered" : "missing";
    return {
      requirementId: item.requirementId,
      status,
      evidenceEntryIds,
      summary:
        status === "covered"
          ? `${item.title}: proof evidence attached.`
          : `${item.title}: no proof evidence attached in this package.`,
    };
  });
}

export function buildWorkUnitProofPackage(
  input: BuildWorkUnitProofPackageInput,
): WorkUnitProofPackage {
  const workUnit = helmWorkUnitSchema.parse(input.workUnit);
  const generatedAt = input.generatedAt ?? workUnit.updatedAt;
  const generatedBy = input.generatedBy ?? { actorType: "system", actorRef: "proof-builder" };
  const snapshotHash = computeWorkUnitSnapshotHash(workUnit);
  const entries: WorkUnitProofEntry[] = [
    entry({
      entryId: `proof-entry:${workUnit.id}:snapshot`,
      kind: "work_unit_snapshot",
      title: "Work package snapshot",
      summary: workUnit.objective,
      ref: `synthetic://work-unit/${workUnit.id}`,
      redactionStatus: workUnit.sourceSnapshot.redactionStatus,
      observedBy: generatedBy,
      observedAt: generatedAt,
      snapshotHash,
    }),
    entry({
      entryId: `proof-entry:${workUnit.id}:decision-card`,
      kind: "decision_card",
      title: workUnit.candidateArtifacts[0]?.title ?? "Decision card",
      summary: workUnit.changeSummary.changedWhat,
      ref: `synthetic://decision-card/${workUnit.id}`,
      redactionStatus: workUnit.sourceSnapshot.redactionStatus,
      observedBy: generatedBy,
      observedAt: generatedAt,
      snapshotHash,
    }),
  ];

  for (const artifact of workUnit.candidateArtifacts) {
    entries.push(
      entry({
        entryId: `proof-entry:${workUnit.id}:artifact:${artifact.artifactId}`,
        kind: "candidate_artifact",
        title: artifact.title,
        summary: artifact.summary,
        ref: `synthetic://candidate-artifact/${artifact.artifactId}`,
        redactionStatus: workUnit.sourceSnapshot.redactionStatus,
        observedBy: generatedBy,
        observedAt: generatedAt,
        snapshotHash,
      }),
    );
  }
  for (const evidence of workUnit.evidenceManifest) {
    entries.push(
      entry({
        entryId: `proof-entry:${workUnit.id}:evidence:${evidence.evidenceRef}`,
        kind: "evidence_manifest",
        title: evidence.title,
        summary: "Evidence manifest entry referenced by the work package.",
        ref: evidence.evidenceRef,
        redactionStatus: evidence.redactionStatus,
        observedBy: generatedBy,
        observedAt: generatedAt,
        snapshotHash,
      }),
    );
  }
  for (const receipt of workUnit.validationReceipts) {
    entries.push(
      entry({
        entryId: `proof-entry:${workUnit.id}:validation:${receipt.receiptId}`,
        kind: "validation_receipt",
        title: receipt.name,
        summary: receipt.summary,
        ref: `synthetic://validation-receipt/${receipt.receiptId}`,
        redactionStatus: workUnit.sourceSnapshot.redactionStatus,
        observedBy: generatedBy,
        observedAt: receipt.createdAt,
        snapshotHash,
      }),
    );
  }
  addIf(
    workUnit.decision
      ? entry({
          entryId: `proof-entry:${workUnit.id}:owner-decision`,
          kind: "owner_decision",
          title: "Owner decision",
          summary: workUnit.decision.rationale,
          ref: `synthetic://owner-decision/${workUnit.id}`,
          redactionStatus: workUnit.sourceSnapshot.redactionStatus,
          observedBy: workUnit.decision.decidedBy,
          observedAt: workUnit.decision.decidedAt,
          snapshotHash: workUnit.decision.snapshotHash,
        })
      : undefined,
    entries,
  );
  addIf(
    workUnit.mergeReceipt
      ? entry({
          entryId: `proof-entry:${workUnit.id}:merge-receipt`,
          kind: "merge_receipt",
          title: "Mainline receipt shape",
          summary: workUnit.mergeReceipt.summary,
          ref: `synthetic://merge-receipt/${workUnit.mergeReceipt.receiptId}`,
          redactionStatus: workUnit.sourceSnapshot.redactionStatus,
          observedBy: workUnit.mergeReceipt.actor,
          observedAt: workUnit.mergeReceipt.createdAt,
          snapshotHash: workUnit.mergeReceipt.snapshotHash,
        })
      : undefined,
    entries,
  );

  const activationRequest = input.activationRequest
    ? activationHandoffRequestSchema.parse(input.activationRequest)
    : undefined;
  addIf(
    activationRequest
      ? entry({
          entryId: `proof-entry:${workUnit.id}:activation-request`,
          kind: "activation_handoff_request",
          title: "Activation handoff request shape",
          summary: "Separate authorization request prepared for private-plane review.",
          ref: `synthetic://activation-request/${activationRequest.handoffId}`,
          redactionStatus: workUnit.sourceSnapshot.redactionStatus,
          observedBy: activationRequest.requestedBy,
          observedAt: activationRequest.requestedAt,
          snapshotHash: activationRequest.snapshotHash,
        })
      : undefined,
    entries,
  );

  const activationReceipt = input.activationReceipt
    ? activationAuthorityReceiptSchema.parse(input.activationReceipt)
    : undefined;
  addIf(
    activationReceipt
      ? entry({
          entryId: `proof-entry:${workUnit.id}:activation-authority`,
          kind: "activation_authority_receipt",
          title: "Activation authority receipt shape",
          summary: activationReceipt.rationale,
          ref: `synthetic://activation-authority/${activationReceipt.receiptId}`,
          redactionStatus: workUnit.sourceSnapshot.redactionStatus,
          observedBy: activationReceipt.actor,
          observedAt: activationReceipt.authorizedAt,
          snapshotHash: activationReceipt.snapshotHash,
        })
      : undefined,
    entries,
  );

  const repair = input.repair
    ? workUnitRepairCandidateRecordSchema.parse(input.repair)
    : undefined;
  addIf(
    repair
      ? entry({
          entryId: `proof-entry:${workUnit.id}:repair:${repair.repairId}`,
          kind: "repair_candidate",
          title: "Repair candidate record",
          summary: "AI repair returned a new candidate for owner review.",
          ref: `synthetic://repair-candidate/${repair.repairId}`,
          redactionStatus: workUnit.sourceSnapshot.redactionStatus,
          observedBy: repair.repairedBy,
          observedAt: repair.repairedAt,
          snapshotHash: repair.repairedSnapshotHash,
        })
      : undefined,
    entries,
  );

  for (const draft of input.learningDrafts ?? []) {
    const parsedDraft = workUnitLearningAssetDraftSchema.parse(draft);
    entries.push(
      entry({
        entryId: `proof-entry:${workUnit.id}:learning:${parsedDraft.draftId}`,
        kind: "learning_asset_draft",
        title: "Learning asset draft",
        summary: parsedDraft.disposition.summary,
        ref: `synthetic://learning-asset-draft/${parsedDraft.draftId}`,
        redactionStatus: workUnit.sourceSnapshot.redactionStatus,
        observedBy: parsedDraft.disposition.recordedBy,
        observedAt: parsedDraft.disposition.recordedAt,
        snapshotHash: parsedDraft.sourceSnapshotHash,
      }),
    );
  }

  return workUnitProofPackageSchema.parse({
    schemaVersion: "helm.work-unit-proof-package.v1",
    packageId: `proof-package:${workUnit.id}:${snapshotHash}`,
    workUnitId: workUnit.id,
    generatedAt,
    generatedBy,
    snapshotHash,
    readinessClaim: "not_readiness",
    entries,
    requirementCoverage: buildRequirementCoverage(entries),
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    grantsApproval: false,
    grantsReadiness: false,
    activatesRuntime: false,
    appliesLearningAsset: false,
  });
}

export function validateWorkUnitProofPackage(input: {
  readonly workUnit: unknown;
  readonly packageItem: unknown;
}): WorkUnitViolation[] {
  const workUnitParse = helmWorkUnitSchema.safeParse(input.workUnit);
  const packageParse = workUnitProofPackageSchema.safeParse(input.packageItem);
  const parseViolations: WorkUnitViolation[] = [];

  if (!workUnitParse.success) {
    parseViolations.push(...schemaViolations("proof-work-unit", workUnitParse.error));
  }
  if (!packageParse.success) {
    parseViolations.push(...schemaViolations("proof-package", packageParse.error));
  }
  if (!workUnitParse.success || !packageParse.success) {
    return parseViolations;
  }

  const workUnit = workUnitParse.data;
  const packageItem = packageParse.data;
  const violations: WorkUnitViolation[] = [
    ...validateWorkUnitWithinPublicCore(workUnit),
  ];
  const snapshotHash = computeWorkUnitSnapshotHash(workUnit);

  if (packageItem.workUnitId !== workUnit.id) {
    violations.push({
      rule: "proof-package-work-unit-mismatch",
      detail: `${packageItem.workUnitId} != ${workUnit.id}`,
    });
  }
  if (packageItem.snapshotHash !== snapshotHash) {
    violations.push({
      rule: "proof-package-snapshot-mismatch",
      detail: packageItem.packageId,
    });
  }
  const expectedRequirementIds = hwuAcceptanceChecklist.map((item) => item.requirementId);
  const actualRequirementIds = packageItem.requirementCoverage.map(
    (coverage) => coverage.requirementId,
  );
  if (actualRequirementIds.join("|") !== expectedRequirementIds.join("|")) {
    violations.push({
      rule: "proof-package-requirement-coverage-mismatch",
      detail: actualRequirementIds.join(", "),
    });
  }
  const entryIds = new Set<string>();
  const duplicateEntryIds = new Set<string>();
  for (const proofEntry of packageItem.entries) {
    if (entryIds.has(proofEntry.entryId)) {
      duplicateEntryIds.add(proofEntry.entryId);
    }
    entryIds.add(proofEntry.entryId);
  }
  for (const entryId of [...duplicateEntryIds].sort((a, b) => a.localeCompare(b))) {
    violations.push({
      rule: "proof-package-entry-id-duplicate",
      detail: entryId,
    });
  }
  for (const coverage of packageItem.requirementCoverage) {
    if (coverage.status === "covered" && coverage.evidenceEntryIds.length === 0) {
      violations.push({
        rule: "proof-package-covered-requirement-needs-evidence",
        detail: coverage.requirementId,
      });
    }
    if (coverage.status === "missing" && coverage.evidenceEntryIds.length > 0) {
      violations.push({
        rule: "proof-package-missing-requirement-has-evidence",
        detail: coverage.requirementId,
      });
    }
    for (const entryId of coverage.evidenceEntryIds) {
      if (!entryIds.has(entryId)) {
        violations.push({
          rule: "proof-package-coverage-entry-missing",
          detail: `${coverage.requirementId}:${entryId}`,
        });
      }
    }
  }
  for (const proofEntry of packageItem.entries) {
    if (!PUBLIC_SAFE_REDACTION_STATUSES.has(proofEntry.redactionStatus)) {
      violations.push({
        rule: "proof-entry-redaction-not-public-safe",
        detail: proofEntry.entryId,
      });
    }
    if (proofEntry.publicCoreCarriesRealInstance) {
      violations.push({
        rule: "proof-entry-real-instance-forbidden",
        detail: proofEntry.entryId,
      });
    }
  }
  if (
    packageItem.publicCoreCarriesRealInstance ||
    packageItem.publicCorePersists ||
    packageItem.createsExternalEffect ||
    packageItem.sendsExternally ||
    packageItem.writesTarget ||
    packageItem.grantsApproval ||
    packageItem.grantsReadiness ||
    packageItem.activatesRuntime ||
    packageItem.appliesLearningAsset ||
    packageItem.readinessClaim !== "not_readiness"
  ) {
    violations.push({
      rule: "proof-package-public-core-side-effect",
      detail: packageItem.packageId,
    });
  }

  return violations;
}

export function buildWorkUnitProofPackageReadout(
  input: WorkUnitProofPackage,
): WorkUnitProofPackageReadout {
  const packageItem = workUnitProofPackageSchema.parse(input);
  const coveredRequirementCount = packageItem.requirementCoverage.filter(
    (coverage) => coverage.status === "covered",
  ).length;
  const missingRequirementCount = packageItem.requirementCoverage.filter(
    (coverage) => coverage.status === "missing",
  ).length;

  return {
    packageId: packageItem.packageId,
    workUnitId: packageItem.workUnitId,
    snapshotHash: packageItem.snapshotHash,
    entryCount: packageItem.entries.length,
    coveredRequirementCount,
    missingRequirementCount,
    entries: packageItem.entries,
    requirementCoverage: packageItem.requirementCoverage,
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    grantsApproval: false,
    grantsReadiness: false,
    activatesRuntime: false,
    appliesLearningAsset: false,
    userVisible: {
      title: { zh: "证明包查看器", en: "Proof package viewer" },
      summary: {
        zh: `${packageItem.entries.length} 条证据，${coveredRequirementCount} 个需求已有证明，${missingRequirementCount} 个需求仍需补证。`,
        en: `${packageItem.entries.length} proof item(s), ${coveredRequirementCount} requirement(s) covered, ${missingRequirementCount} still need evidence.`,
      },
      boundary: {
        zh: "证明包只是快照绑定的审查材料，不是生产就绪、不自动批准、不外发、不写回、不生效。",
        en: "A proof package is snapshot-bound review material only; it is not production readiness, automatic approval, external send, writeback, or activation.",
      },
    },
  };
}
