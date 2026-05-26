import { ActorType, PreferenceSignalType } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";

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

type PreferenceDraft = {
  signalType: PreferenceSignalType;
  signalKey: string;
  signalValue: string;
  userId?: string | null;
  weight: number;
  title: string;
  summary: string;
};

function mapPatternToPreference(pattern: PatternLike): PreferenceDraft | null {
  if (pattern.patternType === "approval_pattern") {
    return {
      signalType: PreferenceSignalType.APPROVAL_PREFERENCE,
      signalKey: "external_commitment",
      signalValue: "external_commitment_requires_approval",
      userId: pattern.scopeType === "USER" ? pattern.scopeId : null,
      weight: Math.max(55, Math.min(92, pattern.confidence)),
      title: "系统已学习到审批偏好",
      summary: "用户对外部承诺类动作通常保留人工审批。",
    };
  }

  if (pattern.patternType === "communication_style_pattern") {
    return {
      signalType: PreferenceSignalType.COMMUNICATION_STYLE,
      signalKey: "outbound_message",
      signalValue: "concise_draft_preferred",
      userId: pattern.scopeType === "USER" ? pattern.scopeId : null,
      weight: Math.max(54, Math.min(90, pattern.confidence)),
      title: "系统已学习到沟通风格偏好",
      summary: "用户最近更偏好简洁直接的外发文案。",
    };
  }

  if (pattern.patternType === "followup_timing_pattern") {
    return {
      signalType: PreferenceSignalType.TIMING_PREFERENCE,
      signalKey: "meeting_followup",
      signalValue: "within_24h_preferred",
      userId: pattern.scopeType === "USER" ? pattern.scopeId : null,
      weight: Math.max(58, Math.min(90, pattern.confidence)),
      title: "系统已学习到跟进时机偏好",
      summary: "该用户或团队更适合在会后 24 小时内完成 follow-up。",
    };
  }

  if (pattern.patternType === "blocker_pattern") {
    return {
      signalType: PreferenceSignalType.RISK_TOLERANCE,
      signalKey: "budget_blocker",
      signalValue: "high_risk",
      userId: null,
      weight: Math.max(60, Math.min(95, pattern.confidence)),
      title: "系统已提升预算阻塞风险感知",
      summary: "预算类阻塞在当前工作区中已经成为高频模式。",
    };
  }

  if (pattern.patternType === "stalled_opportunity_pattern") {
    return {
      signalType: PreferenceSignalType.RISK_TOLERANCE,
      signalKey: "stalled_opportunity",
      signalValue: "high_risk",
      userId: null,
      weight: Math.max(58, Math.min(92, pattern.confidence)),
      title: "系统已提升停滞机会风险感知",
      summary: "当机会超过 5 天没有推进时，系统会更积极地提前风险。",
    };
  }

  if (pattern.patternType === "contact_cooling_pattern") {
    return {
      signalType: PreferenceSignalType.TIMING_PREFERENCE,
      signalKey: "contact_followup",
      signalValue: "within_48h_preferred",
      userId: null,
      weight: Math.max(56, Math.min(88, pattern.confidence)),
      title: "系统已学习到关系恢复时机",
      summary: "温关系超过 7 天未触达时，48 小时内恢复联系更稳妥。",
    };
  }

  return null;
}

export async function applyPatternPreferences(input: {
  workspaceId: string;
  patterns: PatternLike[];
}) {
  const results: Array<{ id: string; signalKey: string; signalValue: string; created: boolean }> = [];

  for (const pattern of input.patterns) {
    const nextPreference = mapPatternToPreference(pattern);
    if (!nextPreference) continue;

    const existing = await db.preferenceSignal.findFirst({
      where: {
        workspaceId: input.workspaceId,
        userId: nextPreference.userId ?? null,
        signalType: nextPreference.signalType,
        signalKey: nextPreference.signalKey,
      },
      orderBy: { updatedAt: "desc" },
    });

    const changed =
      !existing ||
      existing.signalValue !== nextPreference.signalValue ||
      Math.abs(existing.weight - nextPreference.weight) >= 4;

    const signal = existing
      ? await db.preferenceSignal.update({
          where: { id: existing.id },
          data: {
            signalValue: nextPreference.signalValue,
            weight: nextPreference.weight,
          },
        })
      : await db.preferenceSignal.create({
          data: {
            workspaceId: input.workspaceId,
            userId: nextPreference.userId ?? undefined,
            signalType: nextPreference.signalType,
            signalKey: nextPreference.signalKey,
            signalValue: nextPreference.signalValue,
            weight: nextPreference.weight,
          },
        });

    if (changed) {
      await writeAuditLog({
        workspaceId: input.workspaceId,
        actor: "Adaptive Evolution",
        actorType: ActorType.SYSTEM,
        actionType: existing ? "PREFERENCE_SIGNAL_UPDATED_FROM_PATTERN" : "PREFERENCE_SIGNAL_CREATED_FROM_PATTERN",
        targetType: "PreferenceSignal",
        targetId: signal.id,
        summary: `${nextPreference.title}：${nextPreference.summary}`,
        payload: {
          patternId: pattern.id,
          patternType: pattern.patternType,
          signalType: signal.signalType,
          signalKey: signal.signalKey,
          signalValue: signal.signalValue,
          weight: signal.weight,
        },
        relatedObjectType: pattern.scopeType,
        relatedObjectId: pattern.scopeId,
      });

      await logEvent({
        workspaceId: input.workspaceId,
        userId: nextPreference.userId ?? undefined,
        eventName: existing ? "preference_signal_updated_from_pattern" : "preference_signal_created_from_pattern",
        eventCategory: "evolution",
        targetType: "PreferenceSignal",
        targetId: signal.id,
        metadata: {
          patternId: pattern.id,
          patternType: pattern.patternType,
          signalType: signal.signalType,
          signalKey: signal.signalKey,
          signalValue: signal.signalValue,
          weight: signal.weight,
        },
      });
    }

    results.push({
      id: signal.id,
      signalKey: signal.signalKey,
      signalValue: signal.signalValue,
      created: !existing,
    });
  }

  return results;
}
