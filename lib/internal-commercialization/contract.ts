import {
  InternalCommercializationChannelGateLevel,
  InternalCommercializationDecision,
  InternalCommercializationLifecycleState,
  InternalCommercializationOfferStage,
  InternalCommercializationProviderType,
  InternalCommercializationReviewSafeAction,
} from "@prisma/client";

export const INTERNAL_COMMERCIALIZATION_FIXTURE_CONNECTOR_ID =
  "internal-commercialization-fixture-connector";

export const INTERNAL_COMMERCIALIZATION_REVIEW_SAFE_ACTIONS = [
  "prepare_diagnosis_brief_for_review",
  "prepare_trial_scope_draft_for_review",
  "prepare_pilot_scope_packet_for_review",
  "prepare_closeout_report_candidate_for_review",
  "downgrade_or_pause",
] as const;

export const INTERNAL_COMMERCIALIZATION_OUTBOUND_ACTION_PATTERN =
  /^(send|book|publish|dispatch|write|trigger|request)_/;

const RAW_PII_PATTERNS = [
  // Fast tripwire only. The runtime schema remains alias-only, so this guard
  // catches obvious leaks before they reach JSON payload fields.
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?86[-\s]?)?1[3-9]\d{9}/,
];

const providerTypeByFixtureValue: Record<
  string,
  InternalCommercializationProviderType
> = {
  ai_service_provider: InternalCommercializationProviderType.AI_SERVICE_PROVIDER,
  ai_consulting_training: InternalCommercializationProviderType.AI_CONSULTING_TRAINING,
  agent_delivery_provider: InternalCommercializationProviderType.AGENT_DELIVERY_PROVIDER,
  content_only_kol: InternalCommercializationProviderType.CONTENT_ONLY_KOL,
  platform_builder_requester:
    InternalCommercializationProviderType.PLATFORM_BUILDER_REQUESTER,
};

const lifecycleStateByFixtureValue: Record<
  string,
  InternalCommercializationLifecycleState
> = {
  candidate_pool: InternalCommercializationLifecycleState.CANDIDATE_POOL,
  daily_top3_selected: InternalCommercializationLifecycleState.DAILY_TOP3_SELECTED,
  diagnosis_packet_prepared:
    InternalCommercializationLifecycleState.DIAGNOSIS_PACKET_PREPARED,
  diagnosis_reviewed: InternalCommercializationLifecycleState.DIAGNOSIS_REVIEWED,
  trial_scope_prepared:
    InternalCommercializationLifecycleState.TRIAL_SCOPE_PREPARED,
  trial_running: InternalCommercializationLifecycleState.TRIAL_RUNNING,
  trial_closeout_ready:
    InternalCommercializationLifecycleState.TRIAL_CLOSEOUT_READY,
  pilot_scope_prepared:
    InternalCommercializationLifecycleState.PILOT_SCOPE_PREPARED,
  pilot_running: InternalCommercializationLifecycleState.PILOT_RUNNING,
  pilot_closeout_ready:
    InternalCommercializationLifecycleState.PILOT_CLOSEOUT_READY,
  closeout_report_prepared:
    InternalCommercializationLifecycleState.CLOSEOUT_REPORT_PREPARED,
  channel_gate_assessed:
    InternalCommercializationLifecycleState.CHANNEL_GATE_ASSESSED,
  next_cycle_selected: InternalCommercializationLifecycleState.NEXT_CYCLE_SELECTED,
  data_boundary_review_required:
    InternalCommercializationLifecycleState.DATA_BOUNDARY_REVIEW_REQUIRED,
  paused: InternalCommercializationLifecycleState.PAUSED,
};

const decisionByFixtureValue: Record<string, InternalCommercializationDecision> = {
  prepare_diagnosis: InternalCommercializationDecision.PREPARE_DIAGNOSIS,
  prepare_trial: InternalCommercializationDecision.PREPARE_TRIAL,
  prepare_pilot: InternalCommercializationDecision.PREPARE_PILOT,
  prepare_closeout: InternalCommercializationDecision.PREPARE_CLOSEOUT,
  no_go: InternalCommercializationDecision.NO_GO,
  watch_only: InternalCommercializationDecision.WATCH_ONLY,
};

