/**
 * Helm Business Advancement — self-tenant minimal-live usage gate.
 *
 * Pure decision aggregator that authorizes ONLY minimal-live usage of the
 * standard review-first product surfaces inside Helm's own internal workspace
 * (Helm as tenant zero): manually entering Helm's real internal operating
 * events through the same surfaces any workspace member would use.
 *
 * It does NOT change the disabled internal dogfood ladder. Production query
 * adoption, runtime detector integration, and public trial stay No-Go and keep
 * their own gates. It is NOT a runtime adapter, NOT a DB reader, NOT an API,
 * NOT a page integration, NOT a schema change, NOT an official write path,
 * and NOT automated execution authority.
 */

import {
  POSITIVE_FOUNDER_INTERNAL_GATE_INPUT,
  evaluateFounderInternalGate,
  type FounderInternalGateResult,
} from "./founder-internal-gate";

export const SELF_TENANT_MINIMAL_LIVE_GATE_RULE_VERSION =
  "business-advancement-self-tenant-minimal-live-gate/v1" as const;

export const SELF_TENANT_MINIMAL_LIVE_GATE_POSTURE =
  "Self-Tenant-Standard-Surface-Usage-Only" as const;

/**
 * The dogfood detector ladder (TPQR families -> production query adoption)
 * is a separate axis and stays No-Go regardless of this gate's decision.
 */
export const SELF_TENANT_MINIMAL_LIVE_DETECTOR_RUNTIME_ADOPTION =
  "No-Go" as const;

export const SELF_TENANT_MINIMAL_LIVE_APPROVED_SCOPE =
  "Self-Tenant-Minimal-Live-Standard-Surface-Usage" as const;

export const SELF_TENANT_EVENT_CLASSES = [
  "lead_or_customer_contact",
  "poc_or_project_advancement",
  "work_assignment_and_acceptance",
  "builder_backlog",
] as const;

export type SelfTenantEventClass = (typeof SELF_TENANT_EVENT_CLASSES)[number];

export type SelfTenantMinimalLiveDecision =
  | "Go-For-Self-Tenant-Minimal-Live-Usage"
  | "Blocked";

export interface SelfTenantFounderDecisionEvidence {
  readonly founderApproved: boolean;
  readonly approverRole: "Founder" | "Owner";
  readonly decisionPacketPath: string;
  readonly approvedAtIso: string;
  readonly approvedScope: string;
  readonly evidenceNotes: string;
}

export interface SelfTenantUsageScopeProof {
  readonly standardReviewFirstSurfacesOnly: boolean;
  readonly approvedEventClasses: readonly SelfTenantEventClass[];
  readonly noNewProductionQueryAdoption: boolean;
  readonly noSchemaChange: boolean;
  readonly noNewRouteAuthority: boolean;
  readonly noAutoSendWriteApprovePayExecute: boolean;
  readonly workspaceIsolatedFromSyntheticDemo: boolean;
  readonly realDataStaysOutOfPublicRepo: boolean;
  readonly rollbackOwnerUserId: string;
}

export interface SelfTenantMinimalLiveGateInput {
  readonly founderDecision: SelfTenantFounderDecisionEvidence;
  readonly usageScope: SelfTenantUsageScopeProof;
  readonly founderInternalGate: FounderInternalGateResult;
}

export interface SelfTenantMinimalLiveGateCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly blocker?: string;
}

export interface SelfTenantMinimalLiveGatePacket {
  readonly ruleVersion: typeof SELF_TENANT_MINIMAL_LIVE_GATE_RULE_VERSION;
  readonly posture: typeof SELF_TENANT_MINIMAL_LIVE_GATE_POSTURE;
  readonly detectorRuntimeAdoption: typeof SELF_TENANT_MINIMAL_LIVE_DETECTOR_RUNTIME_ADOPTION;
  readonly decision: SelfTenantMinimalLiveDecision;
  readonly productionQueryAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly publicTrialAllowed: false;
  readonly approvedEventClasses: readonly SelfTenantEventClass[];
  readonly founderDecision: SelfTenantFounderDecisionEvidence;
  readonly checks: readonly SelfTenantMinimalLiveGateCheck[];
  readonly blockers: readonly string[];
  readonly allowedNextStep: string;
  readonly forbiddenWork: readonly string[];
}

