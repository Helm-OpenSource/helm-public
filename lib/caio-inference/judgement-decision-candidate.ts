import type {
  DecisionConfidence,
  DecisionObject,
  DecisionRiskLevel,
} from "@/lib/agentos-decision-supervision/types";
import type { EvidenceStatement } from "@/lib/stage1-owner-loop/types";

import type { CaioLayeredJudgement } from "./layered-judgement";

/**
 * Bridge from a completed CAIO inference judgement to a Stage 1 decision CANDIDATE.
 *
 * A judgement is advice (commitmentClass "advice", humanReviewerRequired). Until now it stopped on the
 * queue row: nothing turned it into something an owner could confirm and dispatch. This projection maps it
 * onto the existing canonical DecisionObject so the existing chain takes over unchanged:
 *   DecisionRecord EVIDENCE_READY -> owner confirms -> owner dispatches a governed work packet (ActionItem).
 *
 * The projection never confirms, dispatches or assigns anything. It is capped at draft_task with
 * approval_required, cites only the evidence the validated packet already carries, and is keyed by the
 * job so replays converge on one record.
 */

/** A candidate expires if the owner has not confirmed it within three days of the judgement. */
export const CAIO_JUDGEMENT_DECISION_CANDIDATE_TTL_MS = 72 * 60 * 60 * 1000;

const HASH_RE = /^sha256:[a-f0-9]{64}$/u;
const PORTFOLIO_REF_RE = /^opportunity:[A-Za-z0-9_-]{1,191}$/u;
const POLICY_REF = "policy:caio-inference-judgement-advice-only.v1";
const NO_ACTION_ALTERNATIVE = "Take no action and keep observing.";
const ROLLBACK_PATH =
  "Leave the judgement in observation; nothing is dispatched without owner confirmation and an owner-issued work packet.";

export type CaioJudgementDecisionCandidateInput = {
  workspaceId: string;
  jobId: string;
  taskClass: string;
  windowStart: string;
  windowEnd: string;
  layered: CaioLayeredJudgement;
  layeredJudgementHash: string;
  judgementPacket: {
    packetId: string;
    contentHash: string;
    evidenceRefs: readonly string[];
    signalEventRefs: readonly string[];
  };
  /** `opportunity:<id>` — the operating portfolio the owner may later dispatch work against. */
  portfolioRef: string;
  completedAt: Date;
};

export type CaioJudgementDecisionProjection = {
  decision: DecisionObject;
  facts: EvidenceStatement[];
  inferences: EvidenceStatement[];
  unknowns: string[];
  risks: string[];
};

export type CaioJudgementDecisionCandidateResult =
  | { kind: "candidate"; projection: CaioJudgementDecisionProjection }
  | { kind: "no_candidate"; reason: "no_suggestion_or_material_risk" };

function required(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function confidenceOf(layered: CaioLayeredJudgement): DecisionConfidence {
  if (layered.confidence.band === "high") return "high";
  if (layered.confidence.band === "medium") return "medium";
  return "low";
}

function riskLevelOf(layered: CaioLayeredJudgement): DecisionRiskLevel {
  if (layered.risks.some((risk) => risk.severity === "high")) return "high";
  if (layered.risks.some((risk) => risk.severity === "medium")) return "medium";
  return "low";
}

export function projectCaioJudgementToDecisionCandidate(
  input: CaioJudgementDecisionCandidateInput,
): CaioJudgementDecisionCandidateResult {
  const workspaceId = required(input.workspaceId, "caio_judgement_decision_workspace_required");
  const jobId = required(input.jobId, "caio_judgement_decision_job_required");
  if (!PORTFOLIO_REF_RE.test(input.portfolioRef)) {
    throw new Error("caio_judgement_decision_portfolio_ref_invalid");
  }
  if (!HASH_RE.test(input.layeredJudgementHash) || !HASH_RE.test(input.judgementPacket.contentHash)) {
    throw new Error("caio_judgement_decision_hash_invalid");
  }
  if (input.judgementPacket.packetId !== `caio-inference-judgement.${jobId}`) {
    throw new Error("caio_judgement_decision_packet_mismatch");
  }
  const evidenceRefs = unique(input.judgementPacket.evidenceRefs);
  if (evidenceRefs.length === 0) {
    throw new Error("caio_judgement_decision_evidence_required");
  }

  const { layered } = input;
  const materialRisks = layered.risks.filter((risk) => risk.severity !== "low");
  if (layered.suggestions.length === 0 && materialRisks.length === 0) {
    return { kind: "no_candidate", reason: "no_suggestion_or_material_risk" };
  }

  const subjects = layered.suggestions.length > 0
    ? `${layered.suggestions.length} suggestion(s)`
    : `${materialRisks.length} material risk(s)`;
  const decision: DecisionObject = {
    decisionId: `caio-inference-decision:${jobId}`,
    tenantRef: `workspace:${workspaceId}`,
    decisionType: layered.suggestions.length > 0 ? "intervention" : "diagnosis",
    businessQuestion:
      `CAIO ${input.taskClass} for ${input.windowStart} to ${input.windowEnd}: ` +
      `does the owner accept ${subjects} for follow-up?`,
    problemCategoryRef: `caio-inference:${input.taskClass}`,
    contextRefs: unique([input.portfolioRef, ...input.judgementPacket.signalEventRefs]),
    knowledgeRefs: [
      `judgement-packet:${input.judgementPacket.packetId}@${input.judgementPacket.contentHash}`,
    ],
    evidenceRefs,
    policyRefs: [POLICY_REF],
    receiptRefs: [
      `caio-inference-job:${jobId}`,
      `caio-layered-judgement:${input.layeredJudgementHash}`,
    ],
    alternatives: unique([
      ...layered.suggestions.map((suggestion) => suggestion.summary),
      NO_ACTION_ALTERNATIVE,
    ]),
    recommendedOption: layered.suggestions[0]?.summary ?? null,
    confidence: confidenceOf(layered),
    riskLevel: riskLevelOf(layered),
    allowedActionLevel: "draft_task",
    ownerGate: "approval_required",
    expiryOrReviewAt: new Date(
      input.completedAt.getTime() + CAIO_JUDGEMENT_DECISION_CANDIDATE_TTL_MS,
    ).toISOString(),
    rollbackPath: ROLLBACK_PATH,
  };
  return {
    kind: "candidate",
    projection: {
      decision,
      facts: layered.facts.map((fact) => ({
        statement: fact.statement,
        evidenceRefs: [...fact.evidenceRefs],
        freshness: "fresh",
      })),
      inferences: layered.inferences.map((inference) => ({
        statement: inference.statement,
        evidenceRefs: [...inference.evidenceRefs],
        freshness: "fresh",
      })),
      unknowns: layered.unknowns.map((unknown) => unknown.statement),
      risks: layered.risks.map((risk) => `${risk.severity}: ${risk.statement}`),
    },
  };
}