const offerStageByFixtureValue: Record<string, InternalCommercializationOfferStage> = {
  diagnosis_1h: InternalCommercializationOfferStage.DIAGNOSIS_1H,
  trial_7d: InternalCommercializationOfferStage.TRIAL_7D,
  pilot_4w: InternalCommercializationOfferStage.PILOT_4W,
  closeout_report: InternalCommercializationOfferStage.CLOSEOUT_REPORT,
};

const channelGateByFixtureValue: Record<
  string,
  InternalCommercializationChannelGateLevel
> = {
  L0: InternalCommercializationChannelGateLevel.L0,
  L1: InternalCommercializationChannelGateLevel.L1,
  L2: InternalCommercializationChannelGateLevel.L2,
  L3: InternalCommercializationChannelGateLevel.L3,
};

const reviewSafeActionByFixtureValue: Record<
  string,
  InternalCommercializationReviewSafeAction
> = {
  prepare_diagnosis_brief_for_review:
    InternalCommercializationReviewSafeAction.PREPARE_DIAGNOSIS_BRIEF_FOR_REVIEW,
  prepare_trial_scope_draft_for_review:
    InternalCommercializationReviewSafeAction.PREPARE_TRIAL_SCOPE_DRAFT_FOR_REVIEW,
  prepare_pilot_scope_packet_for_review:
    InternalCommercializationReviewSafeAction.PREPARE_PILOT_SCOPE_PACKET_FOR_REVIEW,
  prepare_closeout_report_candidate_for_review:
    InternalCommercializationReviewSafeAction.PREPARE_CLOSEOUT_REPORT_CANDIDATE_FOR_REVIEW,
  downgrade_or_pause:
    InternalCommercializationReviewSafeAction.DOWNGRADE_OR_PAUSE,
};

function lookupFixtureValue<T>(
  table: Record<string, T>,
  value: string,
  label: string,
) {
  const normalized = value.trim();
  const resolved = table[normalized];
  if (!resolved) {
    throw new Error(`Unknown internal commercialization ${label}: ${value}`);
  }
  return resolved;
}

export function normalizeInternalCommercializationProviderType(value: string) {
  return lookupFixtureValue(providerTypeByFixtureValue, value, "provider type");
}

export function normalizeInternalCommercializationLifecycleState(value: string) {
  return lookupFixtureValue(lifecycleStateByFixtureValue, value, "lifecycle state");
}

export function normalizeInternalCommercializationDecision(value: string) {
  return lookupFixtureValue(decisionByFixtureValue, value, "decision");
}

export function normalizeInternalCommercializationOfferStage(value: string | null) {
  if (!value) return null;
  return lookupFixtureValue(offerStageByFixtureValue, value, "offer stage");
}

export function normalizeInternalCommercializationChannelGateLevel(value: string) {
  return lookupFixtureValue(channelGateByFixtureValue, value, "channel gate level");
}

export function normalizeInternalCommercializationReviewSafeAction(action: string) {
  if (
    !INTERNAL_COMMERCIALIZATION_REVIEW_SAFE_ACTIONS.includes(
      action as (typeof INTERNAL_COMMERCIALIZATION_REVIEW_SAFE_ACTIONS)[number],
    ) ||
    INTERNAL_COMMERCIALIZATION_OUTBOUND_ACTION_PATTERN.test(action)
  ) {
    throw new Error(
      `Internal commercialization action is not review-safe: ${action}`,
    );
  }

  return lookupFixtureValue(
    reviewSafeActionByFixtureValue,
    action,
    "review-safe action",
  );
}

export function assertInternalCommercializationReviewSafeAction(action: string) {
  normalizeInternalCommercializationReviewSafeAction(action);
}

export function assertInternalCommercializationAliasOnly(
  value: unknown,
  label: string,
) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value ?? null);

  if (RAW_PII_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error(
      `Internal commercialization ${label} must stay alias-only and raw-PII-free.`,
    );
  }
}