export const SELF_TENANT_MINIMAL_LIVE_FORBIDDEN_WORK = [
  "Do not modify data/queries.ts",
  "Do not add or modify Prisma schema or migrations",
  "Do not add app route or API route authority",
  "Do not enable production query adoption for dogfood detector families",
  "Do not enable runtime detector integration or public trial",
  "Do not create official write, auto-send, auto-approve, auto-pay, auto-execute, or auto-commit authority",
  "Do not put real internal business data, real names, or operating receipts into the public repository",
  "Do not mix self-tenant workspace data into synthetic demo fixtures or public screenshots",
] as const;

export const DEFAULT_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT: SelfTenantMinimalLiveGateInput =
  {
    founderDecision: {
      founderApproved: false,
      approverRole: "Founder",
      decisionPacketPath: "",
      approvedAtIso: "",
      approvedScope: "",
      evidenceNotes: "",
    },
    usageScope: {
      standardReviewFirstSurfacesOnly: false,
      approvedEventClasses: [],
      noNewProductionQueryAdoption: false,
      noSchemaChange: false,
      noNewRouteAuthority: false,
      noAutoSendWriteApprovePayExecute: false,
      workspaceIsolatedFromSyntheticDemo: false,
      realDataStaysOutOfPublicRepo: false,
      rollbackOwnerUserId: "",
    },
    founderInternalGate: evaluateFounderInternalGate(
      POSITIVE_FOUNDER_INTERNAL_GATE_INPUT,
    ),
  };

export const POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT: SelfTenantMinimalLiveGateInput =
  {
    founderDecision: {
      founderApproved: true,
      approverRole: "Founder",
      decisionPacketPath:
        "docs/_planning/HELM_SELF_TENANT_MINIMAL_LIVE_FOUNDER_DECISION_2026-07-05.md",
      approvedAtIso: "2026-07-05T00:00:00.000Z",
      approvedScope: SELF_TENANT_MINIMAL_LIVE_APPROVED_SCOPE,
      evidenceNotes:
        "Founder approves minimal-live usage of standard review-first surfaces in Helm's own internal workspace for the four internal operating event classes. Dogfood detector production adoption, runtime integration, and public trial remain blocked.",
    },
    usageScope: {
      standardReviewFirstSurfacesOnly: true,
      approvedEventClasses: [...SELF_TENANT_EVENT_CLASSES],
      noNewProductionQueryAdoption: true,
      noSchemaChange: true,
      noNewRouteAuthority: true,
      noAutoSendWriteApprovePayExecute: true,
      workspaceIsolatedFromSyntheticDemo: true,
      realDataStaysOutOfPublicRepo: true,
      rollbackOwnerUserId: "founder",
    },
    founderInternalGate: evaluateFounderInternalGate(
      POSITIVE_FOUNDER_INTERNAL_GATE_INPUT,
    ),
  };

export function evaluateSelfTenantMinimalLiveGate(
  input: SelfTenantMinimalLiveGateInput = DEFAULT_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT,
): SelfTenantMinimalLiveGatePacket {
  const checks = buildChecks(input);
  const blockers = checks.flatMap((check) =>
    check.pass || !check.blocker ? [] : [check.blocker],
  );
  const decision: SelfTenantMinimalLiveDecision =
    blockers.length === 0 ? "Go-For-Self-Tenant-Minimal-Live-Usage" : "Blocked";

  return {
    ruleVersion: SELF_TENANT_MINIMAL_LIVE_GATE_RULE_VERSION,
    posture: SELF_TENANT_MINIMAL_LIVE_GATE_POSTURE,
    detectorRuntimeAdoption: SELF_TENANT_MINIMAL_LIVE_DETECTOR_RUNTIME_ADOPTION,
    decision,
    productionQueryAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    publicTrialAllowed: false,
    approvedEventClasses:
      decision === "Go-For-Self-Tenant-Minimal-Live-Usage"
        ? input.usageScope.approvedEventClasses
        : [],
    founderDecision: input.founderDecision,
    checks,
    blockers,
    allowedNextStep: buildAllowedNextStep(decision),
    forbiddenWork: [...SELF_TENANT_MINIMAL_LIVE_FORBIDDEN_WORK],
  };
}

function buildChecks(
  input: SelfTenantMinimalLiveGateInput,
): SelfTenantMinimalLiveGateCheck[] {
  return [
    checkFounderDecisionRecord(input.founderDecision),
    checkFounderInternalGate(input.founderInternalGate),
    checkUsageScope(input.usageScope),
  ];
}

