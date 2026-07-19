/**
 * Helm Work Unit and mainline governance contracts.
 *
 * Implements the public Core contract from
 * docs/product/HELM_WORK_UNIT_MERGE_GOVERNANCE_REQUIREMENTS.md.
 *
 * Pure types + zod + deterministic validators only. This module does not store
 * private mainline facts, approve work, activate runtime paths, send externally,
 * write back, or grant customer commitments.
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import { redactionStatusSchema } from "../diagnostics/doctor-packet";

export const workUnitStateSchema = z.enum([
  "draft",
  "candidate",
  "checking",
  "needs_owner_review",
  "changes_requested",
  "accepted_by_human",
  "promoted_to_mainline",
  "activation_requested",
  "activated_by_human",
  "rejected_by_human",
  "withdrawn",
  "superseded",
  "stale",
  "quarantined",
]);
export type WorkUnitState = z.infer<typeof workUnitStateSchema>;

export const workUnitRiskClassSchema = z.enum([
  "read_only",
  "local_draft",
  "internal_mainline",
  "customer_visible",
  "runtime_activation",
  "commercial_commitment",
]);
export type WorkUnitRiskClass = z.infer<typeof workUnitRiskClassSchema>;

export const HIGH_RISK_WORK_UNIT_CLASSES: ReadonlySet<WorkUnitRiskClass> = new Set([
  "customer_visible",
  "runtime_activation",
  "commercial_commitment",
]);

const RISK_ORDER: Record<WorkUnitRiskClass, number> = {
  read_only: 0,
  local_draft: 1,
  internal_mainline: 2,
  customer_visible: 3,
  runtime_activation: 4,
  commercial_commitment: 5,
};

export const workUnitActorTypeSchema = z.enum([
  "ai",
  "system",
  "human",
  "human_owner",
  "authorized_human_proxy",
]);
export type WorkUnitActorType = z.infer<typeof workUnitActorTypeSchema>;

export const workUnitActorSchema = z
  .object({
    actorType: workUnitActorTypeSchema,
    actorRef: z.string().min(1),
  })
  .strict();
export type WorkUnitActor = z.infer<typeof workUnitActorSchema>;

export const workUnitOwnerSchema = z
  .object({
    ownerRef: z.string().min(1),
    ownerType: z.enum(["human_owner", "authorized_human_proxy", "domain_owner"]),
    displayName: z.string().min(1).optional(),
  })
  .strict();
export type WorkUnitOwner = z.infer<typeof workUnitOwnerSchema>;

export const workUnitAgentRoleSchema = z.enum([
  "diagnose",
  "draft",
  "repair",
  "validate",
  "summarize",
  "review_support",
]);
export type WorkUnitAgentRole = z.infer<typeof workUnitAgentRoleSchema>;

export const workUnitActivationScopeSchema = z.enum([
  "local_proof",
  "repo_truth",
  "private_workspace_truth",
  "staging_readiness",
  "customer_visible",
  "production_runtime",
  "commercial_commitment",
]);
export type WorkUnitActivationScope = z.infer<typeof workUnitActivationScopeSchema>;

export const workUnitSourceSnapshotSchema = z
  .object({
    sourceRef: z.string().min(1),
    redactionStatus: redactionStatusSchema,
    mainlineBaselineRef: z.string().min(1),
    dependencyRefs: z.array(z.string()).default([]),
  })
  .strict();
export type WorkUnitSourceSnapshot = z.infer<typeof workUnitSourceSnapshotSchema>;

export const workUnitCandidateArtifactSchema = z
  .object({
    artifactId: z.string().min(1),
    kind: z.enum(["decision_card", "review_packet", "mapping", "draft", "receipt", "sop", "template"]),
    title: z.string().min(1),
    summary: z.string().min(1),
    state: z.literal("candidate"),
    producedBy: z.enum(["ai", "human", "system"]),
  })
  .strict();
export type WorkUnitCandidateArtifact = z.infer<typeof workUnitCandidateArtifactSchema>;

export const workUnitEvidenceSchema = z
  .object({
    evidenceRef: z.string().min(1),
    title: z.string().min(1),
    redactionStatus: redactionStatusSchema,
  })
  .strict();
export type WorkUnitEvidence = z.infer<typeof workUnitEvidenceSchema>;

export const workUnitChangeSummarySchema = z
  .object({
    changedWhat: z.string().min(1),
    affectedWho: z.array(z.string()).default([]),
    basis: z.array(z.string()).default([]),
    riskSummary: z.string().min(1),
  })
  .strict();
export type WorkUnitChangeSummary = z.infer<typeof workUnitChangeSummarySchema>;

export const workUnitRequiredOwnersSchema = z
  .object({
    mode: z.enum(["all_of", "any_of"]),
    owners: z.array(workUnitOwnerSchema).min(1),
  })
  .strict();
export type WorkUnitRequiredOwners = z.infer<typeof workUnitRequiredOwnersSchema>;

export const workUnitValidationReceiptSchema = z
  .object({
    receiptId: z.string().min(1),
    name: z.string().min(1),
    ok: z.boolean(),
    summary: z.string().min(1),
    createdAt: z.string().min(1),
  })
  .strict();
export type WorkUnitValidationReceipt = z.infer<typeof workUnitValidationReceiptSchema>;

export const workUnitDecisionSchema = z
  .object({
    decidedBy: workUnitActorSchema,
    decision: z.enum(["accepted", "rejected", "changes_requested", "withdrawn", "superseded"]),
    decidedAt: z.string().min(1),
    snapshotHash: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();
export type WorkUnitDecision = z.infer<typeof workUnitDecisionSchema>;

export const workUnitReceiptSchema = z
  .object({
    receiptId: z.string().min(1),
    actor: workUnitActorSchema,
    snapshotHash: z.string().min(1),
    createdAt: z.string().min(1),
    summary: z.string().min(1),
    publicCoreCarriesRealInstance: z.literal(false),
  })
  .strict();
export type WorkUnitReceipt = z.infer<typeof workUnitReceiptSchema>;

export const workUnitRollbackOrRemediationPlanSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("rollback"),
      summary: z.string().min(1),
      responsibleOwnerRef: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("remediation"),
      summary: z.string().min(1),
      responsibleOwnerRef: z.string().min(1),
      externalEffectRef: z.string().min(1),
    })
    .strict(),
]);
export type WorkUnitRollbackOrRemediationPlan = z.infer<
  typeof workUnitRollbackOrRemediationPlanSchema
>;

export const relatedMainlineChangeSchema = z
  .object({
    mainlineRef: z.string().min(1),
    conflictKeys: z.array(z.string().min(1)).min(1),
    changedAt: z.string().min(1),
  })
  .strict();
export type RelatedMainlineChange = z.infer<typeof relatedMainlineChangeSchema>;

export const helmWorkUnitSchema = z
  .object({
    schemaVersion: z.literal("helm.work-unit.v1"),
    id: z.string().min(1),
    objective: z.string().min(1),
    scope: z.array(z.string()).min(1),
    status: workUnitStateSchema,
    initiator: workUnitActorSchema,
    owner: workUnitOwnerSchema.optional(),
    agentRole: workUnitAgentRoleSchema,
    sourceSnapshot: workUnitSourceSnapshotSchema,
    riskClass: workUnitRiskClassSchema,
    conflictKeys: z.array(z.string().min(1)).min(1),
    candidateArtifacts: z.array(workUnitCandidateArtifactSchema).min(1),
    evidenceManifest: z.array(workUnitEvidenceSchema).min(1),
    changeSummary: workUnitChangeSummarySchema,
    requiredOwners: workUnitRequiredOwnersSchema,
    validationReceipts: z.array(workUnitValidationReceiptSchema).default([]),
    decision: workUnitDecisionSchema.optional(),
    decisionSnapshotHash: z.string().optional(),
    mergeReceipt: workUnitReceiptSchema.optional(),
    activationScope: workUnitActivationScopeSchema,
    activationReceipt: workUnitReceiptSchema.optional(),
    rollbackOrRemediationPlan: workUnitRollbackOrRemediationPlanSchema,
    auditRefs: z.array(z.string()).default([]),
    relatedMainlineChanges: z.array(relatedMainlineChangeSchema).default([]),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict();
export type HelmWorkUnit = z.infer<typeof helmWorkUnitSchema>;

export type WorkUnitViolation = {
  rule: string;
  detail: string;
};

const AUTHORITATIVE_STATES: ReadonlySet<WorkUnitState> = new Set([
  "accepted_by_human",
  "promoted_to_mainline",
  "activated_by_human",
]);

const HUMAN_OWNER_ACTORS: ReadonlySet<WorkUnitActorType> = new Set([
  "human_owner",
  "authorized_human_proxy",
]);

const ACTIVATION_SCOPES_REQUIRING_RECEIPT: ReadonlySet<WorkUnitActivationScope> = new Set([
  "customer_visible",
  "production_runtime",
  "commercial_commitment",
]);

function isHumanOwnerActor(actor: WorkUnitActor | undefined): boolean {
  return Boolean(actor && HUMAN_OWNER_ACTORS.has(actor.actorType));
}

function overlap(a: readonly string[], b: readonly string[]): boolean {
  const bSet = new Set(b);
  return a.some((value) => bSet.has(value));
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sorted);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, inner]) => [key, sorted(inner)]),
    );
  }
  return value;
}

function snapshotMaterial(workUnit: HelmWorkUnit): unknown {
  return sorted({
    schemaVersion: workUnit.schemaVersion,
    id: workUnit.id,
    objective: workUnit.objective,
    scope: workUnit.scope,
    owner: workUnit.owner,
    agentRole: workUnit.agentRole,
    sourceSnapshot: workUnit.sourceSnapshot,
    riskClass: workUnit.riskClass,
    conflictKeys: workUnit.conflictKeys,
    candidateArtifacts: workUnit.candidateArtifacts,
    evidenceManifest: workUnit.evidenceManifest,
    changeSummary: workUnit.changeSummary,
    requiredOwners: workUnit.requiredOwners,
    validationReceipts: workUnit.validationReceipts,
    activationScope: workUnit.activationScope,
    rollbackOrRemediationPlan: workUnit.rollbackOrRemediationPlan,
  });
}

export function computeWorkUnitSnapshotHash(input: HelmWorkUnit): string {
  const workUnit = helmWorkUnitSchema.parse(input);
  const digest = createHash("sha256")
    .update(JSON.stringify(snapshotMaterial(workUnit)))
    .digest("hex");
  return `sha256:${digest}`;
}

export function validateWorkUnitWithinPublicCore(input: unknown): WorkUnitViolation[] {
  const parsed = helmWorkUnitSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      rule: "schema",
      detail: `${issue.path.join(".") || "<root>"}: ${issue.message}`,
    }));
  }

  const workUnit = parsed.data;
  const violations: WorkUnitViolation[] = [];
  const snapshotHash = computeWorkUnitSnapshotHash(workUnit);

  if (HIGH_RISK_WORK_UNIT_CLASSES.has(workUnit.riskClass) && !workUnit.owner) {
    violations.push({
      rule: "high-risk-owner-required",
      detail: `riskClass=${workUnit.riskClass}`,
    });
  }

  if (
    AUTHORITATIVE_STATES.has(workUnit.status) &&
    workUnit.decision?.decidedBy.actorType === "ai"
  ) {
    violations.push({
      rule: "ai-cannot-authoritative-state",
      detail: `status=${workUnit.status}`,
    });
  }

  if (workUnit.status === "accepted_by_human" && !isHumanOwnerActor(workUnit.decision?.decidedBy)) {
    violations.push({
      rule: "accepted-needs-human-owner",
      detail: "accepted_by_human requires a human owner decision",
    });
  }

  if (workUnit.status === "promoted_to_mainline") {
    if (workUnit.decision?.decision !== "accepted" || !isHumanOwnerActor(workUnit.decision.decidedBy)) {
      violations.push({
        rule: "promotion-needs-accepted-human-approval",
        detail: "promoted_to_mainline requires accepted_by_human approval",
      });
    }
    if (!workUnit.mergeReceipt) {
      violations.push({
        rule: "promotion-needs-merge-receipt",
        detail: "promoted_to_mainline requires a mergeReceipt schema instance",
      });
    }
  }

  if (
    workUnit.decision?.decision === "accepted" &&
    (workUnit.decision.snapshotHash !== snapshotHash ||
      workUnit.decisionSnapshotHash !== snapshotHash ||
      (workUnit.mergeReceipt && workUnit.mergeReceipt.snapshotHash !== snapshotHash))
  ) {
    violations.push({
      rule: "approval-snapshot-mismatch",
      detail: "approval, decisionSnapshotHash, and mergeReceipt must bind the current snapshot",
    });
  }

  if (
    workUnit.decision?.decision === "accepted" &&
    workUnit.relatedMainlineChanges.some((change) =>
      overlap(workUnit.conflictKeys, change.conflictKeys),
    )
  ) {
    violations.push({
      rule: "approval-invalidated-by-related-mainline-change",
      detail: "related mainline change overlaps conflictKeys",
    });
  }

  if (
    workUnit.status === "activated_by_human" ||
    ACTIVATION_SCOPES_REQUIRING_RECEIPT.has(workUnit.activationScope)
  ) {
    if (!workUnit.activationReceipt || !isHumanOwnerActor(workUnit.activationReceipt.actor)) {
      violations.push({
        rule: "activation-needs-independent-receipt",
        detail: `activationScope=${workUnit.activationScope}`,
      });
    }
  }

  if (workUnit.mergeReceipt?.publicCoreCarriesRealInstance !== undefined) {
    if (workUnit.mergeReceipt.publicCoreCarriesRealInstance !== false) {
      violations.push({
        rule: "public-core-real-approval-instance-forbidden",
        detail: "Public Core may define receipt schema only",
      });
    }
  }

  if (workUnit.activationReceipt?.publicCoreCarriesRealInstance !== undefined) {
    if (workUnit.activationReceipt.publicCoreCarriesRealInstance !== false) {
      violations.push({
        rule: "public-core-real-activation-instance-forbidden",
        detail: "Public Core may define activation receipt schema only",
      });
    }
  }

  return violations;
}

export type WorkUnitTransitionInput = {
  current: HelmWorkUnit;
  next: HelmWorkUnit;
  actor: WorkUnitActor;
};

export function validateWorkUnitTransition(input: WorkUnitTransitionInput): WorkUnitViolation[] {
  const current = helmWorkUnitSchema.parse(input.current);
  const next = helmWorkUnitSchema.parse(input.next);
  const actor = workUnitActorSchema.parse(input.actor);
  const violations = validateWorkUnitWithinPublicCore(next);

  if (actor.actorType === "ai" && RISK_ORDER[next.riskClass] < RISK_ORDER[current.riskClass]) {
    violations.push({
      rule: "ai-risk-downgrade",
      detail: `${current.riskClass}->${next.riskClass}`,
    });
  }

  if (
    actor.actorType === "system" &&
    RISK_ORDER[next.riskClass] < RISK_ORDER[current.riskClass]
  ) {
    violations.push({
      rule: "system-risk-downgrade",
      detail: `${current.riskClass}->${next.riskClass}`,
    });
  }

  if (
    ["accepted_by_human", "rejected_by_human", "activated_by_human"].includes(next.status) &&
    !isHumanOwnerActor(actor)
  ) {
    violations.push({
      rule: "human-owner-transition-required",
      detail: `${next.status} cannot be triggered by ${actor.actorType}`,
    });
  }

  if (next.status === "promoted_to_mainline" && next.decision?.decision !== "accepted") {
    violations.push({
      rule: "promotion-needs-accepted-human-approval",
      detail: "promotion requires an accepted snapshot-bound decision",
    });
  }

  return violations;
}

export type WorkUnitDecisionCard = {
  title: string;
  summary: string;
  whyReviewNow: string;
  changedWhat: string;
  evidenceRefs: string[];
  risk: WorkUnitRiskClass;
  checks: Array<{ name: string; ok: boolean }>;
  requiredOwnerRefs: string[];
  snapshotHash: string;
  approvalDestination: WorkUnitActivationScope;
  activatesImmediately: false;
  rollbackOrRemediation: string;
  questions: string[];
};

export function buildDecisionCard(input: HelmWorkUnit): WorkUnitDecisionCard {
  const workUnit = helmWorkUnitSchema.parse(input);
  const primaryArtifact = workUnit.candidateArtifacts[0];

  return {
    title: primaryArtifact.title,
    summary: primaryArtifact.summary,
    whyReviewNow: "A candidate work package requires human review before it can become mainline truth.",
    changedWhat: workUnit.changeSummary.changedWhat,
    evidenceRefs: workUnit.evidenceManifest.map((evidence) => evidence.evidenceRef),
    risk: workUnit.riskClass,
    checks: workUnit.validationReceipts.map((receipt) => ({
      name: receipt.name,
      ok: receipt.ok,
    })),
    requiredOwnerRefs: workUnit.requiredOwners.owners.map((owner) => owner.ownerRef),
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    approvalDestination: workUnit.activationScope,
    activatesImmediately: false,
    rollbackOrRemediation: workUnit.rollbackOrRemediationPlan.summary,
    questions: [
      "What is the candidate?",
      "Why does this need review now?",
      "What changed?",
      "What evidence supports it?",
      "What are the risks?",
      "Which checks passed or failed?",
      "Who else needs to confirm?",
      "Which snapshot does approval bind?",
      "Where does approval route next?",
      "Will it activate immediately?",
      "How can it be rolled back or remediated?",
    ],
  };
}

export type TerminologyViolation = {
  term: string;
  index: number;
};

const USER_VISIBLE_FORBIDDEN_TERMS = [
  "Branch",
  "PR",
  "Merge",
  "CI",
  "Ruleset",
  "Rulesets",
  "Merge Queue",
];

function collectVisibleText(input: unknown, chunks: string[]): void {
  if (typeof input === "string") {
    chunks.push(input);
    return;
  }

  if (typeof input === "number" || typeof input === "boolean" || input === null) {
    chunks.push(String(input));
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectVisibleText(item, chunks);
    }
    return;
  }

  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input).sort(([a], [b]) => a.localeCompare(b))) {
      chunks.push(key);
      collectVisibleText(value, chunks);
    }
  }
}

export function validateUserVisibleTerminology(input: unknown): TerminologyViolation[] {
  const chunks: string[] = [];
  collectVisibleText(input, chunks);
  const text = chunks.join("\n");
  const violations: TerminologyViolation[] = [];

  for (const term of USER_VISIBLE_FORBIDDEN_TERMS) {
    let fromIndex = 0;
    while (fromIndex < text.length) {
      const index = text.indexOf(term, fromIndex);
      if (index === -1) break;
      violations.push({ term, index });
      fromIndex = index + term.length;
    }
  }

  return violations.sort((a, b) => a.index - b.index || a.term.localeCompare(b.term));
}

export const hwuAcceptanceChecklist = [
  {
    requirementId: "HWU-01",
    title: "Work package contract",
    proof: "schema and required-field validation",
  },
  {
    requirementId: "HWU-02",
    title: "Candidate-only default",
    proof: "AI cannot produce authoritative states",
  },
  {
    requirementId: "HWU-03",
    title: "Snapshot-bound approval",
    proof: "approval hash validation",
  },
  {
    requirementId: "HWU-04",
    title: "Mainline registry boundary",
    proof: "Public Core schema only; no private truth instances",
  },
  {
    requirementId: "HWU-05",
    title: "Decision card",
    proof: "low-complexity decision card model",
  },
  {
    requirementId: "HWU-06",
    title: "Required owners",
    proof: "owner mode, authorized proxy receipts, timeout escalation, and high-risk owner guard",
  },
  {
    requirementId: "HWU-07",
    title: "Business checks",
    proof: "validation receipt contract",
  },
  {
    requirementId: "HWU-08",
    title: "Conflict-key serialization",
    proof: "related conflict key invalidates approval",
  },
  {
    requirementId: "HWU-09",
    title: "Activation scope",
    proof: "activation handoff request and independent authorization receipt guards",
  },
  {
    requirementId: "HWU-10",
    title: "Rollback or remediation",
    proof: "discriminated recovery plan plus remediation requirement for external effects",
  },
  {
    requirementId: "HWU-11",
    title: "Owner lifecycle",
    proof: "owner absence, timeout escalation, owner change, proxy receipt, and stale baseline checks",
  },
  {
    requirementId: "HWU-12",
    title: "AI repair loop",
    proof: "AI repair returns to candidate",
  },
  {
    requirementId: "HWU-13",
    title: "Lesson-to-guard loop",
    proof: "review finding must map to executable asset or waiver",
  },
  {
    requirementId: "HWU-14",
    title: "Audit and receipts",
    proof: "append-only ledger events plus owner review, activation handoff, and authorization receipt shapes",
  },
  {
    requirementId: "HWU-15",
    title: "User terminology guard",
    proof: "forbidden user-visible terminology scan",
  },
] as const;
