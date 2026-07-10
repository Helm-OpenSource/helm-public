import type {
  HelmV21PersistedPayload,
  HelmV21PromptBudgetDecision,
  HelmV21VerificationDecision,
  HelmV2SourceType,
} from "@/lib/helm-v2/contracts";
import { trimText } from "@/lib/utils";

export const DEFAULT_TOKEN_BUDGET = 6000;

export type PersistedPayloadDraft = {
  payloadKey: string;
  sourceType: HelmV2SourceType | "artifact" | "session_notebook" | "signal_event";
  sourceId: string;
  label: string;
  loadPolicy: HelmV21PersistedPayload["loadPolicy"];
  text: string;
  loadedByDefault: boolean;
};

type VerificationInput = {
  facts: Array<{ title?: string; content?: string; evidence?: string[] }>;
  inferredCount: number;
  riskFlags: Array<{
    severity?: "low" | "medium" | "high";
    promiseRisk?: boolean;
    reason?: string;
  }>;
  promotedMemoryCount: number;
};

export function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function buildPersistedPayloadDraft(input: {
  key: string;
  sourceType: PersistedPayloadDraft["sourceType"];
  sourceId: string;
  label: string;
  loadPolicy: PersistedPayloadDraft["loadPolicy"];
  text: string;
  loadedByDefault: boolean;
}): PersistedPayloadDraft | null {
  const normalized = trimText(input.text, 24000).trim();
  if (!normalized) return null;

  return {
    payloadKey: input.key,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    label: input.label,
    loadPolicy: input.loadPolicy,
    text: normalized,
    loadedByDefault: input.loadedByDefault,
  };
}

export function toPersistedPayloadContract(
  draft: PersistedPayloadDraft,
): HelmV21PersistedPayload {
  return {
    payloadKey: draft.payloadKey,
    handle: `payload://${draft.sourceType}/${draft.sourceId}/${draft.payloadKey}`,
    sourceType: draft.sourceType,
    sourceId: draft.sourceId,
    label: draft.label,
    loadPolicy: draft.loadPolicy,
    preview: trimText(draft.text, 320),
    summary: trimText(draft.text.replace(/\s+/g, " "), 160),
    byteSize: Buffer.byteLength(draft.text, "utf8"),
    estimatedTokens: estimateTokenCount(draft.text),
    loadedByDefault: draft.loadedByDefault,
  };
}

export function selectPayloadsForBudget(
  payloads: HelmV21PersistedPayload[],
  tokenBudgetLimit = DEFAULT_TOKEN_BUDGET,
): HelmV21PromptBudgetDecision {
  const weight = {
    always_on: 0,
    stage_triggered: 1,
    on_demand: 2,
    never_auto_load: 3,
  } as const;

  const ordered = [...payloads].sort((left, right) => {
    const weightDelta = weight[left.loadPolicy] - weight[right.loadPolicy];
    if (weightDelta !== 0) return weightDelta;
    if (left.loadedByDefault !== right.loadedByDefault) {
      return left.loadedByDefault ? -1 : 1;
    }
    return left.estimatedTokens - right.estimatedTokens;
  });

  const loadedHandles: string[] = [];
  const prunedHandles: string[] = [];
  let used = 0;

  for (const payload of ordered) {
    const shouldAttemptLoad =
      payload.loadPolicy !== "never_auto_load" &&
      (payload.loadedByDefault || payload.loadPolicy !== "on_demand");
    if (!shouldAttemptLoad) {
      prunedHandles.push(payload.handle);
      continue;
    }

    if (used + payload.estimatedTokens <= tokenBudgetLimit) {
      used += payload.estimatedTokens;
      loadedHandles.push(payload.handle);
      continue;
    }

    prunedHandles.push(payload.handle);
  }

  return {
    tokenBudgetLimit,
    tokenBudgetUsed: used,
    prunedTokenCount: Math.max(
      0,
      payloads.reduce((sum, item) => sum + item.estimatedTokens, 0) - used,
    ),
    loadedHandles,
    prunedHandles,
    reasoning:
      "Budget governor keeps always_on and stage_triggered context first, prunes overflow into traceable handles, and does not silently auto-load never_auto_load sources.",
  };
}

export function buildVerificationDecision(
  input: VerificationInput,
): HelmV21VerificationDecision {
  const missingEvidence = input.facts.filter(
    (fact) => (fact.evidence?.length ?? 0) === 0,
  ).length;
  const promiseRiskCount = input.riskFlags.filter(
    (item) => item.promiseRisk || item.severity === "high",
  ).length;
  const evidenceCoverage =
    input.facts.length === 0
      ? 0
      : Math.round(
          ((input.facts.length - missingEvidence) / input.facts.length) * 100,
        );
  const truthScore = Math.max(
    0,
    Math.min(
      100,
      evidenceCoverage -
        promiseRiskCount * 15 -
        Math.max(0, input.inferredCount - input.promotedMemoryCount) * 5,
    ),
  );

  const blockedReasons: string[] = [];
  if (missingEvidence > 0) {
    blockedReasons.push(
      `${missingEvidence} confirmed facts are still missing evidence refs.`,
    );
  }
  if (promiseRiskCount > 0) {
    blockedReasons.push(
      `${promiseRiskCount} promise-sensitive or high-severity risk items still require explicit boundary review.`,
    );
  }

  const status =
    blockedReasons.length === 0
      ? "passed"
      : promiseRiskCount > 0
        ? "blocked"
        : "needs_review";

  return {
    status,
    truthScore,
    summary:
      status === "passed"
        ? "Verification passed: confirmed facts stay source-grounded enough for promotion and downstream review."
        : status === "blocked"
          ? "Verification blocked direct trust upgrade: promise-sensitive or conflict-prone signals still need explicit operator attention."
          : "Verification requires review: some confirmed facts still lack enough grounding for silent promotion.",
    blockedReasons,
    boundaryNotes: [
      "Verification is a runtime review layer, not autonomous decision authority.",
      "Risky or promise-sensitive content remains approval-gated and non-commitment by default.",
    ],
  };
}
