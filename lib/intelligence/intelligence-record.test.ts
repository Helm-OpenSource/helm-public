import { describe, expect, it } from "vitest";

import {
  advanceToAnalyzed,
  advanceToDecided,
  advanceToOrchestrated,
  buildIntelligenceId,
  buildPerceivedIntelligence,
  isSettled,
  settleIntelligence,
  type IntelligenceRecord,
} from "@/lib/intelligence/intelligence-record";

const perceived = (): IntelligenceRecord =>
  buildPerceivedIntelligence({
    topic: "case_recovery",
    workspaceId: "w1",
    dedupeKey: "case-123:2026-06-28",
    occurredAtRef: "window:2026-06-28",
    perception: { sourceRef: "src:signal-bus", signalRefs: ["sig:ptp_followup_due:1", "sig:complaint_risk:0"] },
  });

const analysis = { goalRef: "goal:recovery_rate", impactRef: "impact:case-123", probability: 0.62 };
const decision = { strategyRef: "strategy:gentle_reminder", recommendedActionRefs: ["act:schedule_call"], riskLevel: "local_draft" as const };
const orchestration = { planRef: "plan:case-123:v1", agentRunId: "run:case:w1:0001" };
const outcome = { outcomeRef: "outcome:case-123:ptp_kept", settledAtRef: "window:2026-07-05", goalMovementRef: "move:+1.2pct" };

describe("IntelligenceRecord stage machine (Native-AI four stages)", () => {
  it("buildIntelligenceId is deterministic and rejects UUID/ms/empty", () => {
    expect(buildIntelligenceId({ topic: "t", workspaceId: "w1", dedupeKey: "k" })).toBe("intel:t:w1:k");
    expect(() => buildIntelligenceId({ topic: "t", workspaceId: "w1", dedupeKey: "550e8400-e29b-41d4-a716-446655440000" })).toThrow(/UUID/);
    expect(() => buildIntelligenceId({ topic: "t", workspaceId: "w1", dedupeKey: "1782700000000" })).toThrow(/ms timestamp/);
    expect(() => buildIntelligenceId({ topic: "", workspaceId: "w1", dedupeKey: "k" })).toThrow();
  });

  it("perceives, then advances through all four stages and settles", () => {
    let r = perceived();
    expect(r.stage).toBe("perceived");
    r = advanceToAnalyzed(r, analysis);
    expect(r.stage).toBe("analyzed");
    expect(r.analysis?.goalRef).toBe("goal:recovery_rate");
    r = advanceToDecided(r, decision);
    expect(r.stage).toBe("decided");
    r = advanceToOrchestrated(r, orchestration);
    expect(r.stage).toBe("orchestrated");
    expect(r.orchestration?.agentRunId).toBe("run:case:w1:0001");
    r = settleIntelligence(r, outcome);
    expect(r.stage).toBe("settled");
    expect(isSettled(r)).toBe(true);
  });

  it("fail-closed: cannot skip stages (decide before analyze, analyze before perceive)", () => {
    expect(() => advanceToDecided(perceived(), decision)).toThrow(/must be "analyzed"/);
    const analyzed = advanceToAnalyzed(perceived(), analysis);
    expect(() => advanceToOrchestrated(analyzed, orchestration)).toThrow(/must be "decided"/);
    expect(() => settleIntelligence(analyzed, outcome)).toThrow(/must be "orchestrated"/);
  });

  it("fail-closed: reference-only facets reject inline content", () => {
    expect(() => buildPerceivedIntelligence({ topic: "t", workspaceId: "w1", dedupeKey: "k", occurredAtRef: "win:1", perception: { sourceRef: "name: Jane Doe", signalRefs: [] } })).toThrow(/sourceRef/);
    const r = perceived();
    expect(() => advanceToAnalyzed(r, { ...analysis, impactRef: "balance is 1234" })).toThrow(/impactRef/);
    expect(() => advanceToAnalyzed(r, { ...analysis, probability: 1.5 })).toThrow(/probability/);
  });

  it("fail-closed: decision riskLevel must be a known AgentImplementationRisk", () => {
    const analyzed = advanceToAnalyzed(perceived(), analysis);
    expect(() => advanceToDecided(analyzed, { ...decision, riskLevel: "yolo" as never })).toThrow();
  });

  it("is immutable across stages (each advance returns a frozen new record)", () => {
    const r = perceived();
    const a = advanceToAnalyzed(r, analysis);
    expect(r.stage).toBe("perceived"); // original untouched
    expect(Object.isFrozen(a)).toBe(true);
  });
});
