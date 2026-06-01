export type AgentChipTone = "sky" | "violet" | "amber" | "emerald";

export type AgentTag = {
  label: string;
  tone: AgentChipTone;
};

export type AgentAuthorityState =
  | "helm-prepared"
  | "user-reviewed"
  | "user-backed";

export type AgentAttentionState =
  | "watching"
  | "pushing"
  | "waiting"
  | "blocked"
  | "review-before-send";

export type AgentPolicyCue =
  | "advisory-only"
  | "internal-only"
  | "approval-required"
  | "internal-execution-allowed"
  | "external-send-disabled"
  | "commitment-disabled";

export type AgentSurfaceSections = {
  recentChangesLabel?: string;
  recentChangesItems?: string[];
  resurfaceReasonLabel?: string;
  resurfaceReasonItems?: string[];
  policyLabel?: string;
  policyItems?: string[];
  progressTraceLabel?: string;
  progressTraceItems?: string[];
};

// Baseline authority: docs/product/SHARED_AGENT_PRIMITIVES_BASELINE_V1.md
// Shared agent primitives stay surface-agnostic. They are not a canonical shared agent root object, and they do not add workflow, send, or commitment authority by themselves.
export function formatAgentAuthorityState(
  state: AgentAuthorityState,
  english: boolean,
) {
  switch (state) {
    case "user-reviewed":
      return english ? "User reviewed" : "用户已复核";
    case "user-backed":
      return english ? "User backed" : "用户已 backing";
    default:
      return english ? "Prepared" : "已准备";
  }
}

export function toneForAgentAuthorityState(
  state: AgentAuthorityState,
): AgentChipTone {
  switch (state) {
    case "user-backed":
      return "emerald";
    case "user-reviewed":
      return "violet";
    default:
      return "sky";
  }
}

export function formatAgentAttentionState(
  state: AgentAttentionState,
  english: boolean,
) {
  switch (state) {
    case "pushing":
      return english ? "Pushing" : "推进中";
    case "waiting":
      return english ? "Waiting" : "等待中";
    case "blocked":
      return english ? "Blocked" : "受阻";
    case "review-before-send":
      return english ? "Review before send" : "发送前复核";
    default:
      return english ? "Watching" : "关注中";
  }
}

export function toneForAgentAttentionState(
  state: AgentAttentionState,
): AgentChipTone {
  switch (state) {
    case "pushing":
      return "emerald";
    case "waiting":
      return "violet";
    case "blocked":
    case "review-before-send":
      return "amber";
    default:
      return "sky";
  }
}

export function formatAgentPolicyCue(cue: AgentPolicyCue, english: boolean) {
  switch (cue) {
    case "internal-only":
      return english ? "Internal only" : "仅限内部";
    case "approval-required":
      return english ? "Requires your approval" : "需要你批准";
    case "internal-execution-allowed":
      return english ? "Internal execution allowed" : "允许内部执行";
    case "external-send-disabled":
      return english ? "External send disabled" : "禁止外部发送";
    case "commitment-disabled":
      return english ? "Commitment disabled" : "禁止承诺";
    default:
      return english ? "Advisory only" : "仅 advisory";
  }
}

export function toneForAgentPolicyCue(cue: AgentPolicyCue): AgentChipTone {
  switch (cue) {
    case "internal-execution-allowed":
      return "emerald";
    case "approval-required":
      return "amber";
    case "external-send-disabled":
    case "internal-only":
      return "violet";
    default:
      return "sky";
  }
}

export function buildAgentPolicyTag(
  cue: AgentPolicyCue,
  english: boolean,
): AgentTag {
  return {
    label: formatAgentPolicyCue(cue, english),
    tone: toneForAgentPolicyCue(cue),
  };
}
