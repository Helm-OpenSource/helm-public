import type {
  GrowthDecision,
  IntelligenceDimension,
  NoGoBoundary,
} from "./types";

// ── Required no-go boundaries for every dimension ────────────────────────────

const REQUIRED_NO_GO_BOUNDARIES: readonly NoGoBoundary[] = [
  "no_db_schema",
  "no_api",
  "no_ui",
  "no_production_prompt_change",
  "no_runtime_self_learning",
];

// ── Allowed decisions (no auto-promotion values) ──────────────────────────────

const ALLOWED_DECISIONS: readonly GrowthDecision[] = [
  "learning_candidate",
  "watch_only",
  "review_required",
  "rejected",
];

// ── Dimension descriptor type ─────────────────────────────────────────────────

export type IntelligenceGrowthDimensionDescriptor = {
  readonly id: IntelligenceDimension;
  readonly label: string;
  readonly goal: string;
  readonly allowedDecisions: readonly GrowthDecision[];
  readonly noGoBoundaries: readonly NoGoBoundary[];
};

// ── Descriptor registry ───────────────────────────────────────────────────────

export const INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS: readonly IntelligenceGrowthDimensionDescriptor[] =
  [
    {
      id: "context",
      label: "Context Intelligence",
      goal: "Ensure LLM call context quality is auditable and improvable via offline measurement.",
      allowedDecisions: ALLOWED_DECISIONS,
      noGoBoundaries: REQUIRED_NO_GO_BOUNDARIES,
    },
    {
      id: "object_signal",
      label: "Object/Signal Intelligence",
      goal: "Continuously improve business object validity gate coverage and precision.",
      allowedDecisions: ALLOWED_DECISIONS,
      noGoBoundaries: REQUIRED_NO_GO_BOUNDARIES,
    },
    {
      id: "memory",
      label: "Company Memory Intelligence",
      goal: "Make memory write quality, deduplication quality, and promotion path measurable and improvable.",
      allowedDecisions: ALLOWED_DECISIONS,
      noGoBoundaries: REQUIRED_NO_GO_BOUNDARIES,
    },
    {
      id: "routing",
      label: "Routing Intelligence",
      goal: "Make Must Push / review / watch routing decision quality measurable and improvable.",
      allowedDecisions: ALLOWED_DECISIONS,
      noGoBoundaries: REQUIRED_NO_GO_BOUNDARIES,
    },
    {
      id: "action_outcome",
      label: "Action/Outcome Intelligence",
      goal: "Make the relationship between Helm recommended actions and real business outcomes measurable.",
      allowedDecisions: ALLOWED_DECISIONS,
      noGoBoundaries: REQUIRED_NO_GO_BOUNDARIES,
    },
    {
      id: "worker_skill",
      label: "Worker/Skill Intelligence",
      goal: "Make Worker artifact quality and Skill invocation quality measurable and improvable.",
      allowedDecisions: ALLOWED_DECISIONS,
      noGoBoundaries: REQUIRED_NO_GO_BOUNDARIES,
    },
    {
      id: "prompt_policy",
      label: "Prompt/Policy Intelligence",
      goal: "Make prompt design quality and policy rule quality measurable while remaining review-first.",
      allowedDecisions: ALLOWED_DECISIONS,
      noGoBoundaries: REQUIRED_NO_GO_BOUNDARIES,
    },
    {
      id: "eval_replay",
      label: "Eval/Replay Intelligence",
      goal: "Make eval framework coverage, replayability, and failure detection measurable and improvable.",
      allowedDecisions: ALLOWED_DECISIONS,
      noGoBoundaries: REQUIRED_NO_GO_BOUNDARIES,
    },
    {
      id: "tenant_personalization",
      label: "Tenant Personalization Intelligence",
      goal: "Make per-tenant Helm judgment quality measurable by tenant usage pattern while keeping workspace-first isolation.",
      allowedDecisions: ALLOWED_DECISIONS,
      noGoBoundaries: REQUIRED_NO_GO_BOUNDARIES,
    },
    {
      id: "cost_model_tool",
      label: "Cost/Model/Tool Intelligence",
      goal: "Make LLM call cost, model selection quality, and tool invocation quality measurable and improvable.",
      allowedDecisions: ALLOWED_DECISIONS,
      noGoBoundaries: REQUIRED_NO_GO_BOUNDARIES,
    },
  ];

// ── Lookup helper ─────────────────────────────────────────────────────────────

export function getIntelligenceGrowthDimensionDescriptor(
  id: IntelligenceDimension,
): IntelligenceGrowthDimensionDescriptor {
  const descriptor = INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS.find(
    (d) => d.id === id,
  );
  if (!descriptor) {
    throw new Error(
      `[IGS] No descriptor found for dimension "${id}". This is a contract violation.`,
    );
  }
  return descriptor;
}

// ── Runtime guard: rejects any value that would imply auto-promotion ──────────

const UNSAFE_PROMOTING_VALUES = new Set([
  "approved",
  "auto_promote",
  "production_ready",
  "active",
  "promoted",
]);

export function assertGrowthDecisionIsNonPromoting(
  decision: GrowthDecision,
): GrowthDecision {
  if (UNSAFE_PROMOTING_VALUES.has(decision as string)) {
    throw new Error(
      `[IGS] Growth decision "${decision}" implies auto-promotion, which is not allowed. ` +
        `Only "learning_candidate", "watch_only", "review_required", or "rejected" are permitted.`,
    );
  }
  return decision;
}
