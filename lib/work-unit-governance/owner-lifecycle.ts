import { z } from "zod";

import {
  computeWorkUnitSnapshotHash,
  helmWorkUnitSchema,
  validateWorkUnitWithinPublicCore,
  workUnitActorSchema,
  workUnitOwnerSchema,
  workUnitRequiredOwnersSchema,
  type HelmWorkUnit,
  type WorkUnitActor,
  type WorkUnitOwner,
  type WorkUnitRequiredOwners,
  type WorkUnitViolation,
} from "./contracts";

export const ownerLifecyclePostureSchema = z.enum([
  "blocked_missing_owner",
  "waiting_for_owner",
  "waiting_for_all_owners",
  "owner_review_satisfied",
  "escalation_required",
  "stale_review_required",
  "changes_requested",
  "rejected",
  "closed",
]);
export type OwnerLifecyclePosture = z.infer<typeof ownerLifecyclePostureSchema>;

export const ownerLifecycleActionIdSchema = z.enum([
  "request_owner_review",
  "record_owner_decision",
  "request_escalation",
  "record_owner_change",
]);
export type OwnerLifecycleActionId = z.infer<typeof ownerLifecycleActionIdSchema>;

export const ownerReviewDecisionSchema = z.enum([
  "accepted",
  "changes_requested",
  "rejected",
]);
export type OwnerReviewDecision = z.infer<typeof ownerReviewDecisionSchema>;

export const ownerProxyAuthorizationSchema = z
  .object({
    ownerRef: z.string().min(1),
    proxy: workUnitOwnerSchema,
    authorizedBy: workUnitActorSchema,
    authorizationReceiptRef: z.string().min(1),
    authorizedAt: z.string().min(1),
    expiresAt: z.string().min(1).optional(),
    publicCoreCarriesRealInstance: z.literal(false),
  })
  .strict();
export type OwnerProxyAuthorization = z.infer<typeof ownerProxyAuthorizationSchema>;

export const ownerLifecyclePolicySchema = z
  .object({
    schemaVersion: z.literal("helm.owner-lifecycle-policy.v1"),
    reviewDueAt: z.string().min(1).optional(),
    escalationOwnerRefs: z.array(z.string().min(1)).default([]),
    authorizedProxies: z.array(ownerProxyAuthorizationSchema).default([]),
    publicCoreCarriesRealInstance: z.literal(false),
  })
  .strict();
export type OwnerLifecyclePolicy = z.infer<typeof ownerLifecyclePolicySchema>;

export const ownerReviewReceiptSchema = z
  .object({
    schemaVersion: z.literal("helm.owner-review-receipt.v1"),
    receiptId: z.string().min(1),
    ownerRef: z.string().min(1),
    actor: workUnitActorSchema,
    decision: ownerReviewDecisionSchema,
    snapshotHash: z.string().min(1),
    decidedAt: z.string().min(1),
    rationale: z.string().min(1),
    authorizationReceiptRef: z.string().min(1).optional(),
    publicCoreCarriesRealInstance: z.literal(false),
  })
  .strict();
export type OwnerReviewReceipt = z.infer<typeof ownerReviewReceiptSchema>;

export const ownerLifecycleEventSchema = z
  .object({
    commandId: ownerLifecycleActionIdSchema,
    actor: workUnitActorSchema,
    at: z.string().min(1),
    rationale: z.string().min(1),
    ownerRef: z.string().min(1).optional(),
    decision: ownerReviewDecisionSchema.optional(),
    authorizationReceiptRef: z.string().min(1).optional(),
    newOwner: workUnitOwnerSchema.optional(),
    ownerChangeReceiptRef: z.string().min(1).optional(),
  })
  .strict();
export type OwnerLifecycleEvent = z.infer<typeof ownerLifecycleEventSchema>;

export type OwnerLifecycleAction = {
  readonly actionId: OwnerLifecycleActionId;
  readonly label: {
    readonly zh: string;
    readonly en: string;
  };
  readonly enabled: boolean;
  readonly publicCoreExecutes: false;
  readonly sendsNotification: false;
  readonly createsExternalEffect: false;
  readonly grantsApproval: false;
  readonly blockedBy: readonly string[];
};

