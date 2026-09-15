import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

/**
 * Pull-based on-premises inference contracts (CAIO P1). The queue, the governed deferred dispatch and the
 * device worker all speak these names; see docs/superpowers/plans/2026-09-16-caio-p1-master-plan.md.
 */
export const CAIO_INFERENCE_TASK_CLASSES = ["hourly_diagnosis", "daily_review"] as const;
export type CaioInferenceTaskClass = (typeof CAIO_INFERENCE_TASK_CLASSES)[number];

export const CAIO_INFERENCE_JOB_STATUSES = ["queued", "claimed", "completed", "rejected", "expired", "dead_letter"] as const;
export type CaioInferenceJobStatus = (typeof CAIO_INFERENCE_JOB_STATUSES)[number];

export const CAIO_INFERENCE_REJECTION_CODES = [
  "dispatch_claim_denied",
  "lease_expired",
  "claim_token_mismatch",
  "input_hash_mismatch",
  "malformed_output",
  "evidence_outside_input",
  "suggestion_kind_not_allowed",
  "action_disposition_present",
  "payload_too_large",
] as const;
export type CaioInferenceRejectionCode = (typeof CAIO_INFERENCE_REJECTION_CODES)[number];

export const CAIO_INFERENCE_INPUT_SCHEMA_VERSION = "helm.caio.inference-input.v1" as const;

export type CaioInferenceInput = {
  schemaVersion: typeof CAIO_INFERENCE_INPUT_SCHEMA_VERSION;
  workspaceId: string;
  taskClass: CaioInferenceTaskClass;
  windowStart: string;
  windowEnd: string;
  snapshotRefs: Array<{ snapshotId: string; snapshotHash: string }>;
  /** Union of every EvidenceRef inside the input snapshots; judgements may only cite these. */
  evidenceRefs: string[];
  supplements: Array<{ key: string; counts: Record<string, number | null> }>;
};

/** Route task class each inference task is admitted under by the tenant model route policy. */
export const CAIO_INFERENCE_ROUTE_TASK_CLASS: Readonly<Record<CaioInferenceTaskClass, "reasoning_counterfactual" | "summary_briefing">> = {
  hourly_diagnosis: "reasoning_counterfactual",
  daily_review: "summary_briefing",
};

export function computeCaioInferenceInputHash(input: CaioInferenceInput): string {
  return sha256(canonicalJson(input));
}
