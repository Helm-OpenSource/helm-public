import type { CaioAttentionSeverity } from "./contracts";

/**
 * What the generator does with one eligible OPEN candidate (design v4 §4); one live case per signal (detectorId:mergeKey).
 * Live case: another candidate on the signal is a recurrence (RECURRED once per candidate); a critical hit on a warning case
 * is SEVERITY_RAISED once (the lifecycle service consumes it). No live case but the candidate already originated or recurred
 * on a case: nothing, so a persisting anomaly never rebuilds a dismissed or closed case. Otherwise: a new SUGGESTED case.
 */
export type CaioAttentionLiveCase = Readonly<{
  id: string;
  originCandidateId: string;
  effectiveSeverity: string;
  candidateRecurred: boolean;
  severityRaisePending: boolean;
}>;

export type CaioAttentionGeneratorAction =
  | { kind: "create" }
  | { kind: "attach"; caseId: string; recur: boolean; raise: boolean }
  | { kind: "skip"; reason: "already_attached" | "candidate_consumed" };

export function planCaioAttentionGeneration(input: Readonly<{
  candidateId: string;
  severity: CaioAttentionSeverity;
  liveCase: CaioAttentionLiveCase | null;
  candidateConsumed: boolean;
}>): CaioAttentionGeneratorAction {
  const { liveCase } = input;
  if (liveCase) {
    const recur = liveCase.originCandidateId !== input.candidateId && !liveCase.candidateRecurred;
    const raise = liveCase.effectiveSeverity === "warning" && input.severity === "critical" && !liveCase.severityRaisePending;
    return recur || raise ? { kind: "attach", caseId: liveCase.id, recur, raise } : { kind: "skip", reason: "already_attached" };
  }
  return input.candidateConsumed ? { kind: "skip", reason: "candidate_consumed" } : { kind: "create" };
}
