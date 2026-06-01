import { ObjectType } from "@prisma/client";

export const truthReconciliationSourceKinds = [
  "meeting",
  "email",
  "crm",
  "report",
] as const;

export type TruthReconciliationSourceKind =
  (typeof truthReconciliationSourceKinds)[number];

export type TruthReconciliationSubject = {
  workspaceId: string;
  objectType: ObjectType | "WORKSPACE";
  objectId: string;
  claimKey: string;
};

export type TruthReconciliationSignal = {
  sourceKind: TruthReconciliationSourceKind;
  sourceId: string;
  subject: TruthReconciliationSubject;
  claimValue: string;
  summary: string;
  observedAt: Date;
  explicitConfidence?: number;
  evidenceRefs: string[];
};

export type TruthReconciliationEvidenceEntry = {
  sourceKind: TruthReconciliationSourceKind;
  sourceId: string;
  claimValue: string;
  summary: string;
  evidenceRefs: string[];
  observedAt: Date;
  sourceTrust: number;
  freshness: number;
  explicitConfidence: number;
  score: number;
  posture: "supporting" | "conflicting" | "contested";
};

export type TruthReconciliationResult = {
  subjectKey: string;
  claimKey: string;
  outcome: "resolved" | "unresolved";
  resolvedValue: string | null;
  confidence: number;
  operatorReviewRequired: boolean;
  evidenceChain: TruthReconciliationEvidenceEntry[];
  conflictingValues: string[];
  summary: string;
};

export const truthReconciliationSourceTrust: Record<
  TruthReconciliationSourceKind,
  number
> = {
  meeting: 92,
  email: 84,
  crm: 78,
  report: 70,
};

type ReconciliationSignalInput = Omit<TruthReconciliationSignal, "sourceKind">;

type ScoredSignal = TruthReconciliationSignal & {
  normalizedClaimValue: string;
  subjectKey: string;
  sourceTrust: number;
  freshness: number;
  explicitConfidence: number;
  score: number;
};

type ClaimCluster = {
  claimValue: string;
  normalizedClaimValue: string;
  signals: ScoredSignal[];
  totalScore: number;
  averageScore: number;
};

export function buildTruthReconciliationSubjectKey(
  subject: TruthReconciliationSubject,
): string {
  return [
    subject.workspaceId,
    subject.objectType,
    subject.objectId,
    subject.claimKey.trim().toLowerCase(),
  ].join(":");
}

export function createMeetingTruthSignal(
  input: ReconciliationSignalInput,
): TruthReconciliationSignal {
  return normalizeTruthSignal({ ...input, sourceKind: "meeting" });
}

export function createEmailTruthSignal(
  input: ReconciliationSignalInput,
): TruthReconciliationSignal {
  return normalizeTruthSignal({ ...input, sourceKind: "email" });
}

export function createCrmTruthSignal(
  input: ReconciliationSignalInput,
): TruthReconciliationSignal {
  return normalizeTruthSignal({ ...input, sourceKind: "crm" });
}

export function createReportTruthSignal(
  input: ReconciliationSignalInput,
): TruthReconciliationSignal {
  return normalizeTruthSignal({ ...input, sourceKind: "report" });
}

