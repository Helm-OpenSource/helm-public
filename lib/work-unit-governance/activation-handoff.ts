import { z } from "zod";

import {
  computeWorkUnitSnapshotHash,
  helmWorkUnitSchema,
  validateWorkUnitWithinPublicCore,
  workUnitActivationScopeSchema,
  workUnitActorSchema,
  workUnitRollbackOrRemediationPlanSchema,
  type HelmWorkUnit,
  type WorkUnitActor,
  type WorkUnitActivationScope,
  type WorkUnitViolation,
} from "./contracts";

export const activationHandoffPostureSchema = z.enum([
  "blocked",
  "mainline_required",
  "handoff_request_ready",
  "authorization_required",
  "authorized_for_private_plane",
  "stale_review_required",
]);
export type ActivationHandoffPosture = z.infer<typeof activationHandoffPostureSchema>;

export const activationHandoffCommandIdSchema = z.enum([
  "request_activation_handoff",
  "record_activation_authorization",
]);
export type ActivationHandoffCommandId = z.infer<typeof activationHandoffCommandIdSchema>;

export const activationHandoffRequestSchema = z
  .object({
    schemaVersion: z.literal("helm.activation-handoff-request.v1"),
    handoffId: z.string().min(1),
    workUnitId: z.string().min(1),
    requestedScope: workUnitActivationScopeSchema,
    targetRef: z.string().min(1),
    requestedBy: workUnitActorSchema,
    requestedAt: z.string().min(1),
    snapshotHash: z.string().min(1),
    mainlineReceiptRef: z.string().min(1),
    rollbackOrRemediationPlan: workUnitRollbackOrRemediationPlanSchema,
    publicCoreCarriesRealInstance: z.literal(false),
    createsExternalEffect: z.literal(false),
    sendsExternally: z.literal(false),
    writesTarget: z.literal(false),
    activatesRuntime: z.literal(false),
  })
  .strict();
export type ActivationHandoffRequest = z.infer<typeof activationHandoffRequestSchema>;

export const activationAuthorityReceiptSchema = z
  .object({
    schemaVersion: z.literal("helm.activation-authority-receipt.v1"),
    receiptId: z.string().min(1),
    handoffId: z.string().min(1),
    workUnitId: z.string().min(1),
    authorizedScope: workUnitActivationScopeSchema,
    actor: workUnitActorSchema,
    authorizedAt: z.string().min(1),
    snapshotHash: z.string().min(1),
    rationale: z.string().min(1),
    authorizationBasisRefs: z.array(z.string().min(1)).min(1),
    publicCoreCarriesRealInstance: z.literal(false),
    createsExternalEffect: z.literal(false),
    sendsExternally: z.literal(false),
    writesTarget: z.literal(false),
    activatesRuntime: z.literal(false),
    grantsApproval: z.literal(false),
  })
  .strict();
export type ActivationAuthorityReceipt = z.infer<typeof activationAuthorityReceiptSchema>;

