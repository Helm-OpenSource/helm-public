/**
 * Helm External Agent Intake — Provider Registry (Phase 1, fixture-backed)
 *
 * Pure types and read-only registry describing provider capability and risk.
 * Does not execute provider calls, store credentials, or grant Helm-side
 * authority. See docs/product/HELM_EXTERNAL_AGENT_INTAKE_PRD.md §5–§6.
 */

export type ProviderKind =
  | "model_provider"
  | "external_agent_delegate"
  | "bounded_worker_runtime"
  | "tool_adapter"
  | "retrieval_provider"
  | "source_record_adapter";

export type EffectMode =
  | "read_only"
  | "draft_only"
  | "reviewed_write"
  | "side_effecting"
  | "unknown";

export type TrustTier = "high" | "medium" | "low" | "untrusted";

export type ProviderCapability =
  | "generate"
  | "retrieve"
  | "analyze"
  | "draft"
  | "tool_call"
  | "workflow_run"
  | "agent_run"
  | "source_read"
  | "write_candidate";

export type DataResidency = "local" | "china" | "cross_border" | "unknown";

export type Auditability =
  | "full_trace"
  | "partial_trace"
  | "receipt_only"
  | "opaque";

export type Replayability =
  | "deterministic_replay"
  | "best_effort_replay"
  | "not_replayable";

export type TenantIsolation =
  | "workspace_scoped"
  | "provider_project_scoped"
  | "shared"
  | "unknown";

export interface ProviderCapabilityProfile {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerKind: ProviderKind;
  readonly supportedCapabilities: readonly ProviderCapability[];
  readonly maxEffectMode: EffectMode;
  readonly dataResidency: DataResidency;
  readonly auditability: Auditability;
  readonly replayability: Replayability;
  readonly tenantIsolation: TenantIsolation;
  readonly humanReviewNative: boolean;
  readonly supportsRedaction: boolean;
  readonly supportsOutputSchema: boolean;
  readonly defaultTrustTier: TrustTier;
  readonly prohibitedUses: readonly string[];
}

const COMMON_PROHIBITED_USES = [
  "create_must_push_directly",
  "write_memory_directly",
  "send_customer_message",
  "official_write",
] as const;

/**
 * Deterministic order: coze_manual, openclaw_local, dify_manual.
 * Matches the founder-approved first-batch order in the PRD.
 */
export const EXTERNAL_AGENT_PROVIDER_PROFILES: readonly ProviderCapabilityProfile[] = [
  {
    providerId: "coze_manual",
    providerName: "Coze (扣子) — manual import",
    providerKind: "external_agent_delegate",
    supportedCapabilities: ["generate", "analyze", "draft", "workflow_run"],
    maxEffectMode: "draft_only",
    dataResidency: "unknown",
    auditability: "partial_trace",
    replayability: "not_replayable",
    tenantIsolation: "provider_project_scoped",
    humanReviewNative: true,
    supportsRedaction: false,
    supportsOutputSchema: true,
    defaultTrustTier: "low",
    prohibitedUses: [
      ...COMMON_PROHIBITED_USES,
      "crm_official_write",
      "treat_provider_confidence_as_helm_confidence",
    ],
  },
  {
    providerId: "openclaw_local",
    providerName: "OpenClaw — local artifact import",
    providerKind: "bounded_worker_runtime",
    supportedCapabilities: [
      "generate",
      "retrieve",
      "analyze",
      "draft",
      "tool_call",
      "agent_run",
    ],
    maxEffectMode: "draft_only",
    dataResidency: "local",
    auditability: "partial_trace",
    replayability: "best_effort_replay",
    tenantIsolation: "unknown",
    humanReviewNative: false,
    supportsRedaction: false,
    supportsOutputSchema: false,
    defaultTrustTier: "medium",
    prohibitedUses: [
      ...COMMON_PROHIBITED_USES,
      "act_as_multi_tenant_security_boundary",
      "treat_tool_receipt_as_official_write_success",
    ],
  },
  {
    providerId: "dify_manual",
    providerName: "Dify — workflow output manual import",
    providerKind: "external_agent_delegate",
    supportedCapabilities: ["retrieve", "analyze", "draft", "workflow_run", "tool_call"],
    maxEffectMode: "draft_only",
    dataResidency: "unknown",
    auditability: "partial_trace",
    replayability: "best_effort_replay",
    tenantIsolation: "provider_project_scoped",
    humanReviewNative: true,
    supportsRedaction: false,
    supportsOutputSchema: true,
    defaultTrustTier: "low",
    prohibitedUses: [
      ...COMMON_PROHIBITED_USES,
      "treat_tool_receipt_as_business_truth",
      "treat_workflow_trace_as_business_outcome",
    ],
  },
] as const;

export const KNOWN_EXTERNAL_AGENT_PROVIDER_IDS: readonly string[] =
  EXTERNAL_AGENT_PROVIDER_PROFILES.map((profile) => profile.providerId);

export function listProviderProfiles(): readonly ProviderCapabilityProfile[] {
  return EXTERNAL_AGENT_PROVIDER_PROFILES;
}

export function getExternalAgentProviderProfile(
  providerId: string,
): ProviderCapabilityProfile | null {
  return (
    EXTERNAL_AGENT_PROVIDER_PROFILES.find(
      (profile) => profile.providerId === providerId,
    ) ?? null
  );
}

export function isKnownExternalAgentProvider(providerId: string): boolean {
  return KNOWN_EXTERNAL_AGENT_PROVIDER_IDS.includes(providerId);
}

export function isDraftCapableProvider(
  profile: ProviderCapabilityProfile,
): boolean {
  return (
    profile.supportedCapabilities.includes("draft") &&
    profile.maxEffectMode !== "read_only" &&
    profile.maxEffectMode !== "side_effecting"
  );
}
