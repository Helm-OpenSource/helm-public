import { describe, expect, it } from "vitest";

import { validateDecisionObject } from "@/lib/agentos-decision-supervision/contract";

import {
  CAIO_JUDGEMENT_DECISION_CANDIDATE_TTL_MS,
  projectCaioJudgementToDecisionCandidate,
} from "./judgement-decision-candidate";
import {
  CAIO_LAYERED_JUDGEMENT_SCHEMA_VERSION,
  type CaioLayeredJudgement,
} from "./layered-judgement";

const WORKSPACE_ID = "ws_test_1";
const PORTFOLIO_REF = "opportunity:opp_test_1";
const COMPLETED_AT = new Date("2026-09-24T04:00:00.000Z");

function judgement(overrides: Partial<CaioLayeredJudgement> = {}): CaioLayeredJudgement {
  return {
    schemaVersion: CAIO_LAYERED_JUDGEMENT_SCHEMA_VERSION,
    facts: [{ statement: "Collected amount fell 12% week over week.", evidenceRefs: ["ev:metric:1"] }],
    inferences: [{ statement: "The decline concentrates in the first reminder cohort.", evidenceRefs: ["ev:metric:2"] }],
    risks: [{ statement: "Cohort decline may persist into month end.", severity: "medium", evidenceRefs: ["ev:metric:1"] }],
    unknowns: [{ statement: "Whether the calling window changed." }],
    suggestions: [{ kind: "dry_run_request", summary: "Dry-run a revised first reminder script.", evidenceRefs: ["ev:metric:2"] }],
    confidence: { band: "medium", score: 0.6 },
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: WORKSPACE_ID,
    jobId: "job_1",
    taskClass: "hourly_review",
    windowStart: "2026-09-24T03:00:00.000Z",
    windowEnd: "2026-09-24T04:00:00.000Z",
    layered: judgement(),
    layeredJudgementHash: `sha256:${"a".repeat(64)}`,
    judgementPacket: {
      packetId: "caio-inference-judgement.job_1",
      contentHash: `sha256:${"b".repeat(64)}`,
      evidenceRefs: ["ev:metric:1", "ev:metric:2"],
      signalEventRefs: ["caio-snapshot.snap_1"],
    },
    portfolioRef: PORTFOLIO_REF,
    completedAt: COMPLETED_AT,
    ...overrides,
  } as Parameters<typeof projectCaioJudgementToDecisionCandidate>[0];
}

describe("projectCaioJudgementToDecisionCandidate", () => {
  it("projects a judgement with suggestions/risks onto an owner-gated, evidence-ready decision candidate", () => {
    const result = projectCaioJudgementToDecisionCandidate(input());
    expect(result.kind).toBe("candidate");
    if (result.kind !== "candidate") return;
    const { decision } = result.projection;
    expect(decision.decisionId).toBe("caio-inference-decision:job_1");
    expect(decision.tenantRef).toBe(`workspace:${WORKSPACE_ID}`);
    expect(decision.allowedActionLevel).toBe("draft_task");
    expect(decision.ownerGate).toBe("approval_required");
    expect(decision.riskLevel).toBe("medium");
    expect(decision.confidence).toBe("medium");
    expect(decision.contextRefs).toContain(PORTFOLIO_REF);
    expect(decision.contextRefs).toContain("caio-snapshot.snap_1");
    expect(decision.evidenceRefs).toEqual(["ev:metric:1", "ev:metric:2"]);
    expect(decision.knowledgeRefs).toEqual([
      `judgement-packet:caio-inference-judgement.job_1@sha256:${"b".repeat(64)}`,
    ]);
    expect(decision.receiptRefs).toEqual([
      "caio-inference-job:job_1",
      `caio-layered-judgement:sha256:${"a".repeat(64)}`,
    ]);
    expect(decision.recommendedOption).toBe("Dry-run a revised first reminder script.");
    expect(decision.alternatives).toContain("Take no action and keep observing.");
    expect(decision.expiryOrReviewAt).toBe(
      new Date(COMPLETED_AT.getTime() + CAIO_JUDGEMENT_DECISION_CANDIDATE_TTL_MS).toISOString(),
    );
    // The Stage 1 validator is the authority: this must be an EVIDENCE_READY-capable object.
    const validation = validateDecisionObject(decision);
    expect(validation.valid).toBe(true);
    expect(validation.maxActionLevel).toBe("draft_task");
    expect(result.projection.facts[0]).toEqual({
      statement: "Collected amount fell 12% week over week.",
      evidenceRefs: ["ev:metric:1"],
      freshness: "fresh",
    });
    expect(result.projection.unknowns).toEqual(["Whether the calling window changed."]);
    expect(result.projection.risks).toEqual(["medium: Cohort decline may persist into month end."]);
  });

  it("is deterministic: the same job always yields the same decision", () => {
    expect(projectCaioJudgementToDecisionCandidate(input())).toEqual(
      projectCaioJudgementToDecisionCandidate(input()),
    );
  });

  it("an evidenced judgement with nothing to decide yields no candidate, not an empty decision", () => {
    const result = projectCaioJudgementToDecisionCandidate(
      input({ layered: judgement({ suggestions: [], risks: [{ statement: "Minor noise.", severity: "low", evidenceRefs: ["ev:metric:1"] }] }) }),
    );
    expect(result).toEqual({ kind: "no_candidate", reason: "no_suggestion_or_material_risk" });
  });

  it("maps unknown/mixed/low confidence to low and high risk to high, never critical", () => {
    for (const band of ["low", "mixed", "unknown"] as const) {
      const result = projectCaioJudgementToDecisionCandidate(
        input({ layered: judgement({ confidence: { band, score: null } }) }),
      );
      expect(result.kind === "candidate" && result.projection.decision.confidence).toBe("low");
    }
    const high = projectCaioJudgementToDecisionCandidate(
      input({ layered: judgement({ risks: [{ statement: "Severe drop.", severity: "high", evidenceRefs: ["ev:metric:1"] }] }) }),
    );
    expect(high.kind === "candidate" && high.projection.decision.riskLevel).toBe("high");
  });

  it("refuses inputs that could mis-scope the candidate", () => {
    for (const [overrides, reason] of [
      [{ portfolioRef: "workspace:ws_test_1" }, "caio_judgement_decision_portfolio_ref_invalid"],
      [{ portfolioRef: "opportunity:" }, "caio_judgement_decision_portfolio_ref_invalid"],
      [{ workspaceId: " " }, "caio_judgement_decision_workspace_required"],
      [{ jobId: "" }, "caio_judgement_decision_job_required"],
      [{ judgementPacket: { packetId: "caio-inference-judgement.job_2", contentHash: `sha256:${"b".repeat(64)}`, evidenceRefs: ["ev:metric:1"], signalEventRefs: [] } }, "caio_judgement_decision_packet_mismatch"],
      [{ judgementPacket: { packetId: "caio-inference-judgement.job_1", contentHash: `sha256:${"b".repeat(64)}`, evidenceRefs: [], signalEventRefs: [] } }, "caio_judgement_decision_evidence_required"],
      [{ layeredJudgementHash: "not-a-hash" }, "caio_judgement_decision_hash_invalid"],
    ] as const) {
      expect(() => projectCaioJudgementToDecisionCandidate(input(overrides as Record<string, unknown>))).toThrow(reason);
    }
  });
});