export const activationHandoffEventSchema = z
  .object({
    commandId: activationHandoffCommandIdSchema,
    actor: workUnitActorSchema,
    at: z.string().min(1),
    rationale: z.string().min(1),
    targetRef: z.string().min(1).optional(),
    authorizationBasisRefs: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type ActivationHandoffEvent = z.infer<typeof activationHandoffEventSchema>;

export type ActivationHandoffAction = {
  readonly actionId: ActivationHandoffCommandId;
  readonly label: {
    readonly zh: string;
    readonly en: string;
  };
  readonly enabled: boolean;
  readonly publicCoreExecutes: false;
  readonly createsExternalEffect: false;
  readonly sendsExternally: false;
  readonly writesTarget: false;
  readonly activatesRuntime: false;
  readonly grantsApproval: false;
  readonly blockedBy: readonly string[];
};

export type ActivationHandoffReadout = {
  readonly workUnitId: string;
  readonly posture: ActivationHandoffPosture;
  readonly requestedScope: WorkUnitActivationScope;
  readonly snapshotHash: string;
  readonly mainlineReceiptRef: string | null;
  readonly recoveryMode: "rollback" | "remediation";
  readonly blockers: readonly WorkUnitViolation[];
  readonly actions: readonly ActivationHandoffAction[];
  readonly publicCoreCarriesRealInstance: false;
  readonly publicCorePersists: false;
  readonly createsExternalEffect: false;
  readonly sendsExternally: false;
  readonly writesTarget: false;
  readonly activatesRuntime: false;
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

export type ActivationHandoffPlan =
  | {
      readonly ok: true;
      readonly commandId: ActivationHandoffCommandId;
      readonly plannedRequest?: ActivationHandoffRequest;
      readonly plannedReceipt?: ActivationAuthorityReceipt;
      readonly publicCorePersists: false;
      readonly createsExternalEffect: false;
      readonly sendsExternally: false;
      readonly writesTarget: false;
      readonly activatesRuntime: false;
      readonly grantsApproval: false;
      readonly auditNote: string;
    }
  | {
      readonly ok: false;
      readonly commandId: ActivationHandoffCommandId;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly createsExternalEffect: false;
      readonly sendsExternally: false;
      readonly writesTarget: false;
      readonly activatesRuntime: false;
      readonly grantsApproval: false;
    };

const HUMAN_OWNER_ACTOR_TYPES: ReadonlySet<WorkUnitActor["actorType"]> = new Set([
  "human_owner",
  "authorized_human_proxy",
]);

const REMEDIATION_REQUIRED_SCOPES: ReadonlySet<WorkUnitActivationScope> = new Set([
  "customer_visible",
  "commercial_commitment",
]);

function isHumanOwnerActor(actor: WorkUnitActor | undefined): boolean {
  return Boolean(actor && HUMAN_OWNER_ACTOR_TYPES.has(actor.actorType));
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

function schemaViolations(prefix: string, error: z.ZodError): WorkUnitViolation[] {
  return error.issues.map((issue) => ({
    rule: `${prefix}-schema`,
    detail: `${issue.path.join(".") || "<root>"}: ${issue.message}`,
  }));
}

function publicCoreWorkUnitViolationsForHandoff(workUnit: HelmWorkUnit): WorkUnitViolation[] {
  return validateWorkUnitWithinPublicCore(workUnit).filter(
    (violation) => violation.rule !== "activation-needs-independent-receipt",
  );
}

function sideEffectViolations(input: {
  readonly prefix: string;
  readonly id: string;
  readonly publicCoreCarriesRealInstance: false;
  readonly createsExternalEffect: false;
  readonly sendsExternally: false;
  readonly writesTarget: false;
  readonly activatesRuntime: false;
  readonly grantsApproval?: false;
}): WorkUnitViolation[] {
  const violations: WorkUnitViolation[] = [];
  if (input.publicCoreCarriesRealInstance !== false) {
    violations.push({ rule: `${input.prefix}-real-instance-forbidden`, detail: input.id });
  }
  if (input.createsExternalEffect !== false) {
    violations.push({ rule: `${input.prefix}-external-effect-forbidden`, detail: input.id });
  }
  if (input.sendsExternally !== false) {
    violations.push({ rule: `${input.prefix}-send-forbidden`, detail: input.id });
  }
  if (input.writesTarget !== false) {
    violations.push({ rule: `${input.prefix}-write-forbidden`, detail: input.id });
  }
  if (input.activatesRuntime !== false) {
    violations.push({ rule: `${input.prefix}-activation-forbidden`, detail: input.id });
  }
  if (input.grantsApproval !== undefined && input.grantsApproval !== false) {
    violations.push({ rule: `${input.prefix}-approval-forbidden`, detail: input.id });
  }
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
        rule: "activation-handoff-stale-mainline",
        detail: workUnit.id,
      },
    ];
  }
  return [];
}

function planMatches(workUnit: HelmWorkUnit, request: ActivationHandoffRequest): boolean {
  return JSON.stringify(sorted(workUnit.rollbackOrRemediationPlan)) ===
    JSON.stringify(sorted(request.rollbackOrRemediationPlan));
}

function recoveryPlanViolations(input: {
  readonly scope: WorkUnitActivationScope;
  readonly plan: HelmWorkUnit["rollbackOrRemediationPlan"];
}): WorkUnitViolation[] {
  if (
    REMEDIATION_REQUIRED_SCOPES.has(input.scope) &&
    input.plan.kind !== "remediation"
  ) {
    return [
      {
        rule: "activation-handoff-remediation-required",
        detail: input.scope,
      },
    ];
  }
  return [];
}

export function validateActivationHandoffRequest(input: {
  readonly workUnit: unknown;
  readonly request: unknown;
}): WorkUnitViolation[] {
  const workUnitParse = helmWorkUnitSchema.safeParse(input.workUnit);
  const requestParse = activationHandoffRequestSchema.safeParse(input.request);
  const violations: WorkUnitViolation[] = [];

  if (!workUnitParse.success) {
    violations.push(...schemaViolations("activation-handoff-work-unit", workUnitParse.error));
  }
  if (!requestParse.success) {
    violations.push(...schemaViolations("activation-handoff-request", requestParse.error));
  }
  if (!workUnitParse.success || !requestParse.success) return violations;

  const workUnit = workUnitParse.data;
  const request = requestParse.data;
  const snapshotHash = computeWorkUnitSnapshotHash(workUnit);

  violations.push(...publicCoreWorkUnitViolationsForHandoff(workUnit));
  violations.push(...staleMainlineViolations(workUnit));
  violations.push(
    ...sideEffectViolations({
      prefix: "activation-handoff-request",
      id: request.handoffId,
      publicCoreCarriesRealInstance: request.publicCoreCarriesRealInstance,
      createsExternalEffect: request.createsExternalEffect,
      sendsExternally: request.sendsExternally,
      writesTarget: request.writesTarget,
      activatesRuntime: request.activatesRuntime,
    }),
  );

  if (workUnit.status !== "promoted_to_mainline") {
    violations.push({
      rule: "activation-handoff-mainline-required",
      detail: workUnit.status,
    });
  }
  if (!workUnit.mergeReceipt) {
    violations.push({
      rule: "activation-handoff-mainline-receipt-required",
      detail: workUnit.id,
    });
  } else if (request.mainlineReceiptRef !== workUnit.mergeReceipt.receiptId) {
    violations.push({
      rule: "activation-handoff-mainline-receipt-mismatch",
      detail: request.mainlineReceiptRef,
    });
  }
  if (request.workUnitId !== workUnit.id) {
    violations.push({
      rule: "activation-handoff-work-unit-mismatch",
      detail: `${request.workUnitId} != ${workUnit.id}`,
    });
  }
  if (request.requestedScope !== workUnit.activationScope) {
    violations.push({
      rule: "activation-handoff-scope-mismatch",
      detail: `${request.requestedScope} != ${workUnit.activationScope}`,
    });
  }
  if (!isHumanOwnerActor(request.requestedBy)) {
    violations.push({
      rule: "activation-handoff-request-needs-human-owner",
      detail: `${request.handoffId}:${request.requestedBy.actorType}`,
    });
  }
  if (request.snapshotHash !== snapshotHash) {
    violations.push({
      rule: "activation-handoff-snapshot-mismatch",
      detail: request.handoffId,
    });
  }
  if (!planMatches(workUnit, request)) {
    violations.push({
      rule: "activation-handoff-recovery-plan-mismatch",
      detail: request.handoffId,
    });
  }
  violations.push(
    ...recoveryPlanViolations({
      scope: request.requestedScope,
      plan: request.rollbackOrRemediationPlan,
    }),
  );

  return violations;
}

export function validateActivationAuthorization(input: {
  readonly workUnit: unknown;
  readonly request: unknown;
  readonly receipt: unknown;
}): WorkUnitViolation[] {
  const requestViolations = validateActivationHandoffRequest({
    workUnit: input.workUnit,
    request: input.request,
  });
  const workUnit = helmWorkUnitSchema.safeParse(input.workUnit);
  const request = activationHandoffRequestSchema.safeParse(input.request);
  const receipt = activationAuthorityReceiptSchema.safeParse(input.receipt);
  const violations: WorkUnitViolation[] = [...requestViolations];

  if (!receipt.success) {
    violations.push(...schemaViolations("activation-authority-receipt", receipt.error));
  }
  if (!workUnit.success || !request.success || !receipt.success) return violations;

  const receiptData = receipt.data;
  violations.push(
    ...sideEffectViolations({
      prefix: "activation-authority-receipt",
      id: receiptData.receiptId,
      publicCoreCarriesRealInstance: receiptData.publicCoreCarriesRealInstance,
      createsExternalEffect: receiptData.createsExternalEffect,
      sendsExternally: receiptData.sendsExternally,
      writesTarget: receiptData.writesTarget,
      activatesRuntime: receiptData.activatesRuntime,
      grantsApproval: receiptData.grantsApproval,
    }),
  );

  if (!isHumanOwnerActor(receiptData.actor)) {
    violations.push({
      rule: "activation-authorization-needs-human-owner",
      detail: `${receiptData.receiptId}:${receiptData.actor.actorType}`,
    });
  }
  if (receiptData.handoffId !== request.data.handoffId) {
    violations.push({
      rule: "activation-authorization-handoff-mismatch",
      detail: receiptData.handoffId,
    });
  }
  if (receiptData.workUnitId !== workUnit.data.id) {
    violations.push({
      rule: "activation-authorization-work-unit-mismatch",
      detail: receiptData.workUnitId,
    });
  }
  if (receiptData.authorizedScope !== request.data.requestedScope) {
    violations.push({
      rule: "activation-authorization-scope-mismatch",
      detail: `${receiptData.authorizedScope} != ${request.data.requestedScope}`,
    });
  }
  if (receiptData.snapshotHash !== request.data.snapshotHash) {
    violations.push({
      rule: "activation-authorization-snapshot-mismatch",
      detail: receiptData.receiptId,
    });
  }

  return violations;
}

function statusCopy(posture: ActivationHandoffPosture): ActivationHandoffReadout["userVisible"]["status"] {
  switch (posture) {
    case "authorized_for_private_plane":
      return { zh: "已具备私有平面授权形状", en: "Private-plane authorization shape ready" };
    case "authorization_required":
      return { zh: "等待独立授权", en: "Waiting for separate authorization" };
    case "handoff_request_ready":
      return { zh: "可准备生效交接", en: "Ready to prepare activation handoff" };
    case "mainline_required":
      return { zh: "需要先定稿", en: "Mainline recording required first" };
    case "stale_review_required":
      return { zh: "需要重新复核", en: "Fresh review required" };
    case "blocked":
    default:
      return { zh: "边界阻断", en: "Boundary blocked" };
  }
}

function primaryActionCopy(
  posture: ActivationHandoffPosture,
): ActivationHandoffReadout["userVisible"]["primaryAction"] {
  switch (posture) {
    case "authorized_for_private_plane":
      return { zh: "交给私有生效平面处理", en: "Hand off to the private activation plane" };
    case "authorization_required":
      return { zh: "请负责人独立授权", en: "Ask owner for separate authorization" };
    case "handoff_request_ready":
      return { zh: "准备生效交接包", en: "Prepare activation handoff" };
    case "mainline_required":
      return { zh: "先进入公司主线", en: "Record in company mainline first" };
    case "stale_review_required":
      return { zh: "刷新证据后重新复核", en: "Refresh evidence and review again" };
    case "blocked":
    default:
      return { zh: "先解除阻断", en: "Resolve blockers first" };
  }
}

function action(options: {
  readonly actionId: ActivationHandoffCommandId;
  readonly label: ActivationHandoffAction["label"];
  readonly enabled: boolean;
  readonly blockedBy?: readonly string[];
}): ActivationHandoffAction {
  return {
    actionId: options.actionId,
    label: options.label,
    enabled: options.enabled,
    publicCoreExecutes: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
    blockedBy: options.blockedBy ?? [],
  };
}

function buildActions(input: {
  readonly posture: ActivationHandoffPosture;
  readonly blockerRules: readonly string[];
}): readonly ActivationHandoffAction[] {
  const blocked = input.blockerRules.length > 0 ? input.blockerRules : ["activation-handoff-not-ready"];
  return [
    action({
      actionId: "request_activation_handoff",
      label: { zh: "准备生效交接包", en: "Prepare activation handoff" },
      enabled: input.posture === "handoff_request_ready",
      blockedBy: input.posture === "handoff_request_ready" ? [] : blocked,
    }),
    action({
      actionId: "record_activation_authorization",
      label: { zh: "记录独立授权形状", en: "Record separate authorization shape" },
      enabled: input.posture === "authorization_required",
      blockedBy: input.posture === "authorization_required" ? [] : blocked,
    }),
  ];
}

function derivePosture(input: {
  readonly workUnit: HelmWorkUnit;
  readonly request?: ActivationHandoffRequest;
  readonly receipt?: ActivationAuthorityReceipt;
  readonly blockers: readonly WorkUnitViolation[];
}): ActivationHandoffPosture {
  const blockerRules = rules(input.blockers);
  if (blockerRules.includes("activation-handoff-stale-mainline")) {
    return "stale_review_required";
  }
  if (input.blockers.length > 0) return "blocked";
  if (input.receipt) return "authorized_for_private_plane";
  if (input.request) return "authorization_required";
  if (input.workUnit.status === "promoted_to_mainline") return "handoff_request_ready";
  return "mainline_required";
}

export function buildActivationHandoffReadout(input: {
  readonly workUnit: unknown;
  readonly request?: unknown;
  readonly receipt?: unknown;
}): ActivationHandoffReadout {
  const workUnitParse = helmWorkUnitSchema.safeParse(input.workUnit);
  if (!workUnitParse.success) {
    const blockers = schemaViolations("activation-handoff-work-unit", workUnitParse.error);
    return {
      workUnitId: "unknown",
      posture: "blocked",
      requestedScope: "local_proof",
      snapshotHash: "",
      mainlineReceiptRef: null,
      recoveryMode: "rollback",
      blockers,
      actions: buildActions({ posture: "blocked", blockerRules: rules(blockers) }),
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      createsExternalEffect: false,
      sendsExternally: false,
      writesTarget: false,
      activatesRuntime: false,
      grantsApproval: false,
      userVisible: {
        title: { zh: "生效范围交接", en: "Activation scope handoff" },
        status: statusCopy("blocked"),
        primaryAction: primaryActionCopy("blocked"),
        boundary: {
          zh: "只准备交接和授权形状；不自动外发、不写回、不连接客户系统、不自动生效。",
          en: "Prepares handoff and authorization shapes only; no automatic send, writeback, customer-system connection, or activation.",
        },
      },
    };
  }

  const workUnit = workUnitParse.data;
  const requestParse = input.request === undefined
    ? undefined
    : activationHandoffRequestSchema.safeParse(input.request);
  const receiptParse = input.receipt === undefined
    ? undefined
    : activationAuthorityReceiptSchema.safeParse(input.receipt);
  const blockers: WorkUnitViolation[] = [];

  if (requestParse && !requestParse.success) {
    blockers.push(...schemaViolations("activation-handoff-request", requestParse.error));
  }
  if (receiptParse && !receiptParse.success) {
    blockers.push(...schemaViolations("activation-authority-receipt", receiptParse.error));
  }
  if (receiptParse?.success && !requestParse?.success) {
    blockers.push({
      rule: "activation-authorization-request-required",
      detail: receiptParse.data.receiptId,
    });
  }
  if (requestParse?.success && receiptParse?.success) {
    blockers.push(
      ...validateActivationAuthorization({
        workUnit,
        request: requestParse.data,
        receipt: receiptParse.data,
      }),
    );
  } else if (requestParse?.success) {
    blockers.push(...validateActivationHandoffRequest({ workUnit, request: requestParse.data }));
  } else {
    blockers.push(...publicCoreWorkUnitViolationsForHandoff(workUnit));
    blockers.push(...staleMainlineViolations(workUnit));
    blockers.push(
      ...recoveryPlanViolations({
        scope: workUnit.activationScope,
        plan: workUnit.rollbackOrRemediationPlan,
      }),
    );
    if (workUnit.status !== "promoted_to_mainline") {
      blockers.push({
        rule: "activation-handoff-mainline-required",
        detail: workUnit.status,
      });
    }
  }

  const request = requestParse?.success ? requestParse.data : undefined;
  const receipt = receiptParse?.success ? receiptParse.data : undefined;
  const posture = derivePosture({ workUnit, request, receipt, blockers });

  return {
    workUnitId: workUnit.id,
    posture,
    requestedScope: request?.requestedScope ?? workUnit.activationScope,
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    mainlineReceiptRef: request?.mainlineReceiptRef ?? workUnit.mergeReceipt?.receiptId ?? null,
    recoveryMode: (request?.rollbackOrRemediationPlan ?? workUnit.rollbackOrRemediationPlan).kind,
    blockers,
    actions: buildActions({ posture, blockerRules: rules(blockers) }),
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
    userVisible: {
      title: { zh: "生效范围交接", en: "Activation scope handoff" },
      status: statusCopy(posture),
      primaryAction: primaryActionCopy(posture),
      boundary: {
        zh: "只准备交接和授权形状；不自动外发、不写回、不连接客户系统、不自动生效。",
        en: "Prepares handoff and authorization shapes only; no automatic send, writeback, customer-system connection, or activation.",
      },
    },
  };
}

function requestFromEvent(workUnit: HelmWorkUnit, event: ActivationHandoffEvent): ActivationHandoffRequest {
  return activationHandoffRequestSchema.parse({
    schemaVersion: "helm.activation-handoff-request.v1",
    handoffId: `activation-handoff:${workUnit.id}:${event.at}`,
    workUnitId: workUnit.id,
    requestedScope: workUnit.activationScope,
    targetRef: event.targetRef ?? `synthetic://activation-target/${workUnit.id}`,
    requestedBy: event.actor,
    requestedAt: event.at,
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    mainlineReceiptRef: workUnit.mergeReceipt?.receiptId ?? "missing-mainline-receipt",
    rollbackOrRemediationPlan: workUnit.rollbackOrRemediationPlan,
    publicCoreCarriesRealInstance: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    activatesRuntime: false,
  });
}

function receiptFromEvent(input: {
  readonly workUnit: HelmWorkUnit;
  readonly request: ActivationHandoffRequest;
  readonly event: ActivationHandoffEvent;
}): ActivationAuthorityReceipt {
  return activationAuthorityReceiptSchema.parse({
    schemaVersion: "helm.activation-authority-receipt.v1",
    receiptId: `activation-authority:${input.workUnit.id}:${input.event.at}`,
    handoffId: input.request.handoffId,
    workUnitId: input.workUnit.id,
    authorizedScope: input.request.requestedScope,
    actor: input.event.actor,
    authorizedAt: input.event.at,
    snapshotHash: input.request.snapshotHash,
    rationale: input.event.rationale,
    authorizationBasisRefs: input.event.authorizationBasisRefs ?? [
      input.request.mainlineReceiptRef,
    ],
    publicCoreCarriesRealInstance: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
  });
}

function blockedPlan(
  commandId: ActivationHandoffCommandId,
  violations: readonly WorkUnitViolation[],
): ActivationHandoffPlan {
  return {
    ok: false,
    commandId,
    violations,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
  };
}

export function planActivationHandoffEvent(input: {
  readonly workUnit: unknown;
  readonly request?: unknown;
  readonly event: unknown;
}): ActivationHandoffPlan {
  const workUnit = helmWorkUnitSchema.parse(input.workUnit);
  const event = activationHandoffEventSchema.parse(input.event);

  if (!isHumanOwnerActor(event.actor)) {
    return blockedPlan(event.commandId, [
      {
        rule: "activation-handoff-command-needs-human-owner",
        detail: `${event.commandId}:${event.actor.actorType}`,
      },
    ]);
  }

  if (event.commandId === "request_activation_handoff") {
    const plannedRequest = requestFromEvent(workUnit, event);
    const violations = validateActivationHandoffRequest({
      workUnit,
      request: plannedRequest,
    });
    if (violations.length > 0) {
      return blockedPlan(event.commandId, violations);
    }
    return {
      ok: true,
      commandId: event.commandId,
      plannedRequest,
      publicCorePersists: false,
      createsExternalEffect: false,
      sendsExternally: false,
      writesTarget: false,
      activatesRuntime: false,
      grantsApproval: false,
      auditNote: "Activation handoff request shape only; Public Core does not send, write, or activate.",
    };
  }

  const requestParse = activationHandoffRequestSchema.safeParse(input.request);
  if (!requestParse.success) {
    return blockedPlan(event.commandId, schemaViolations("activation-handoff-request", requestParse.error));
  }
  const plannedReceipt = receiptFromEvent({
    workUnit,
    request: requestParse.data,
    event,
  });
  const violations = validateActivationAuthorization({
    workUnit,
    request: requestParse.data,
    receipt: plannedReceipt,
  });
  if (violations.length > 0) {
    return blockedPlan(event.commandId, violations);
  }
  return {
    ok: true,
    commandId: event.commandId,
    plannedReceipt,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
    auditNote: "Activation authorization receipt shape only; runtime activation belongs to the private plane.",
  };
}
