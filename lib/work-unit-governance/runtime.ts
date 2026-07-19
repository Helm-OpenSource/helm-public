import { z } from "zod";

import {
  buildDecisionCard,
  computeWorkUnitSnapshotHash,
  helmWorkUnitSchema,
  validateWorkUnitWithinPublicCore,
  workUnitActorSchema,
  type HelmWorkUnit,
  type WorkUnitActor,
  type WorkUnitDecision,
  type WorkUnitReceipt,
  type WorkUnitState,
  type WorkUnitViolation,
} from "./contracts";

export const workUnitRuntimePostureSchema = z.enum([
  "blocked",
  "needs_repair",
  "owner_review_ready",
  "accepted_waiting_mainline",
  "mainline_recorded",
  "activation_review_required",
  "stale",
  "closed",
]);
export type WorkUnitRuntimePosture = z.infer<typeof workUnitRuntimePostureSchema>;

export const workUnitRuntimeCommandIdSchema = z.enum([
  "accept_candidate",
  "request_changes",
  "reject_candidate",
  "record_mainline",
  "request_activation",
  "record_activation",
]);
export type WorkUnitRuntimeCommandId = z.infer<typeof workUnitRuntimeCommandIdSchema>;

export const workUnitRuntimeEventSchema = z
  .object({
    commandId: workUnitRuntimeCommandIdSchema,
    actor: workUnitActorSchema,
    at: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();
export type WorkUnitRuntimeEvent = z.infer<typeof workUnitRuntimeEventSchema>;

export type WorkUnitRuntimeCommand = {
  readonly commandId: WorkUnitRuntimeCommandId;
  readonly label: {
    readonly zh: string;
    readonly en: string;
  };
  readonly enabled: boolean;
  readonly nextState: WorkUnitState | null;
  readonly requiresHumanOwner: boolean;
  readonly publicCoreExecutes: false;
  readonly createsExternalEffect: false;
  readonly blockedBy: readonly string[];
};

export type WorkUnitRuntimeReadout = {
  readonly workUnitId: string;
  readonly posture: WorkUnitRuntimePosture;
  readonly status: WorkUnitState;
  readonly snapshotHash: string;
  readonly riskClass: HelmWorkUnit["riskClass"];
  readonly card: ReturnType<typeof buildDecisionCard>;
  readonly blockers: readonly WorkUnitViolation[];
  readonly commands: readonly WorkUnitRuntimeCommand[];
  readonly privateMainlineBoundary: {
    readonly publicCoreCarriesRealInstance: false;
    readonly writesMainline: false;
    readonly activatesRuntime: false;
    readonly sendsExternally: false;
  };
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

export type WorkUnitPlannedState = Partial<
  Pick<
    HelmWorkUnit,
    | "status"
    | "decision"
    | "decisionSnapshotHash"
    | "mergeReceipt"
    | "activationReceipt"
    | "updatedAt"
  >
>;

export type WorkUnitRuntimePlan =
  | {
      readonly ok: true;
      readonly commandId: WorkUnitRuntimeCommandId;
      readonly plannedState: WorkUnitPlannedState;
      readonly publicCorePersists: false;
      readonly createsExternalEffect: false;
      readonly auditNote: string;
    }
  | {
      readonly ok: false;
      readonly commandId: WorkUnitRuntimeCommandId;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly createsExternalEffect: false;
    };

export type PrivateMainlineProjectionEntry = {
  readonly entryId: string;
  readonly workUnitId: string;
  readonly state: Extract<
    WorkUnitState,
    "accepted_by_human" | "promoted_to_mainline" | "activation_requested" | "activated_by_human"
  >;
  readonly snapshotHash: string;
  readonly conflictKeys: readonly string[];
  readonly auditRefs: readonly string[];
  readonly publicCoreCarriesRealInstance: false;
};

export type PrivateMainlineProjection = {
  readonly projectionKind: "public_core_private_mainline_shape";
  readonly publicCoreCarriesRealInstance: false;
  readonly entries: readonly PrivateMainlineProjectionEntry[];
  readonly effectiveByConflictKey: ReadonlyArray<{
    readonly conflictKey: string;
    readonly entryId: string;
  }>;
};

const HUMAN_OWNER_ACTOR_TYPES: ReadonlySet<WorkUnitActor["actorType"]> = new Set([
  "human_owner",
  "authorized_human_proxy",
]);

const MAINLINE_ENTRY_STATES: ReadonlySet<WorkUnitState> = new Set([
  "accepted_by_human",
  "promoted_to_mainline",
  "activation_requested",
  "activated_by_human",
]);

function isHumanOwnerActor(actor: WorkUnitActor): boolean {
  return HUMAN_OWNER_ACTOR_TYPES.has(actor.actorType);
}

function validationFailures(workUnit: HelmWorkUnit): WorkUnitViolation[] {
  return workUnit.validationReceipts
    .filter((receipt) => !receipt.ok)
    .map((receipt) => ({
      rule: "validation-check-failed",
      detail: receipt.name,
    }));
}

function rules(violations: readonly WorkUnitViolation[]): string[] {
  return [...new Set(violations.map((violation) => violation.rule))];
}

function statusCopy(posture: WorkUnitRuntimePosture): WorkUnitRuntimeReadout["userVisible"]["status"] {
  switch (posture) {
    case "owner_review_ready":
      return { zh: "等待负责人复核", en: "Waiting for owner review" };
    case "accepted_waiting_mainline":
      return { zh: "已接受，等待定稿", en: "Accepted, waiting for mainline recording" };
    case "mainline_recorded":
      return { zh: "已进入公司主线", en: "Recorded in company mainline" };
    case "activation_review_required":
      return { zh: "等待独立生效授权", en: "Waiting for separate activation approval" };
    case "needs_repair":
      return { zh: "需要修复后复核", en: "Needs repair before review" };
    case "stale":
      return { zh: "需要重新复核", en: "Needs fresh review" };
    case "closed":
      return { zh: "已关闭", en: "Closed" };
    case "blocked":
    default:
      return { zh: "边界阻断", en: "Boundary blocked" };
  }
}

function primaryActionCopy(
  posture: WorkUnitRuntimePosture,
): WorkUnitRuntimeReadout["userVisible"]["primaryAction"] {
  switch (posture) {
    case "owner_review_ready":
      return { zh: "复核候选方案", en: "Review candidate" };
    case "accepted_waiting_mainline":
      return { zh: "确认是否定稿", en: "Record accepted snapshot" };
    case "mainline_recorded":
      return { zh: "确认是否申请生效", en: "Request separate activation" };
    case "needs_repair":
      return { zh: "退回补充材料", en: "Return for repair" };
    case "stale":
      return { zh: "重新复核后再定稿", en: "Refresh review before recording" };
    case "activation_review_required":
      return { zh: "等待独立授权", en: "Wait for separate approval" };
    case "closed":
      return { zh: "查看记录", en: "Review record" };
    case "blocked":
    default:
      return { zh: "先解除阻断", en: "Resolve blocker first" };
  }
}

function command(options: {
  readonly commandId: WorkUnitRuntimeCommandId;
  readonly label: WorkUnitRuntimeCommand["label"];
  readonly enabled: boolean;
  readonly nextState: WorkUnitState | null;
  readonly requiresHumanOwner?: boolean;
  readonly blockedBy?: readonly string[];
}): WorkUnitRuntimeCommand {
  return {
    commandId: options.commandId,
    label: options.label,
    enabled: options.enabled,
    nextState: options.nextState,
    requiresHumanOwner: options.requiresHumanOwner ?? true,
    publicCoreExecutes: false,
    createsExternalEffect: false,
    blockedBy: options.blockedBy ?? [],
  };
}

function derivePosture(
  workUnit: HelmWorkUnit,
  blockers: readonly WorkUnitViolation[],
): WorkUnitRuntimePosture {
  const blockerRules = rules(blockers);
  if (blockerRules.includes("approval-invalidated-by-related-mainline-change")) {
    return "stale";
  }
  if (blockerRules.includes("validation-check-failed")) {
    return "needs_repair";
  }
  if (blockers.length > 0) {
    return "blocked";
  }

  switch (workUnit.status) {
    case "draft":
    case "candidate":
    case "checking":
    case "needs_owner_review":
      return "owner_review_ready";
    case "changes_requested":
      return "needs_repair";
    case "accepted_by_human":
      return "accepted_waiting_mainline";
    case "promoted_to_mainline":
      return "mainline_recorded";
    case "activation_requested":
      return "activation_review_required";
    case "activated_by_human":
    case "rejected_by_human":
    case "withdrawn":
    case "superseded":
      return "closed";
    case "stale":
      return "stale";
    case "quarantined":
    default:
      return "blocked";
  }
}

function buildCommands(
  posture: WorkUnitRuntimePosture,
  blockers: readonly WorkUnitViolation[],
): readonly WorkUnitRuntimeCommand[] {
  const blockerRules = rules(blockers);
  const candidateNotReady =
    blockerRules.length > 0 ? blockerRules : ["candidate-not-ready"];
  const notAccepted =
    blockerRules.length > 0 ? blockerRules : ["human-accepted-snapshot-required"];
  const notMainline =
    blockerRules.length > 0 ? blockerRules : ["mainline-record-required"];

  return [
    command({
      commandId: "accept_candidate",
      label: { zh: "接受候选", en: "Accept candidate" },
      enabled: posture === "owner_review_ready",
      nextState: "accepted_by_human",
      blockedBy: posture === "owner_review_ready" ? [] : candidateNotReady,
    }),
    command({
      commandId: "request_changes",
      label: { zh: "退回补充", en: "Request changes" },
      enabled: ["owner_review_ready", "needs_repair", "stale", "blocked"].includes(posture),
      nextState: "changes_requested",
      blockedBy: ["closed", "mainline_recorded", "activation_review_required"].includes(posture)
        ? ["work-unit-not-editable"]
        : [],
    }),
    command({
      commandId: "reject_candidate",
      label: { zh: "拒绝候选", en: "Reject candidate" },
      enabled: ["owner_review_ready", "needs_repair", "stale", "blocked"].includes(posture),
      nextState: "rejected_by_human",
      blockedBy: ["closed", "mainline_recorded", "activation_review_required"].includes(posture)
        ? ["work-unit-not-editable"]
        : [],
    }),
    command({
      commandId: "record_mainline",
      label: { zh: "定稿进入公司主线", en: "Record in company mainline" },
      enabled: posture === "accepted_waiting_mainline",
      nextState: "promoted_to_mainline",
      blockedBy: posture === "accepted_waiting_mainline" ? [] : notAccepted,
    }),
    command({
      commandId: "request_activation",
      label: { zh: "申请独立生效", en: "Request separate activation" },
      enabled: posture === "mainline_recorded",
      nextState: "activation_requested",
      blockedBy: posture === "mainline_recorded" ? [] : notMainline,
    }),
    command({
      commandId: "record_activation",
      label: { zh: "记录生效授权", en: "Record activation approval" },
      enabled: false,
      nextState: "activated_by_human",
      blockedBy: ["public-core-does-not-activate"],
    }),
  ];
}

export function buildWorkUnitRuntimeReadout(input: unknown): WorkUnitRuntimeReadout {
  const workUnit = helmWorkUnitSchema.parse(input);
  const blockers = [
    ...validateWorkUnitWithinPublicCore(workUnit),
    ...validationFailures(workUnit),
  ];
  const posture = derivePosture(workUnit, blockers);

  return {
    workUnitId: workUnit.id,
    posture,
    status: workUnit.status,
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    riskClass: workUnit.riskClass,
    card: buildDecisionCard(workUnit),
    blockers,
    commands: buildCommands(posture, blockers),
    privateMainlineBoundary: {
      publicCoreCarriesRealInstance: false,
      writesMainline: false,
      activatesRuntime: false,
      sendsExternally: false,
    },
    userVisible: {
      title: { zh: "工作包复核台", en: "Work package review" },
      status: statusCopy(posture),
      primaryAction: primaryActionCopy(posture),
      boundary: {
        zh: "无自动批准、无自动外发、无自动写回、无自动生效。",
        en: "No automatic approval, send, writeback, or activation.",
      },
    },
  };
}

function buildDecision(
  workUnit: HelmWorkUnit,
  event: WorkUnitRuntimeEvent,
  decision: WorkUnitDecision["decision"],
): WorkUnitDecision {
  return {
    decidedBy: event.actor,
    decision,
    decidedAt: event.at,
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    rationale: event.rationale,
  };
}

function buildReceipt(
  workUnit: HelmWorkUnit,
  event: WorkUnitRuntimeEvent,
  receiptPrefix: string,
): WorkUnitReceipt {
  return {
    receiptId: `${receiptPrefix}:${workUnit.id}:${event.at}`,
    actor: event.actor,
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    createdAt: event.at,
    summary: "Planned receipt shape only; Public Core does not persist real private instances.",
    publicCoreCarriesRealInstance: false,
  };
}

function blockedPlan(
  commandId: WorkUnitRuntimeCommandId,
  violations: readonly WorkUnitViolation[],
): WorkUnitRuntimePlan {
  return {
    ok: false,
    commandId,
    violations,
    publicCorePersists: false,
    createsExternalEffect: false,
  };
}

export function planWorkUnitRuntimeEvent(input: {
  readonly workUnit: unknown;
  readonly event: unknown;
}): WorkUnitRuntimePlan {
  const workUnit = helmWorkUnitSchema.parse(input.workUnit);
  const event = workUnitRuntimeEventSchema.parse(input.event);
  const readout = buildWorkUnitRuntimeReadout(workUnit);
  const selectedCommand = readout.commands.find(
    (candidate) => candidate.commandId === event.commandId,
  );

  if (!selectedCommand) {
    return blockedPlan(event.commandId, [
      { rule: "runtime-command-unknown", detail: event.commandId },
    ]);
  }

  const violations: WorkUnitViolation[] = [];
  if (!selectedCommand.enabled) {
    violations.push(
      ...selectedCommand.blockedBy.map((rule) => ({
        rule,
        detail: event.commandId,
      })),
    );
  }
  if (selectedCommand.requiresHumanOwner && !isHumanOwnerActor(event.actor)) {
    violations.push({
      rule: "human-owner-runtime-command-required",
      detail: `${event.commandId} cannot be planned by ${event.actor.actorType}`,
    });
  }
  if (violations.length > 0) {
    return blockedPlan(event.commandId, violations);
  }

  const snapshotHash = computeWorkUnitSnapshotHash(workUnit);
  switch (event.commandId) {
    case "accept_candidate":
      return {
        ok: true,
        commandId: event.commandId,
        plannedState: {
          status: "accepted_by_human",
          decision: buildDecision(workUnit, event, "accepted"),
          decisionSnapshotHash: snapshotHash,
          updatedAt: event.at,
        },
        publicCorePersists: false,
        createsExternalEffect: false,
        auditNote: "Owner acceptance plan only; persistence belongs to the private owner plane.",
      };
    case "request_changes":
      return {
        ok: true,
        commandId: event.commandId,
        plannedState: {
          status: "changes_requested",
          decision: buildDecision(workUnit, event, "changes_requested"),
          decisionSnapshotHash: snapshotHash,
          updatedAt: event.at,
        },
        publicCorePersists: false,
        createsExternalEffect: false,
        auditNote: "Change request plan only; repair returns as a new candidate.",
      };
    case "reject_candidate":
      return {
        ok: true,
        commandId: event.commandId,
        plannedState: {
          status: "rejected_by_human",
          decision: buildDecision(workUnit, event, "rejected"),
          decisionSnapshotHash: snapshotHash,
          updatedAt: event.at,
        },
        publicCorePersists: false,
        createsExternalEffect: false,
        auditNote: "Rejection plan only; no external effect.",
      };
    case "record_mainline":
      return {
        ok: true,
        commandId: event.commandId,
        plannedState: {
          status: "promoted_to_mainline",
          mergeReceipt: buildReceipt(workUnit, event, "planned-mainline-receipt"),
          updatedAt: event.at,
        },
        publicCorePersists: false,
        createsExternalEffect: false,
        auditNote: "Mainline record plan only; Public Core does not store private truth.",
      };
    case "request_activation":
      return {
        ok: true,
        commandId: event.commandId,
        plannedState: {
          status: "activation_requested",
          updatedAt: event.at,
        },
        publicCorePersists: false,
        createsExternalEffect: false,
        auditNote: "Activation request plan only; activation needs a separate private receipt.",
      };
    case "record_activation":
    default:
      return blockedPlan(event.commandId, [
        { rule: "public-core-does-not-activate", detail: event.commandId },
      ]);
  }
}

function isProjectionEntryState(
  state: WorkUnitState,
): state is PrivateMainlineProjectionEntry["state"] {
  return MAINLINE_ENTRY_STATES.has(state);
}

export function buildPrivateMainlineProjection(input: readonly unknown[]): PrivateMainlineProjection {
  const entries = input.flatMap((item): PrivateMainlineProjectionEntry[] => {
    const workUnit = helmWorkUnitSchema.parse(item);
    if (!isProjectionEntryState(workUnit.status)) return [];
    if (validateWorkUnitWithinPublicCore(workUnit).length > 0) return [];

    return [
      {
        entryId: `mainline-entry:${workUnit.id}:${workUnit.status}`,
        workUnitId: workUnit.id,
        state: workUnit.status,
        snapshotHash: computeWorkUnitSnapshotHash(workUnit),
        conflictKeys: workUnit.conflictKeys,
        auditRefs: workUnit.auditRefs,
        publicCoreCarriesRealInstance: false,
      },
    ];
  });
  const effective = new Map<string, string>();

  for (const entry of entries) {
    if (entry.state !== "promoted_to_mainline" && entry.state !== "activated_by_human") {
      continue;
    }
    for (const conflictKey of entry.conflictKeys) {
      effective.set(conflictKey, entry.entryId);
    }
  }

  return {
    projectionKind: "public_core_private_mainline_shape",
    publicCoreCarriesRealInstance: false,
    entries,
    effectiveByConflictKey: [...effective.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([conflictKey, entryId]) => ({ conflictKey, entryId })),
  };
}
