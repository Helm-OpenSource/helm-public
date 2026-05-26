import { ActionExecutionMode, ActionType, ActorType, NotificationType, PreferenceSignalType } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { actionModeLabels, actionTypeLabels, policyDefaults, policyRecommendations } from "@/data/constants";
import { db } from "@/lib/db";
import { recordPolicyChangedDelta } from "@/lib/evolution/delta-event.service";
import { refreshEvolutionState } from "@/lib/evolution/pattern-detection.service";

type PatternLike = {
  id: string;
  workspaceId: string;
  scopeType: string;
  scopeId: string | null;
  patternType: string;
  patternKey: string;
  patternValue: string;
  confidence: number;
  evidenceCount: number;
  title: string | null;
  summary: string | null;
};

type SuggestionSeed = {
  fingerprint: string;
  suggestionType: string;
  targetPolicyKey: string;
  currentValue: string | null;
  suggestedValue: string | null;
  title: string;
  reason: string;
  confidence: number;
  evidenceSnapshot: string;
};

type AppliedEffect = {
  targetType: string;
  targetId: string;
  summary: string;
};

const actionTypesRequiringTighterApproval = [ActionType.DRAFT_EXTERNAL_EMAIL, ActionType.GENERATE_REPLY_DRAFT] as const;

function isActionType(value: string): value is ActionType {
  return Object.values(ActionType).includes(value as ActionType);
}

function isActionExecutionMode(value: string): value is ActionExecutionMode {
  return Object.values(ActionExecutionMode).includes(value as ActionExecutionMode);
}

function stringifyEvidence(pattern: PatternLike) {
  return JSON.stringify({
    patternId: pattern.id,
    patternType: pattern.patternType,
    patternKey: pattern.patternKey,
    patternValue: pattern.patternValue,
    confidence: pattern.confidence,
    evidenceCount: pattern.evidenceCount,
    summary: pattern.summary,
  });
}

