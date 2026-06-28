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
const outcome = { outcomeRef: "outcome:case-123:ptp_kept", settledAtRef: "window:2026-07-05", goalMovementRef: "move:up-1pct" };

describe("IntelligenceRecord stage machine (Native-AI four stages)", () => {
  it("buildIntelligenceId is deterministic and rejects UUID/ms/empty raw values", () => {
    expect(buildIntelligenceId({ topic: "t", workspaceId: "w1", dedupeKey: "k" })).toBe("intel:t:w1:k");
    expect(() => buildIntelligenceId({ topic: "t", workspaceId: "w1", dedupeKey: "550e8400-e29b-41d4-a716-446655440000" })).toThrow(/identity slug/);
    expect(() => buildIntelligenceId({ topic: "t", workspaceId: "w1", dedupeKey: "1782700000000" })).toThrow(/identity slug/);
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

  it("fail-closed: raw values/PII are rejected in EVERY facet (Codex reference-token policy)", () => {
    // bare values (phone / id / amount / Chinese name / non-namespaced) must all be rejected
    const rawSamples = ["13800138000", "110101199001011234", "1234567", "张三", "case-123", "plan 1"];
    // perception.sourceRef + signalRefs
    for (const raw of rawSamples) {
      expect(() => buildPerceivedIntelligence({ topic: "t", workspaceId: "w1", dedupeKey: "k", occurredAtRef: "window:d1", perception: { sourceRef: raw, signalRefs: [] } })).toThrow();
      expect(() => buildPerceivedIntelligence({ topic: "t", workspaceId: "w1", dedupeKey: "k", occurredAtRef: "window:d1", perception: { sourceRef: "src:bus", signalRefs: [raw] } })).toThrow();
    }
    const p = perceived();
    // analysis: goalRef / impactRef must reject raw values (e.g. an inline amount/phone)
    expect(() => advanceToAnalyzed(p, { goalRef: "1234567", impactRef: "impact:1" })).toThrow();
    expect(() => advanceToAnalyzed(p, { goalRef: "goal:r", impactRef: "13800138000" })).toThrow();
    const a = advanceToAnalyzed(p, analysis);
    // decision: strategyRef / action refs
    expect(() => advanceToDecided(a, { strategyRef: "张三", recommendedActionRefs: ["act:x"], riskLevel: "read" })).toThrow();
    expect(() => advanceToDecided(a, { strategyRef: "strategy:x", recommendedActionRefs: ["110101199001011234"], riskLevel: "read" })).toThrow();
    const d = advanceToDecided(a, decision);
    // orchestration + outcome
    expect(() => advanceToOrchestrated(d, { planRef: "1234567" })).toThrow();
    const o = advanceToOrchestrated(d, orchestration);
    expect(() => settleIntelligence(o, { outcomeRef: "13800138000", settledAtRef: "window:d2" })).toThrow();
    expect(() => settleIntelligence(o, { outcomeRef: "outcome:x", settledAtRef: "window:d2", goalMovementRef: "1234567" })).toThrow();
  });

  it("accepts well-formed namespaced refs in every facet", () => {
    let r = advanceToAnalyzed(perceived(), analysis);
    r = advanceToDecided(r, decision);
    r = advanceToOrchestrated(r, orchestration);
    r = settleIntelligence(r, outcome);
    expect(r.stage).toBe("settled");
  });

  it("is immutable across stages (each advance returns a frozen new record)", () => {
    const r = perceived();
    const a = advanceToAnalyzed(r, analysis);
    expect(r.stage).toBe("perceived"); // original untouched
    expect(Object.isFrozen(a)).toBe(true);
  });
});
