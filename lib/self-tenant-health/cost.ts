import type {
  TenantHealthBudgetState,
  TenantHealthCostBucket,
  TenantHealthLLMUsageInput,
} from "@/lib/self-tenant-health/types";

type CostProfile = {
  provider: string;
  model: string;
  promptMinorUnitPerMillionTokens: number;
  completionMinorUnitPerMillionTokens: number;
};

// Internal pilot estimates only. These values drive budget buckets and are not
// a provider billing statement.
const COST_PROFILES: CostProfile[] = [
  { provider: "qwen", model: "qwen3.6-plus", promptMinorUnitPerMillionTokens: 800, completionMinorUnitPerMillionTokens: 2400 },
  { provider: "qwen", model: "qwen3.6-flash", promptMinorUnitPerMillionTokens: 120, completionMinorUnitPerMillionTokens: 360 },
  { provider: "qwen", model: "qwen-plus-latest", promptMinorUnitPerMillionTokens: 800, completionMinorUnitPerMillionTokens: 2400 },
  { provider: "qwen", model: "qwen-turbo-latest", promptMinorUnitPerMillionTokens: 120, completionMinorUnitPerMillionTokens: 360 },
  { provider: "openai", model: "gpt-4.1-mini", promptMinorUnitPerMillionTokens: 300, completionMinorUnitPerMillionTokens: 1200 },
  { provider: "openai", model: "gpt-4.1", promptMinorUnitPerMillionTokens: 1500, completionMinorUnitPerMillionTokens: 6000 },
  { provider: "openai", model: "gpt-5.2", promptMinorUnitPerMillionTokens: 2500, completionMinorUnitPerMillionTokens: 10000 },
  { provider: "openai", model: "gpt-5.4", promptMinorUnitPerMillionTokens: 3000, completionMinorUnitPerMillionTokens: 12000 },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function findLLMCostProfile(provider: string, model: string) {
  const providerKey = normalize(provider);
  const modelKey = normalize(model);
  return (
    COST_PROFILES.find(
      (profile) =>
        normalize(profile.provider) === providerKey &&
        normalize(profile.model) === modelKey,
    ) ?? null
  );
}

export function estimateLLMCallCostMinorUnit(input: {
  provider: string;
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
}) {
  const profile = findLLMCostProfile(input.provider, input.model);
  if (!profile) return null;

  const promptTokens = Math.max(input.promptTokens ?? 0, 0);
  const completionTokens = Math.max(input.completionTokens ?? 0, 0);
  const cost =
    (promptTokens * profile.promptMinorUnitPerMillionTokens +
      completionTokens * profile.completionMinorUnitPerMillionTokens) /
    1_000_000;

  return Math.ceil(cost);
}

export function sumEstimatedLLMCostMinorUnit(rows: TenantHealthLLMUsageInput[]) {
  let total = 0;
  let unknownCount = 0;

  for (const row of rows) {
    const cost = estimateLLMCallCostMinorUnit({
      provider: row.provider,
      model: row.model,
      promptTokens: row.tokenUsagePrompt,
      completionTokens: row.tokenUsageCompletion,
    });
    if (cost === null) {
      unknownCount += 1;
      continue;
    }
    total += cost;
  }

  return {
    estimatedCostMinorUnit: unknownCount === rows.length && rows.length > 0 ? null : total,
    unknownCount,
  };
}

export function bucketEstimatedCostMinorUnit(
  costMinorUnit: number | null,
): TenantHealthCostBucket {
  if (costMinorUnit === null) return "unknown";
  if (costMinorUnit < 10_000) return "cny_0_100";
  if (costMinorUnit < 100_000) return "cny_100_1000";
  if (costMinorUnit < 1_000_000) return "cny_1000_10000";
  return "cny_10000_plus";
}

export function resolveBudgetState(input: {
  estimatedCostMinorUnit: number | null;
  monthlyLimitMinorUnit: number | null;
  warningThresholdPercent?: number | null;
}): TenantHealthBudgetState {
  if (input.estimatedCostMinorUnit === null) return "unknown";
  if (!input.monthlyLimitMinorUnit || input.monthlyLimitMinorUnit <= 0) {
    return "not_configured";
  }

  const usagePercent =
    (input.estimatedCostMinorUnit / input.monthlyLimitMinorUnit) * 100;
  const warningThreshold = input.warningThresholdPercent ?? 80;

  if (usagePercent >= 100) return "blocked";
  if (usagePercent >= Math.max(warningThreshold, 95)) return "risk";
  if (usagePercent >= warningThreshold) return "watch";
  return "ok";
}