async function buildSuggestionSeeds(workspaceId: string, patterns: PatternLike[]): Promise<SuggestionSeed[]> {
  const [policies, workspaceSignals] = await Promise.all([
    db.policyRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
    db.preferenceSignal.findMany({
      where: {
        workspaceId,
        userId: null,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const policyMap = new Map(policies.map((policy) => [policy.actionType, policy]));
  const signalMap = new Map(workspaceSignals.map((signal) => [signal.signalKey, signal]));

  const seeds: SuggestionSeed[] = [];

  for (const pattern of patterns) {
    if (pattern.patternType === "approval_pattern") {
      for (const actionType of actionTypesRequiringTighterApproval) {
        const policy = policyMap.get(actionType);
        if (!policy || policy.mode === ActionExecutionMode.REQUIRES_APPROVAL) {
          continue;
        }

        const actionLabel = actionTypeLabels[actionType];
        seeds.push({
          fingerprint: `${workspaceId}:policy:${actionType}:${ActionExecutionMode.REQUIRES_APPROVAL}`,
          suggestionType: "POLICY_MODE_CHANGE",
          targetPolicyKey: actionType,
          currentValue: policy.mode,
          suggestedValue: ActionExecutionMode.REQUIRES_APPROVAL,
          title: `建议把${actionLabel}切回逐条审批`,
          reason:
            pattern.summary ??
            `系统观察到你最近对“${actionLabel}”这类外发承诺动作几乎都保留人工审批，默认策略值得收紧。`,
          confidence: Math.max(60, pattern.confidence),
          evidenceSnapshot: stringifyEvidence(pattern),
        });
      }
    }

    if (pattern.patternType === "blocker_pattern") {
      const currentRiskValue = signalMap.get("budget_blocker")?.signalValue ?? "normal";
      if (currentRiskValue === "high_risk") {
        continue;
      }
      seeds.push({
        fingerprint: `${workspaceId}:risk:budget_blocker:high_risk`,
        suggestionType: "RISK_WEIGHT_CHANGE",
        targetPolicyKey: "budget_blocker",
        currentValue: currentRiskValue,
        suggestedValue: "high_risk",
        title: "建议提高预算阻塞的风险权重",
        reason: pattern.summary ?? "预算相关阻塞最近明显升高，建议把这类风险前置到首页和 recommendation 排序中。",
        confidence: Math.max(58, pattern.confidence),
        evidenceSnapshot: stringifyEvidence(pattern),
      });
    }

    if (pattern.patternType === "followup_timing_pattern") {
      const currentTimingValue = signalMap.get("meeting_followup")?.signalValue ?? "72h";
      if (currentTimingValue === "24h") {
        continue;
      }
      seeds.push({
        fingerprint: `${workspaceId}:timing:meeting_followup:24h`,
        suggestionType: "TIMING_WINDOW_CHANGE",
        targetPolicyKey: "meeting_followup",
        currentValue: currentTimingValue,
        suggestedValue: "24h",
        title: "建议把会后跟进窗口收紧到 24 小时",
        reason: pattern.summary ?? "系统观察到会后 24 小时内的跟进行动更容易被采纳，值得把这个窗口前置。",
        confidence: Math.max(56, pattern.confidence),
        evidenceSnapshot: stringifyEvidence(pattern),
      });
    }

    if (pattern.patternType === "stalled_opportunity_pattern") {
      const currentRiskValue = signalMap.get("stalled_opportunity")?.signalValue ?? "normal";
      if (currentRiskValue !== "high_risk") {
        seeds.push({
          fingerprint: `${workspaceId}:risk:stalled_opportunity:high_risk`,
          suggestionType: "RISK_WEIGHT_CHANGE",
          targetPolicyKey: "stalled_opportunity",
          currentValue: currentRiskValue,
          suggestedValue: "high_risk",
          title: "建议把停滞机会前置为更强风险信号",
          reason: pattern.summary ?? "系统观察到停滞机会会更快拖低推进节奏，建议把它前置到 recommendation 和首页风险区。",
          confidence: Math.max(58, pattern.confidence),
          evidenceSnapshot: stringifyEvidence(pattern),
        });
      }
    }

    if (pattern.patternType === "contact_cooling_pattern") {
      const currentTimingValue = signalMap.get("contact_followup")?.signalValue ?? "72h";
      if (currentTimingValue !== "48h") {
        seeds.push({
          fingerprint: `${workspaceId}:timing:contact_followup:48h`,
          suggestionType: "TIMING_WINDOW_CHANGE",
          targetPolicyKey: "contact_followup",
          currentValue: currentTimingValue,
          suggestedValue: "48h",
          title: "建议把关系恢复动作提前到 48 小时窗口",
          reason: pattern.summary ?? "暖关系超过一周未触达时，更适合在 48 小时窗口内做恢复动作，避免关系继续掉温。",
          confidence: Math.max(56, pattern.confidence),
          evidenceSnapshot: stringifyEvidence(pattern),
        });
      }
    }
  }

  return seeds;
}

export async function syncStrategySuggestions(input: {
  workspaceId: string;
  patterns: PatternLike[];
}) {
  const seeds = await buildSuggestionSeeds(input.workspaceId, input.patterns);
  const seen = new Set(seeds.map((seed) => seed.fingerprint));

  const existingOpen = await db.strategySuggestion.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "OPEN",
    },
  });

  const results = [];
  for (const seed of seeds) {
    const existing = await db.strategySuggestion.findUnique({
      where: { fingerprint: seed.fingerprint },
    });

    const changed =
      !existing ||
      existing.currentValue !== seed.currentValue ||
      existing.suggestedValue !== seed.suggestedValue ||
      existing.reason !== seed.reason ||
      Math.abs(existing.confidence - seed.confidence) >= 4;

    const suggestion = existing
      ? await db.strategySuggestion.update({
          where: { id: existing.id },
          data: {
            suggestionType: seed.suggestionType,
            targetPolicyKey: seed.targetPolicyKey,
            currentValue: seed.currentValue ?? undefined,
            suggestedValue: seed.suggestedValue ?? undefined,
            title: seed.title,
            reason: seed.reason,
            confidence: seed.confidence,
            evidenceSnapshot: seed.evidenceSnapshot,
            status: existing.status === "EXPIRED" ? "OPEN" : existing.status,
          },
        })
      : await db.strategySuggestion.create({
          data: {
            workspaceId: input.workspaceId,
            fingerprint: seed.fingerprint,
            suggestionType: seed.suggestionType,
            targetPolicyKey: seed.targetPolicyKey,
            currentValue: seed.currentValue ?? undefined,
            suggestedValue: seed.suggestedValue ?? undefined,
            title: seed.title,
            reason: seed.reason,
            confidence: seed.confidence,
            evidenceSnapshot: seed.evidenceSnapshot,
          },
        });

    if (changed) {
      await writeAuditLog({
        workspaceId: input.workspaceId,
        actor: "Adaptive Evolution",
        actorType: ActorType.SYSTEM,
        actionType: existing ? "STRATEGY_SUGGESTION_UPDATED" : "STRATEGY_SUGGESTION_CREATED",
        targetType: "StrategySuggestion",
        targetId: suggestion.id,
        summary: suggestion.title,
        payload: {
          currentValue: suggestion.currentValue,
          suggestedValue: suggestion.suggestedValue,
          suggestionType: suggestion.suggestionType,
          confidence: suggestion.confidence,
        },
      });

      await logEvent({
        workspaceId: input.workspaceId,
        eventName: existing ? "strategy_suggestion_updated" : "strategy_suggestion_created",
        eventCategory: "evolution",
        targetType: "StrategySuggestion",
        targetId: suggestion.id,
        metadata: {
          targetPolicyKey: suggestion.targetPolicyKey,
          currentValue: suggestion.currentValue,
          suggestedValue: suggestion.suggestedValue,
          confidence: suggestion.confidence,
        },
      });
    }

    results.push(suggestion);
  }

  for (const suggestion of existingOpen) {
    if (seen.has(suggestion.fingerprint)) continue;
    await db.strategySuggestion.update({
      where: { id: suggestion.id },
      data: { status: "EXPIRED" },
    });
  }

  return results;
}

export async function listStrategySuggestions(workspaceId: string, status?: string) {
  return db.strategySuggestion.findMany({
    where: {
      workspaceId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

async function upsertWorkspacePreferenceSignal(input: {
  workspaceId: string;
  signalType: PreferenceSignalType;
  signalKey: string;
  signalValue: string;
  weight: number;
  sourceRecommendationId: string;
}) {
  const existing = await db.preferenceSignal.findFirst({
    where: {
      workspaceId: input.workspaceId,
      userId: null,
      signalType: input.signalType,
      signalKey: input.signalKey,
    },
  });

  if (existing) {
    return db.preferenceSignal.update({
      where: { id: existing.id },
      data: {
        signalValue: input.signalValue,
        weight: input.weight,
        sourceRecommendationId: input.sourceRecommendationId,
      },
    });
  }

  return db.preferenceSignal.create({
    data: {
      workspaceId: input.workspaceId,
      signalType: input.signalType,
      signalKey: input.signalKey,
      signalValue: input.signalValue,
      weight: input.weight,
      sourceRecommendationId: input.sourceRecommendationId,
    },
  });
}

async function applyStrategySuggestionEffect(input: {
  workspaceId: string;
  suggestion: {
    id: string;
    suggestionType: string;
    targetPolicyKey: string;
    suggestedValue: string | null;
  };
  userId: string;
}) {
  if (!input.suggestion.suggestedValue) {
    return null;
  }

  if (input.suggestion.suggestionType === "POLICY_MODE_CHANGE" && isActionType(input.suggestion.targetPolicyKey) && isActionExecutionMode(input.suggestion.suggestedValue)) {
    const actionType = input.suggestion.targetPolicyKey;
    const policy = await db.policyRule.findFirst({
      where: {
        workspaceId: input.workspaceId,
        actionType,
      },
      orderBy: { createdAt: "asc" },
    });

    const defaultRule = policyDefaults[actionType];
    const nextPolicy = policy
      ? await db.policyRule.update({
          where: { id: policy.id },
          data: {
            mode: input.suggestion.suggestedValue,
          },
        })
      : await db.policyRule.create({
          data: {
            workspaceId: input.workspaceId,
            actionType,
            name: `${actionTypeLabels[actionType]}策略`,
            mode: input.suggestion.suggestedValue,
            riskThreshold: defaultRule.riskThreshold,
            enabled: true,
            description: policyRecommendations[actionType].summary,
          },
        });

    await recordPolicyChangedDelta({
      workspaceId: input.workspaceId,
      actorId: input.userId,
      actorType: ActorType.USER,
      sourcePage: "/settings",
      policyRuleId: nextPolicy.id,
      actionType: nextPolicy.actionType,
      policyName: nextPolicy.name,
      before: policy
        ? {
            mode: policy.mode,
            riskThreshold: policy.riskThreshold,
            enabled: policy.enabled,
          }
        : null,
      after: {
        mode: nextPolicy.mode,
        riskThreshold: nextPolicy.riskThreshold,
        enabled: nextPolicy.enabled,
      },
    });

    return {
      targetType: "PolicyRule",
      targetId: nextPolicy.id,
      summary: `已把${actionTypeLabels[actionType]}的默认策略收敛为“${actionModeLabels[input.suggestion.suggestedValue]}”`,
    } satisfies AppliedEffect;
  }

  if (input.suggestion.suggestionType === "RISK_WEIGHT_CHANGE") {
    const signal = await upsertWorkspacePreferenceSignal({
      workspaceId: input.workspaceId,
      signalType: PreferenceSignalType.RISK_TOLERANCE,
      signalKey: input.suggestion.targetPolicyKey,
      signalValue: input.suggestion.suggestedValue,
      weight: 82,
      sourceRecommendationId: input.suggestion.id,
    });

    return {
      targetType: "PreferenceSignal",
      targetId: signal.id,
      summary: `已把“${input.suggestion.targetPolicyKey}”的风险观察提高为“${input.suggestion.suggestedValue}”`,
    } satisfies AppliedEffect;
  }

  if (input.suggestion.suggestionType === "TIMING_WINDOW_CHANGE") {
    const signal = await upsertWorkspacePreferenceSignal({
      workspaceId: input.workspaceId,
      signalType: PreferenceSignalType.TIMING_PREFERENCE,
      signalKey: input.suggestion.targetPolicyKey,
      signalValue: input.suggestion.suggestedValue,
      weight: 78,
      sourceRecommendationId: input.suggestion.id,
    });

    return {
      targetType: "PreferenceSignal",
      targetId: signal.id,
      summary: `已把“${input.suggestion.targetPolicyKey}”的默认时间窗口收敛到 ${input.suggestion.suggestedValue}`,
    } satisfies AppliedEffect;
  }

  return null;
}

export async function acceptStrategySuggestion(input: {
  workspaceId: string;
  suggestionId: string;
  userId: string;
  actorName: string;
}) {
  const suggestion = await db.strategySuggestion.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.suggestionId,
    },
  });

  if (!suggestion) {
    throw new Error("策略建议不存在");
  }

  if (suggestion.status !== "OPEN") {
    return suggestion;
  }

  const effect = await applyStrategySuggestionEffect({
    workspaceId: input.workspaceId,
    suggestion: {
      id: suggestion.id,
      suggestionType: suggestion.suggestionType,
      targetPolicyKey: suggestion.targetPolicyKey,
      suggestedValue: suggestion.suggestedValue,
    },
    userId: input.userId,
  });

  const updated = await db.strategySuggestion.update({
    where: { id: suggestion.id },
    data: {
      status: "ACCEPTED",
      confirmedByUserId: input.userId,
      confirmedAt: new Date(),
      appliedTargetType: effect?.targetType,
      appliedTargetId: effect?.targetId,
      appliedEffectSummary: effect?.summary,
      appliedAt: effect ? new Date() : null,
    },
  });

  if (effect) {
    await db.notification.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        type: NotificationType.UPDATE,
        title: "策略建议已收敛到系统规则",
        body: effect.summary,
        url: "/settings?tab=policies",
      },
    });
  }

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "STRATEGY_SUGGESTION_ACCEPTED",
    targetType: "StrategySuggestion",
    targetId: updated.id,
    summary: `采纳策略建议：${updated.title}`,
    payload: {
      suggestionType: updated.suggestionType,
      targetPolicyKey: updated.targetPolicyKey,
      currentValue: updated.currentValue,
      suggestedValue: updated.suggestedValue,
      appliedTargetType: updated.appliedTargetType,
      appliedTargetId: updated.appliedTargetId,
      appliedEffectSummary: updated.appliedEffectSummary,
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "strategy_suggestion_accepted",
    eventCategory: "evolution",
    targetType: "StrategySuggestion",
    targetId: updated.id,
    metadata: {
      suggestionType: updated.suggestionType,
      targetPolicyKey: updated.targetPolicyKey,
      suggestedValue: updated.suggestedValue,
      appliedTargetType: updated.appliedTargetType,
      appliedTargetId: updated.appliedTargetId,
      appliedEffectSummary: updated.appliedEffectSummary,
    },
    sourcePage: "/settings",
  });

  if (effect) {
    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      eventName: "strategy_suggestion_applied",
      eventCategory: "evolution",
      targetType: effect.targetType,
      targetId: effect.targetId,
      metadata: {
        suggestionId: updated.id,
        suggestionType: updated.suggestionType,
        effectSummary: effect.summary,
      },
      sourcePage: "/settings",
    });
  }

  try {
    await refreshEvolutionState({
      workspaceId: input.workspaceId,
      actorId: input.userId,
      actorType: ActorType.USER,
      sourcePage: "/settings",
      trigger: "strategy_suggestion_accepted",
    });
  } catch (error) {
    console.error("strategy suggestion evolution refresh failed", error);
  }

  return updated;
}

