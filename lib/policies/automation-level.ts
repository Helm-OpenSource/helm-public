import { ActionExecutionMode } from "@prisma/client";
import type { HelmV2ApprovalRule } from "@/lib/helm-v2/approval-matrix";

// ---------------------------------------------------------------------------
// Canonical automation-level vocabulary (naming / projection layer ONLY).
//
// The repository grew several parallel vocabularies for "how automated is this
// action": ActionExecutionMode (policy engine), HelmV2ApprovalTier A0-A4
// (approval matrix), shadow_* fields, LimitedAutoEligibility, observe_only
// trace postures. This module gives them ONE authoritative ladder —
//
//   observer -> shadow -> active
//
// — matching the operating narrative that a problem class climbs the ladder
// only on evidence. This module deliberately changes NO runtime behavior:
// it is a pure projection so reports, pricing narratives, and future gates
// can talk about one axis. Enforcement stays where it already lives
// (policy engine, approval matrix, boundary guards).
// ---------------------------------------------------------------------------

export const AUTOMATION_LEVELS = ["observer", "shadow", "active"] as const;

export type AutomationLevel = (typeof AUTOMATION_LEVELS)[number];

export type AutomationLevelResolution = {
  level: AutomationLevel;
  // blocked = the action class is currently not runnable at all (forbidden by
  // policy, or not enabled for the pilot). The ladder position is then the
  // HIGHEST level the class could occupy if unblocked — which is observer.
  blocked: boolean;
  source: "action_execution_mode" | "helm_v2_approval_rule";
  reason: string;
};

// Projection from the light-chain policy engine's per-action execution mode.
export function resolveAutomationLevelFromExecutionMode(
  mode: ActionExecutionMode,
): AutomationLevelResolution {
  switch (mode) {
    case ActionExecutionMode.SUGGEST_ONLY:
      return {
        level: "observer",
        blocked: false,
        source: "action_execution_mode",
        reason: "suggestions only; nothing executes",
      };
    case ActionExecutionMode.REQUIRES_APPROVAL:
      return {
        level: "shadow",
        blocked: false,
        source: "action_execution_mode",
        reason: "system prepares the action; a human gate decides",
      };
    case ActionExecutionMode.AUTO_WITHIN_THRESHOLD:
      return {
        level: "active",
        blocked: false,
        source: "action_execution_mode",
        reason: "executes automatically within the configured threshold",
      };
    case ActionExecutionMode.FORBIDDEN:
      return {
        level: "observer",
        blocked: true,
        source: "action_execution_mode",
        reason: "forbidden by policy; not runnable",
      };
  }
}

// Projection from the helm-v2 declarative approval matrix (A0-A4).
// A0 has no human gate -> active. A1 writes only drafts / shadow objects ->
// shadow. A2-A4 all keep a human between intent and effect -> shadow.
// pilotEnabled=false means the class is not runnable in the pilot -> blocked.
export function resolveAutomationLevelFromApprovalRule(
  rule: HelmV2ApprovalRule,
): AutomationLevelResolution {
  if (!rule.pilotEnabled) {
    return {
      level: "observer",
      blocked: true,
      source: "helm_v2_approval_rule",
      reason: `${rule.action} is not pilot-enabled`,
    };
  }
  if (rule.tier === "A0") {
    return {
      level: "active",
      blocked: false,
      source: "helm_v2_approval_rule",
      reason: `${rule.action} runs without a human gate (A0)`,
    };
  }
  return {
    level: "shadow",
    blocked: false,
    source: "helm_v2_approval_rule",
    reason: `${rule.action} keeps a human between intent and effect (${rule.tier})`,
  };
}

export function compareAutomationLevels(a: AutomationLevel, b: AutomationLevel): number {
  return AUTOMATION_LEVELS.indexOf(a) - AUTOMATION_LEVELS.indexOf(b);
}