export function reconcileTruthSignals(input: {
  subject: TruthReconciliationSubject;
  signals: TruthReconciliationSignal[];
  now?: Date;
}): TruthReconciliationResult {
  if (input.signals.length === 0) {
    throw new Error("Truth reconciliation requires at least one signal.");
  }

  const subjectKey = buildTruthReconciliationSubjectKey(input.subject);
  const now = input.now ?? new Date();
  const scoredSignals = input.signals.map((signal) =>
    scoreSignal({
      signal,
      expectedSubjectKey: subjectKey,
      now,
    }),
  );
  const clusters = buildClaimClusters(scoredSignals);
  const leadingCluster = clusters[0];
  const runnerUpCluster = clusters[1] ?? null;
  const scoreGap = runnerUpCluster
    ? leadingCluster.totalScore - runnerUpCluster.totalScore
    : leadingCluster.totalScore;
  const leadingTopSignal = getTopSignal(leadingCluster);
  const runnerUpTopSignal = runnerUpCluster ? getTopSignal(runnerUpCluster) : null;
  const hasFreshHighTrustConflict =
    runnerUpTopSignal !== null &&
    runnerUpTopSignal.sourceTrust >= 84 &&
    runnerUpTopSignal.explicitConfidence >= 80 &&
    runnerUpTopSignal.freshness >= 75 &&
    leadingTopSignal.sourceTrust - runnerUpTopSignal.sourceTrust < 10;

  const resolved =
    runnerUpCluster === null ||
    (scoreGap >= 18 &&
      leadingCluster.averageScore >= 70 &&
      !hasFreshHighTrustConflict);
  const supportBonus = Math.min(12, (leadingCluster.signals.length - 1) * 6);
  const competitionPenalty = runnerUpCluster
    ? Math.min(20, Math.max(0, 18 - scoreGap))
    : 0;

  const confidence = resolved
    ? clamp(
        Math.round(
          leadingCluster.averageScore + supportBonus - competitionPenalty,
        ),
        0,
        96,
      )
    : clamp(
        Math.round(
          ((leadingCluster.averageScore +
            (runnerUpCluster?.averageScore ?? leadingCluster.averageScore)) /
            2) -
            18,
        ),
        20,
        68,
      );

  const operatorReviewRequired =
    !resolved ||
    leadingCluster.averageScore < 72 ||
    leadingCluster.signals.length < 2;

  const evidenceChain = scoredSignals
    .slice()
    .sort((left, right) => {
      const leftSupportsLeading =
        left.normalizedClaimValue === leadingCluster.normalizedClaimValue;
      const rightSupportsLeading =
        right.normalizedClaimValue === leadingCluster.normalizedClaimValue;
      if (leftSupportsLeading !== rightSupportsLeading) {
        return leftSupportsLeading ? -1 : 1;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.observedAt.getTime() - left.observedAt.getTime();
    })
    .map((signal) => ({
      sourceKind: signal.sourceKind,
      sourceId: signal.sourceId,
      claimValue: signal.claimValue,
      summary: signal.summary,
      evidenceRefs: signal.evidenceRefs,
      observedAt: signal.observedAt,
      sourceTrust: signal.sourceTrust,
      freshness: signal.freshness,
      explicitConfidence: signal.explicitConfidence,
      score: signal.score,
      posture: (
        resolved
          ? signal.normalizedClaimValue === leadingCluster.normalizedClaimValue
            ? "supporting"
            : "conflicting"
          : "contested"
      ) as TruthReconciliationEvidenceEntry["posture"],
    }));

  return {
    subjectKey,
    claimKey: input.subject.claimKey,
    outcome: resolved ? "resolved" : "unresolved",
    resolvedValue: resolved ? leadingCluster.claimValue : null,
    confidence,
    operatorReviewRequired,
    evidenceChain,
    conflictingValues: clusters
      .slice(resolved ? 1 : 0)
      .map((cluster) => cluster.claimValue),
    summary: resolved
      ? `当前 ${input.subject.claimKey} 最可信的 truth 是“${leadingCluster.claimValue}”，证据优先来自 ${formatSourceKinds(
          leadingCluster.signals,
        )}。`
      : `当前 ${input.subject.claimKey} 在 ${formatSourceKinds(
          scoredSignals,
        )} 之间仍有冲突，不能静默收敛，必须继续操作员复核。`,
  };
}

function normalizeTruthSignal(
  signal: TruthReconciliationSignal,
): TruthReconciliationSignal {
  const claimValue = signal.claimValue.trim();
  const summary = signal.summary.trim();
  const evidenceRefs = signal.evidenceRefs
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    ...signal,
    claimValue,
    summary,
    evidenceRefs:
      evidenceRefs.length > 0
        ? evidenceRefs
        : [`${signal.sourceKind}:${signal.sourceId}`],
  };
}