export type OwnerLifecycleReadout = {
  readonly workUnitId: string;
  readonly posture: OwnerLifecyclePosture;
  readonly requiredMode: WorkUnitRequiredOwners["mode"];
  readonly requiredOwnerRefs: readonly string[];
  readonly satisfiedOwnerRefs: readonly string[];
  readonly pendingOwnerRefs: readonly string[];
  readonly authorizedProxyRefs: readonly string[];
  readonly escalationOwnerRefs: readonly string[];
  readonly blockers: readonly WorkUnitViolation[];
  readonly actions: readonly OwnerLifecycleAction[];
  readonly publicCoreCarriesRealInstance: false;
  readonly publicCorePersists: false;
  readonly sendsNotification: false;
  readonly createsExternalEffect: false;
  readonly grantsApproval: false;
  readonly userVisible: {
    readonly title: {
      readonly zh: string;
      readonly en: string;
    };
    readonly status: {
      readonly zh: string;
      readonly en: string;
    };
    readonly primaryAction: {
      readonly zh: string;
      readonly en: string;
    };
    readonly boundary: {
      readonly zh: string;
      readonly en: string;
    };
  };
};

export type OwnerLifecyclePlan =
  | {
      readonly ok: true;
      readonly commandId: OwnerLifecycleActionId;
      readonly plannedReceipt?: OwnerReviewReceipt;
      readonly plannedRequiredOwners?: WorkUnitRequiredOwners;
      readonly escalationOwnerRefs?: readonly string[];
      readonly publicCorePersists: false;
      readonly sendsNotification: false;
      readonly createsExternalEffect: false;
      readonly grantsApproval: false;
      readonly auditNote: string;
    }
  | {
      readonly ok: false;
      readonly commandId: OwnerLifecycleActionId;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly sendsNotification: false;
      readonly createsExternalEffect: false;
      readonly grantsApproval: false;
    };

const HUMAN_OWNER_ACTOR_TYPES: ReadonlySet<WorkUnitActor["actorType"]> = new Set([
  "human_owner",
  "authorized_human_proxy",
]);

const CLOSED_WORK_UNIT_STATUSES = new Set([
  "accepted_by_human",
  "promoted_to_mainline",
  "activation_requested",
  "activated_by_human",
  "rejected_by_human",
  "withdrawn",
  "superseded",
]);

function isHumanOwnerActor(actor: WorkUnitActor | undefined): boolean {
  return Boolean(actor && HUMAN_OWNER_ACTOR_TYPES.has(actor.actorType));
}

function isDirectHumanOwner(actor: WorkUnitActor | undefined): boolean {
  return actor?.actorType === "human_owner";
}