function checkFounderDecisionRecord(
  record: SelfTenantFounderDecisionEvidence,
): SelfTenantMinimalLiveGateCheck {
  const strictIso = isStrictUtcIso(record.approvedAtIso);
  const pass =
    record.founderApproved &&
    record.decisionPacketPath.trim().length > 0 &&
    strictIso &&
    record.approvedScope === SELF_TENANT_MINIMAL_LIVE_APPROVED_SCOPE &&
    record.evidenceNotes.trim().length > 0;

  return {
    name: "founder_decision_record_complete",
    pass,
    detail: pass
      ? `Founder decision approved by ${record.approverRole} at ${record.approvedAtIso} for scope ${record.approvedScope}.`
      : `Founder decision incomplete: approved=${String(record.founderApproved)} path=${record.decisionPacketPath || "<missing>"} strictIso=${String(strictIso)} scope=${record.approvedScope || "<missing>"} notes=${String(record.evidenceNotes.trim().length > 0)}.`,
    blocker: pass
      ? undefined
      : "Founder decision record must approve the self-tenant minimal-live scope with strict UTC timestamp, packet path, and evidence notes.",
  };
}

function checkFounderInternalGate(
  gate: FounderInternalGateResult,
): SelfTenantMinimalLiveGateCheck {
  const pass =
    gate.decision === "Go-For-Disabled-Internal-Dogfooding" &&
    gate.blockers.length === 0 &&
    gate.productionQueryAdoptionAllowed === false &&
    gate.runtimeIntegrationAllowed === false &&
    gate.publicTrialAllowed === false;

  return {
    name: "founder_internal_gate_healthy",
    pass,
    detail: pass
      ? "Founder internal gate is Go for disabled internal dogfooding and keeps production/runtime/public trial blocked."
      : `Founder internal gate unhealthy: decision=${gate.decision}, blockers=${gate.blockers.length}, production=${String(gate.productionQueryAdoptionAllowed)}, runtimeIntegration=${String(gate.runtimeIntegrationAllowed)}, publicTrial=${String(gate.publicTrialAllowed)}.`,
    blocker: pass
      ? undefined
      : "Self-tenant minimal-live usage requires a healthy founder internal gate that still blocks production/runtime/public trial.",
  };
}

function checkUsageScope(
  scope: SelfTenantUsageScopeProof,
): SelfTenantMinimalLiveGateCheck {
  const knownClasses = scope.approvedEventClasses.every((eventClass) =>
    SELF_TENANT_EVENT_CLASSES.includes(eventClass),
  );
  const pass =
    scope.standardReviewFirstSurfacesOnly &&
    scope.approvedEventClasses.length > 0 &&
    knownClasses &&
    scope.noNewProductionQueryAdoption &&
    scope.noSchemaChange &&
    scope.noNewRouteAuthority &&
    scope.noAutoSendWriteApprovePayExecute &&
    scope.workspaceIsolatedFromSyntheticDemo &&
    scope.realDataStaysOutOfPublicRepo &&
    scope.rollbackOwnerUserId.trim().length > 0;

  return {
    name: "usage_scope_review_first_and_isolated",
    pass,
    detail: pass
      ? `Usage scope covers ${scope.approvedEventClasses.length} event class(es) through standard review-first surfaces with workspace isolation and rollback owner ${scope.rollbackOwnerUserId}.`
      : "Usage scope must be standard review-first surfaces only, name at least one known event class, keep query/schema/route/auto-execution changes out, isolate the workspace from synthetic demo data, keep real data out of the public repo, and name a rollback owner.",
    blocker: pass
      ? undefined
      : "Usage scope proof incomplete for self-tenant minimal-live usage.",
  };
}

function buildAllowedNextStep(decision: SelfTenantMinimalLiveDecision): string {
  switch (decision) {
    case "Go-For-Self-Tenant-Minimal-Live-Usage":
      return "Operate Helm's own internal workspace through standard review-first surfaces for the approved event classes only; keep dogfood detector production query adoption, runtime integration, public trial, official write, and auto-execution blocked.";
    case "Blocked":
      return "Resolve founder-decision, founder-internal-gate, or usage-scope blockers before any self-tenant minimal-live usage starts.";
  }
}

function isStrictUtcIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  return new Date(value).toISOString() === value;
}