function scoreSignal(input: {
  signal: TruthReconciliationSignal;
  expectedSubjectKey: string;
  now: Date;
}): ScoredSignal {
  const signal = normalizeTruthSignal(input.signal);
  validateSignal(signal);

  const subjectKey = buildTruthReconciliationSubjectKey(signal.subject);
  if (subjectKey !== input.expectedSubjectKey) {
    throw new Error(
      `Truth reconciliation signal subject drifted: expected ${input.expectedSubjectKey}, got ${subjectKey}.`,
    );
  }

  const sourceTrust = truthReconciliationSourceTrust[signal.sourceKind];
  const explicitConfidence = clamp(
    signal.explicitConfidence ?? sourceTrust,
    0,
    100,
  );
  const freshness = computeFreshnessScore(signal.observedAt, input.now);
  const score = clamp(
    Math.round(sourceTrust * 0.35 + explicitConfidence * 0.4 + freshness * 0.25),
    0,
    100,
  );

  return {
    ...signal,
    normalizedClaimValue: normalizeClaimValue(signal.claimValue),
    subjectKey,
    sourceTrust,
    explicitConfidence,
    freshness,
    score,
  };
}

function validateSignal(signal: TruthReconciliationSignal): void {
  if (!truthReconciliationSourceKinds.includes(signal.sourceKind)) {
    throw new Error(`Unsupported truth reconciliation source: ${signal.sourceKind}`);
  }

  if (!signal.subject.workspaceId.trim()) {
    throw new Error("Truth reconciliation subject must keep workspace scope.");
  }
  if (!signal.subject.objectId.trim()) {
    throw new Error("Truth reconciliation subject must include objectId.");
  }
  if (!signal.subject.claimKey.trim()) {
    throw new Error("Truth reconciliation subject must include claimKey.");
  }
  if (!signal.sourceId.trim()) {
    throw new Error("Truth reconciliation signal must include sourceId.");
  }
  if (!signal.claimValue.trim()) {
    throw new Error("Truth reconciliation signal must include claimValue.");
  }
  if (!signal.summary.trim()) {
    throw new Error("Truth reconciliation signal must include summary.");
  }
  if (signal.evidenceRefs.length === 0) {
    throw new Error("Truth reconciliation signal must include evidence refs.");
  }
}

function buildClaimClusters(signals: ScoredSignal[]): ClaimCluster[] {
  const clusters = new Map<string, ClaimCluster>();

  for (const signal of signals) {
    const existing = clusters.get(signal.normalizedClaimValue);
    if (existing) {
      existing.signals.push(signal);
      existing.totalScore += signal.score;
      existing.averageScore = Math.round(existing.totalScore / existing.signals.length);
      continue;
    }

    clusters.set(signal.normalizedClaimValue, {
      claimValue: signal.claimValue,
      normalizedClaimValue: signal.normalizedClaimValue,
      signals: [signal],
      totalScore: signal.score,
      averageScore: signal.score,
    });
  }

  return Array.from(clusters.values()).sort((left, right) => {
    if (right.totalScore !== left.totalScore) {
      return right.totalScore - left.totalScore;
    }
    if (right.averageScore !== left.averageScore) {
      return right.averageScore - left.averageScore;
    }
    return (
      right.signals[0]?.observedAt.getTime() - left.signals[0]?.observedAt.getTime()
    );
  });
}

function getTopSignal(cluster: ClaimCluster): ScoredSignal {
  return cluster.signals
    .slice()
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.observedAt.getTime() - left.observedAt.getTime();
    })[0];
}

function normalizeClaimValue(value: string): string {
  return value.trim().toLowerCase();
}

function computeFreshnessScore(observedAt: Date, now: Date): number {
  const ageMs = Math.max(0, now.getTime() - observedAt.getTime());
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 24) return 100;
  if (ageHours <= 72) return 90;
  if (ageHours <= 24 * 7) return 75;
  if (ageHours <= 24 * 30) return 55;
  return 35;
}

function formatSourceKinds(
  signals: Array<{ sourceKind: TruthReconciliationSourceKind }>,
): string {
  const labels = Array.from(new Set(signals.map((signal) => signal.sourceKind)));
  return labels.join(" / ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