export async function dismissStrategySuggestion(input: {
  workspaceId: string;
  suggestionId: string;
  userId: string;
  actorName: string;
}) {
  const suggestion = await db.strategySuggestion.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.suggestionId,
    },
  });

  if (!suggestion) {
    throw new Error("策略建议不存在");
  }

  const updated = await db.strategySuggestion.update({
    where: { id: suggestion.id },
    data: {
      status: "DISMISSED",
      confirmedByUserId: input.userId,
      confirmedAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "STRATEGY_SUGGESTION_DISMISSED",
    targetType: "StrategySuggestion",
    targetId: updated.id,
    summary: `忽略策略建议：${updated.title}`,
    payload: {
      suggestionType: updated.suggestionType,
      targetPolicyKey: updated.targetPolicyKey,
      suggestedValue: updated.suggestedValue,
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "strategy_suggestion_dismissed",
    eventCategory: "evolution",
    targetType: "StrategySuggestion",
    targetId: updated.id,
    metadata: {
      suggestionType: updated.suggestionType,
      targetPolicyKey: updated.targetPolicyKey,
    },
    sourcePage: "/settings",
  });

  try {
    await refreshEvolutionState({
      workspaceId: input.workspaceId,
      actorId: input.userId,
      actorType: ActorType.USER,
      sourcePage: "/settings",
      trigger: "strategy_suggestion_dismissed",
    });
  } catch (error) {
    console.error("strategy suggestion dismissal refresh failed", error);
  }

  return updated;
}