function parseTime(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function overlap(a: readonly string[], b: readonly string[]): boolean {
  const bSet = new Set(b);
  return a.some((value) => bSet.has(value));
}

function rules(violations: readonly WorkUnitViolation[]): string[] {
  return sortedUnique(violations.map((violation) => violation.rule));
}

function schemaViolations(prefix: string, error: z.ZodError): WorkUnitViolation[] {
  return error.issues.map((issue) => ({
    rule: `${prefix}-schema`,
    detail: `${issue.path.join(".") || "<root>"}: ${issue.message}`,
  }));
}

function requiredOwnerRefs(workUnit: HelmWorkUnit): string[] {
  return sortedUnique(workUnit.requiredOwners.owners.map((owner) => owner.ownerRef));
}

function validProxyAuthorization(input: {
  readonly policy: OwnerLifecyclePolicy;
  readonly receipt: OwnerReviewReceipt;
  readonly now: string;
}): OwnerProxyAuthorization | null {
  const nowMs = parseTime(input.now);
  return (
    input.policy.authorizedProxies.find((authorization) => {
      if (authorization.ownerRef !== input.receipt.ownerRef) return false;
      if (authorization.proxy.ownerRef !== input.receipt.actor.actorRef) return false;
      if (authorization.proxy.ownerType !== "authorized_human_proxy") return false;
      if (authorization.authorizationReceiptRef !== input.receipt.authorizationReceiptRef) {
        return false;
      }
      if (!isDirectHumanOwner(authorization.authorizedBy)) return false;
      const expiresAtMs = parseTime(authorization.expiresAt);
      return !expiresAtMs || !nowMs || expiresAtMs > nowMs;
    }) ?? null
  );
}

function validateProxyAuthorizations(
  policy: OwnerLifecyclePolicy,
  now: string,
): WorkUnitViolation[] {
  const nowMs = parseTime(now);
  const violations: WorkUnitViolation[] = [];

  for (const authorization of policy.authorizedProxies) {
    if (authorization.proxy.ownerType !== "authorized_human_proxy") {
      violations.push({
        rule: "proxy-authorization-needs-proxy-owner-type",
        detail: authorization.proxy.ownerRef,
      });
    }
    if (!isDirectHumanOwner(authorization.authorizedBy)) {
      violations.push({
        rule: "proxy-authorization-needs-human-owner",
        detail: authorization.authorizationReceiptRef,
      });
    }
    const expiresAtMs = parseTime(authorization.expiresAt);
    if (expiresAtMs && nowMs && expiresAtMs <= nowMs) {
      violations.push({
        rule: "proxy-authorization-expired",
        detail: authorization.authorizationReceiptRef,
      });
    }
  }

  return violations;
}

function ownerReceiptViolations(input: {
  readonly workUnit: HelmWorkUnit;
  readonly policy: OwnerLifecyclePolicy;
  readonly receipt: OwnerReviewReceipt;
  readonly now: string;
}): WorkUnitViolation[] {
  const required = new Set(requiredOwnerRefs(input.workUnit));
  const snapshotHash = computeWorkUnitSnapshotHash(input.workUnit);
  const violations: WorkUnitViolation[] = [];

  if (!required.has(input.receipt.ownerRef)) {
    violations.push({
      rule: "owner-receipt-owner-not-required",
      detail: input.receipt.ownerRef,
    });
  }
  if (input.receipt.snapshotHash !== snapshotHash) {
    violations.push({
      rule: "owner-receipt-snapshot-mismatch",
      detail: input.receipt.receiptId,
    });
  }
  if (input.receipt.publicCoreCarriesRealInstance !== false) {
    violations.push({
      rule: "owner-receipt-real-instance-forbidden",
      detail: input.receipt.receiptId,
    });
  }

  if (input.receipt.actor.actorType === "human_owner") {
    if (input.receipt.actor.actorRef !== input.receipt.ownerRef) {
      violations.push({
        rule: "owner-receipt-actor-not-authorized",
        detail: `${input.receipt.actor.actorRef} != ${input.receipt.ownerRef}`,
      });
    }
    return violations;
  }

  if (input.receipt.actor.actorType === "authorized_human_proxy") {
    if (!input.receipt.authorizationReceiptRef) {
      violations.push({
        rule: "proxy-receipt-needs-authorization",
        detail: input.receipt.receiptId,
      });
      return violations;
    }
    if (!validProxyAuthorization(input)) {
      violations.push({
        rule: "proxy-receipt-needs-current-authorization",
        detail: input.receipt.receiptId,
      });
    }
    return violations;
  }

  violations.push({
    rule: "owner-receipt-needs-human-owner",
    detail: input.receipt.receiptId,
  });
  return violations;
}

function staleMainlineViolations(workUnit: HelmWorkUnit): WorkUnitViolation[] {
  if (
    workUnit.relatedMainlineChanges.some((change) =>
      overlap(workUnit.conflictKeys, change.conflictKeys),
    )
  ) {
    return [
      {
        rule: "owner-review-stale-related-mainline-change",
        detail: workUnit.id,
      },
    ];
  }
  return [];
}

function normalizeInputs(input: {
  readonly workUnit: unknown;
  readonly policy: unknown;
  readonly receipts: readonly unknown[];
  readonly now: string;
}): {
  readonly workUnit?: HelmWorkUnit;
  readonly policy?: OwnerLifecyclePolicy;
  readonly receipts: readonly OwnerReviewReceipt[];
  readonly violations: readonly WorkUnitViolation[];
} {
  const workUnitParse = helmWorkUnitSchema.safeParse(input.workUnit);
  const policyParse = ownerLifecyclePolicySchema.safeParse(input.policy);
  const receiptViolations: WorkUnitViolation[] = [];
  const receipts: OwnerReviewReceipt[] = [];

  for (const receipt of input.receipts) {
    const receiptParse = ownerReviewReceiptSchema.safeParse(receipt);
    if (receiptParse.success) {
      receipts.push(receiptParse.data);
    } else {
      receiptViolations.push(...schemaViolations("owner-review-receipt", receiptParse.error));
    }
  }

  const violations: WorkUnitViolation[] = [...receiptViolations];
  if (!workUnitParse.success) {
    violations.push(...schemaViolations("work-unit", workUnitParse.error));
  }
  if (!policyParse.success) {
    violations.push(...schemaViolations("owner-lifecycle-policy", policyParse.error));
  }

  return {
    workUnit: workUnitParse.success ? workUnitParse.data : undefined,
    policy: policyParse.success ? policyParse.data : undefined,
    receipts,
    violations,
  };
}

export function validateOwnerLifecycleReceipts(input: {
  readonly workUnit: unknown;
  readonly policy: unknown;
  readonly receipts: readonly unknown[];
  readonly now: string;
}): WorkUnitViolation[] {
  const normalized = normalizeInputs(input);
  const violations: WorkUnitViolation[] = [...normalized.violations];
  if (!normalized.workUnit || !normalized.policy) return violations;

  const workUnit = normalized.workUnit;
  const policy = normalized.policy;

  violations.push(...validateWorkUnitWithinPublicCore(workUnit));
  violations.push(...validateProxyAuthorizations(policy, input.now));
  violations.push(...staleMainlineViolations(workUnit));

  if (!workUnit.owner) {
    violations.push({
      rule: "work-unit-owner-missing",
      detail: workUnit.id,
    });
  }
  if (policy.publicCoreCarriesRealInstance !== false) {
    violations.push({
      rule: "owner-lifecycle-policy-real-instance-forbidden",
      detail: workUnit.id,
    });
  }

  for (const receipt of normalized.receipts) {
    violations.push(
      ...ownerReceiptViolations({
        workUnit,
        policy,
        receipt,
        now: input.now,
      }),
    );
  }

  return violations;
}

function satisfiedOwnerRefs(input: {
  readonly workUnit: HelmWorkUnit;
  readonly policy: OwnerLifecyclePolicy;
  readonly receipts: readonly OwnerReviewReceipt[];
  readonly now: string;
}): string[] {
  return sortedUnique(
    input.receipts
      .filter((receipt) => receipt.decision === "accepted")
      .filter(
        (receipt) =>
          ownerReceiptViolations({
            workUnit: input.workUnit,
            policy: input.policy,
            receipt,
            now: input.now,
          }).length === 0,
      )
      .map((receipt) => receipt.ownerRef),
  );
}

function authorizedProxyRefs(input: {
  readonly policy: OwnerLifecyclePolicy;
  readonly receipts: readonly OwnerReviewReceipt[];
  readonly now: string;
}): string[] {
  return sortedUnique(
    input.receipts.flatMap((receipt) => {
      if (receipt.actor.actorType !== "authorized_human_proxy") return [];
      const authorization = validProxyAuthorization({
        policy: input.policy,
        receipt,
        now: input.now,
      });
      return authorization ? [receipt.actor.actorRef] : [];
    }),
  );
}

function isTimedOut(policy: OwnerLifecyclePolicy, now: string): boolean {
  const dueAtMs = parseTime(policy.reviewDueAt);
  const nowMs = parseTime(now);
  return Boolean(dueAtMs && nowMs && dueAtMs <= nowMs);
}

function hasNegativeDecision(receipts: readonly OwnerReviewReceipt[], decision: OwnerReviewDecision): boolean {
  return receipts.some((receipt) => receipt.decision === decision);
}

function derivePosture(input: {
  readonly workUnit: HelmWorkUnit;
  readonly policy: OwnerLifecyclePolicy;
  readonly receipts: readonly OwnerReviewReceipt[];
  readonly blockers: readonly WorkUnitViolation[];
  readonly satisfiedOwnerRefs: readonly string[];
  readonly pendingOwnerRefs: readonly string[];
  readonly now: string;
}): OwnerLifecyclePosture {
  if (CLOSED_WORK_UNIT_STATUSES.has(input.workUnit.status)) return "closed";

  const blockerRules = rules(input.blockers);
  if (blockerRules.includes("work-unit-owner-missing")) return "blocked_missing_owner";
  if (
    blockerRules.includes("owner-receipt-snapshot-mismatch") ||
    blockerRules.includes("owner-review-stale-related-mainline-change")
  ) {
    return "stale_review_required";
  }
  if (hasNegativeDecision(input.receipts, "rejected")) return "rejected";
  if (hasNegativeDecision(input.receipts, "changes_requested")) return "changes_requested";

  const satisfied =
    input.workUnit.requiredOwners.mode === "all_of"
      ? input.pendingOwnerRefs.length === 0
      : input.satisfiedOwnerRefs.length > 0;

  if (satisfied) return "owner_review_satisfied";
  if (isTimedOut(input.policy, input.now) && input.policy.escalationOwnerRefs.length > 0) {
    return "escalation_required";
  }
  return input.workUnit.requiredOwners.mode === "all_of"
    ? "waiting_for_all_owners"
    : "waiting_for_owner";
}

function statusCopy(posture: OwnerLifecyclePosture): OwnerLifecycleReadout["userVisible"]["status"] {
  switch (posture) {
    case "owner_review_satisfied":
      return { zh: "负责人确认已满足", en: "Owner review satisfied" };
    case "waiting_for_all_owners":
      return { zh: "等待全部负责人确认", en: "Waiting for all owners" };
    case "waiting_for_owner":
      return { zh: "等待负责人确认", en: "Waiting for owner" };
    case "escalation_required":
      return { zh: "需要升级处理", en: "Escalation required" };
    case "stale_review_required":
      return { zh: "需要重新复核", en: "Needs fresh owner review" };
    case "changes_requested":
      return { zh: "负责人要求补充", en: "Owner requested changes" };
    case "rejected":
      return { zh: "负责人已拒绝", en: "Owner rejected" };
    case "closed":
      return { zh: "已关闭", en: "Closed" };
    case "blocked_missing_owner":
    default:
      return { zh: "负责人缺失", en: "Owner missing" };
  }
}

function primaryActionCopy(
  posture: OwnerLifecyclePosture,
): OwnerLifecycleReadout["userVisible"]["primaryAction"] {
  switch (posture) {
    case "owner_review_satisfied":
      return { zh: "进入下一层定稿复核", en: "Move to mainline review" };
    case "waiting_for_all_owners":
    case "waiting_for_owner":
      return { zh: "请负责人复核", en: "Ask the owner to review" };
    case "escalation_required":
      return { zh: "准备升级复核卡", en: "Prepare escalation review card" };
    case "stale_review_required":
      return { zh: "刷新证据后重新复核", en: "Refresh evidence and review again" };
    case "changes_requested":
      return { zh: "补充材料后重新提交", en: "Repair and resubmit" };
    case "rejected":
      return { zh: "查看拒绝原因", en: "Review rejection rationale" };
    case "closed":
      return { zh: "查看记录", en: "Review record" };
    case "blocked_missing_owner":
    default:
      return { zh: "先指定负责人", en: "Assign owner first" };
  }
}

function action(options: {
  readonly actionId: OwnerLifecycleActionId;
  readonly label: OwnerLifecycleAction["label"];
  readonly enabled: boolean;
  readonly blockedBy?: readonly string[];
}): OwnerLifecycleAction {
  return {
    actionId: options.actionId,
    label: options.label,
    enabled: options.enabled,
    publicCoreExecutes: false,
    sendsNotification: false,
    createsExternalEffect: false,
    grantsApproval: false,
    blockedBy: options.blockedBy ?? [],
  };
}

function buildActions(input: {
  readonly posture: OwnerLifecyclePosture;
  readonly blockerRules: readonly string[];
}): readonly OwnerLifecycleAction[] {
  const blocked = input.blockerRules.length > 0 ? input.blockerRules : ["owner-review-not-ready"];
  return [
    action({
      actionId: "request_owner_review",
      label: { zh: "请负责人复核", en: "Ask owner to review" },
      enabled: ["waiting_for_all_owners", "waiting_for_owner", "escalation_required"].includes(
        input.posture,
      ),
      blockedBy: ["waiting_for_all_owners", "waiting_for_owner", "escalation_required"].includes(
        input.posture,
      )
        ? []
        : blocked,
    }),
    action({
      actionId: "record_owner_decision",
      label: { zh: "记录负责人决定", en: "Record owner decision" },
      enabled: [
        "waiting_for_all_owners",
        "waiting_for_owner",
        "escalation_required",
        "stale_review_required",
      ].includes(input.posture),
      blockedBy: [
        "waiting_for_all_owners",
        "waiting_for_owner",
        "escalation_required",
        "stale_review_required",
      ].includes(input.posture)
        ? []
        : blocked,
    }),
    action({
      actionId: "request_escalation",
      label: { zh: "准备升级复核卡", en: "Prepare escalation review card" },
      enabled: input.posture === "escalation_required",
      blockedBy: input.posture === "escalation_required" ? [] : ["owner-review-not-expired"],
    }),
    action({
      actionId: "record_owner_change",
      label: { zh: "记录负责人变更", en: "Record owner change" },
      enabled: !["closed", "owner_review_satisfied"].includes(input.posture),
      blockedBy: ["closed", "owner_review_satisfied"].includes(input.posture)
        ? ["owner-review-closed"]
        : [],
    }),
  ];
}

export function buildOwnerLifecycleReadout(input: {
  readonly workUnit: unknown;
  readonly policy: unknown;
  readonly receipts: readonly unknown[];
  readonly now: string;
}): OwnerLifecycleReadout {
  const normalized = normalizeInputs(input);
  if (!normalized.workUnit || !normalized.policy) {
    const blockers = normalized.violations;
    return {
      workUnitId: "unknown",
      posture: "blocked_missing_owner",
      requiredMode: "all_of",
      requiredOwnerRefs: [],
      satisfiedOwnerRefs: [],
      pendingOwnerRefs: [],
      authorizedProxyRefs: [],
      escalationOwnerRefs: [],
      blockers,
      actions: buildActions({ posture: "blocked_missing_owner", blockerRules: rules(blockers) }),
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      sendsNotification: false,
      createsExternalEffect: false,
      grantsApproval: false,
      userVisible: {
        title: { zh: "需要确认的人", en: "Required owner review" },
        status: statusCopy("blocked_missing_owner"),
        primaryAction: primaryActionCopy("blocked_missing_owner"),
        boundary: {
          zh: "只准备复核、升级和变更计划；不自动通知、不批准、不写回、不生效。",
          en: "Prepares review, escalation, and owner-change plans only; no automatic notification, approval, writeback, or activation.",
        },
      },
    };
  }

  const workUnit = normalized.workUnit;
  const policy = normalized.policy;
  const blockers = validateOwnerLifecycleReceipts({
    workUnit,
    policy,
    receipts: normalized.receipts,
    now: input.now,
  });
  const requiredRefs = requiredOwnerRefs(workUnit);
  const satisfiedRefs = satisfiedOwnerRefs({
    workUnit,
    policy,
    receipts: normalized.receipts,
    now: input.now,
  });
  const satisfiedSet = new Set(satisfiedRefs);
  const pendingRefs = requiredRefs.filter((ownerRef) => !satisfiedSet.has(ownerRef));
  const posture = derivePosture({
    workUnit,
    policy,
    receipts: normalized.receipts,
    blockers,
    satisfiedOwnerRefs: satisfiedRefs,
    pendingOwnerRefs: pendingRefs,
    now: input.now,
  });

  return {
    workUnitId: workUnit.id,
    posture,
    requiredMode: workUnit.requiredOwners.mode,
    requiredOwnerRefs: requiredRefs,
    satisfiedOwnerRefs: satisfiedRefs,
    pendingOwnerRefs: pendingRefs,
    authorizedProxyRefs: authorizedProxyRefs({
      policy,
      receipts: normalized.receipts,
      now: input.now,
    }),
    escalationOwnerRefs: policy.escalationOwnerRefs,
    blockers,
    actions: buildActions({ posture, blockerRules: rules(blockers) }),
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    sendsNotification: false,
    createsExternalEffect: false,
    grantsApproval: false,
    userVisible: {
      title: { zh: "需要确认的人", en: "Required owner review" },
      status: statusCopy(posture),
      primaryAction: primaryActionCopy(posture),
      boundary: {
        zh: "只准备复核、升级和变更计划；不自动通知、不批准、不写回、不生效。",
        en: "Prepares review, escalation, and owner-change plans only; no automatic notification, approval, writeback, or activation.",
      },
    },
  };
}

function blockedPlan(
  commandId: OwnerLifecycleActionId,
  violations: readonly WorkUnitViolation[],
): OwnerLifecyclePlan {
  return {
    ok: false,
    commandId,
    violations,
    publicCorePersists: false,
    sendsNotification: false,
    createsExternalEffect: false,
    grantsApproval: false,
  };
}

function planReceipt(input: {
  readonly workUnit: HelmWorkUnit;
  readonly event: OwnerLifecycleEvent;
}): OwnerReviewReceipt {
  return ownerReviewReceiptSchema.parse({
    schemaVersion: "helm.owner-review-receipt.v1",
    receiptId: `planned-owner-review:${input.workUnit.id}:${input.event.ownerRef}:${input.event.at}`,
    ownerRef: input.event.ownerRef,
    actor: input.event.actor,
    decision: input.event.decision,
    snapshotHash: computeWorkUnitSnapshotHash(input.workUnit),
    decidedAt: input.event.at,
    rationale: input.event.rationale,
    authorizationReceiptRef: input.event.authorizationReceiptRef,
    publicCoreCarriesRealInstance: false,
  });
}

function replaceOwner(
  requiredOwners: WorkUnitRequiredOwners,
  oldOwnerRef: string,
  newOwner: WorkUnitOwner,
): WorkUnitRequiredOwners {
  const nextOwners = requiredOwners.owners.map((owner) =>
    owner.ownerRef === oldOwnerRef ? newOwner : owner,
  );
  return workUnitRequiredOwnersSchema.parse({
    mode: requiredOwners.mode,
    owners: nextOwners,
  });
}

export function planOwnerLifecycleEvent(input: {
  readonly workUnit: unknown;
  readonly policy: unknown;
  readonly receipts: readonly unknown[];
  readonly now: string;
  readonly event: unknown;
}): OwnerLifecyclePlan {
  const normalized = normalizeInputs(input);
  const eventParse = ownerLifecycleEventSchema.safeParse(input.event);
  if (!eventParse.success) {
    return blockedPlan("record_owner_decision", schemaViolations("owner-lifecycle-event", eventParse.error));
  }
  const event = eventParse.data;
  if (!normalized.workUnit || !normalized.policy) {
    return blockedPlan(event.commandId, normalized.violations);
  }

  const workUnit = normalized.workUnit;
  const policy = normalized.policy;
  const readout = buildOwnerLifecycleReadout({
    workUnit,
    policy,
    receipts: normalized.receipts,
    now: input.now,
  });
  const selectedAction = readout.actions.find((actionItem) => actionItem.actionId === event.commandId);
  const violations: WorkUnitViolation[] = [];

  if (!selectedAction || !selectedAction.enabled) {
    violations.push(
      ...(selectedAction?.blockedBy ?? ["owner-lifecycle-action-not-enabled"]).map((rule) => ({
        rule,
        detail: event.commandId,
      })),
    );
  }

  switch (event.commandId) {
    case "request_owner_review":
      if (violations.length > 0) return blockedPlan(event.commandId, violations);
      return {
        ok: true,
        commandId: event.commandId,
        publicCorePersists: false,
        sendsNotification: false,
        createsExternalEffect: false,
        grantsApproval: false,
        auditNote: "Owner review request plan only; the private owner plane handles any real notification.",
      };
    case "request_escalation":
      if (event.actor.actorType !== "system" && !isDirectHumanOwner(event.actor)) {
        violations.push({
          rule: "owner-escalation-needs-system-or-human-owner",
          detail: event.actor.actorType,
        });
      }
      if (!isTimedOut(policy, input.now) || policy.escalationOwnerRefs.length === 0) {
        violations.push({
          rule: "owner-review-not-expired",
          detail: workUnit.id,
        });
      }
      if (violations.length > 0) return blockedPlan(event.commandId, violations);
      return {
        ok: true,
        commandId: event.commandId,
        escalationOwnerRefs: policy.escalationOwnerRefs,
        publicCorePersists: false,
        sendsNotification: false,
        createsExternalEffect: false,
        grantsApproval: false,
        auditNote: "Escalation plan only; Public Core does not notify or approve.",
      };
    case "record_owner_decision": {
      if (!isHumanOwnerActor(event.actor)) {
        violations.push({
          rule: "human-owner-lifecycle-command-required",
          detail: event.actor.actorType,
        });
      }
      if (!event.ownerRef || !event.decision) {
        violations.push({
          rule: "owner-decision-event-incomplete",
          detail: event.commandId,
        });
      }
      if (violations.length > 0) return blockedPlan(event.commandId, violations);

      const plannedReceipt = planReceipt({ workUnit, event });
      const receiptViolations = validateOwnerLifecycleReceipts({
        workUnit,
        policy,
        receipts: [plannedReceipt],
        now: input.now,
      });
      if (receiptViolations.length > 0) {
        return blockedPlan(event.commandId, receiptViolations);
      }
      return {
        ok: true,
        commandId: event.commandId,
        plannedReceipt,
        publicCorePersists: false,
        sendsNotification: false,
        createsExternalEffect: false,
        grantsApproval: false,
        auditNote: "Owner decision receipt shape only; Public Core does not store real approval.",
      };
    }
    case "record_owner_change":
      if (!isDirectHumanOwner(event.actor)) {
        violations.push({
          rule: "owner-change-needs-human-owner",
          detail: event.actor.actorType,
        });
      }
      const ownerRef = event.ownerRef;
      const newOwner = event.newOwner;
      if (!ownerRef || !newOwner || !event.ownerChangeReceiptRef) {
        violations.push({
          rule: "owner-change-event-incomplete",
          detail: event.commandId,
        });
      }
      if (ownerRef && !requiredOwnerRefs(workUnit).includes(ownerRef)) {
        violations.push({
          rule: "owner-change-source-owner-not-required",
          detail: ownerRef,
        });
      }
      if (violations.length > 0) return blockedPlan(event.commandId, violations);
      if (!ownerRef || !newOwner) {
        return blockedPlan(event.commandId, [
          { rule: "owner-change-event-incomplete", detail: event.commandId },
        ]);
      }
      return {
        ok: true,
        commandId: event.commandId,
        plannedRequiredOwners: replaceOwner(workUnit.requiredOwners, ownerRef, newOwner),
        publicCorePersists: false,
        sendsNotification: false,
        createsExternalEffect: false,
        grantsApproval: false,
        auditNote: "Owner change plan only; Public Core does not rewrite private owner assignments.",
      };
  }
}
