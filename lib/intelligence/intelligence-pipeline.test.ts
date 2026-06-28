import { afterEach, describe, expect, it } from "vitest";

import { buildPerceivedIntelligence, settleIntelligence, advanceToAnalyzed, advanceToDecided, advanceToOrchestrated } from "@/lib/intelligence/intelligence-record";
import {
  InMemoryIntelligenceStore,
  collectIntelligenceFeedback,
  getIntelligenceStore,
  registerIntelligenceAnalyzer,
  registerIntelligenceDecider,
  registerIntelligenceOrchestrator,
  registerIntelligenceStore,
  resetIntelligencePipelineForTest,
  resetIntelligenceStoreForTest,
  runIntelligencePipeline,
} from "@/lib/intelligence/intelligence-pipeline";

const perceived = (dedupe = "case-1:2026-06-28") =>
  buildPerceivedIntelligence({
    topic: "case_recovery",
    workspaceId: "w1",
    dedupeKey: dedupe,
    occurredAtRef: "window:2026-06-28",
    perception: { sourceRef: "src:bus", signalRefs: ["sig:a"] },
  });

const analysis = { goalRef: "goal:recovery", impactRef: "impact:1", probability: 0.5 };
const decision = { strategyRef: "strategy:remind", recommendedActionRefs: ["act:call"], riskLevel: "read" as const };
const orchestration = { planRef: "plan:1" };

afterEach(() => {
  resetIntelligencePipelineForTest();
  resetIntelligenceStoreForTest();
});

describe("runIntelligencePipeline (four-stage flow)", () => {
  it("threads perceived → analyzed → decided → orchestrated when all stages are bound", async () => {
    const res = await runIntelligencePipeline({
      record: perceived(),
      analyzer: () => analysis,
      decider: () => decision,
      orchestrator: () => orchestration,
    });
    expect(res.reachedStage).toBe("orchestrated");
    expect(res.haltedAtStageGap).toBeUndefined();
    expect(res.record.decision?.strategyRef).toBe("strategy:remind");
  });

  it("halts HONESTLY at the first unbound stage (no fabrication)", async () => {
    const noDecider = await runIntelligencePipeline({ record: perceived(), analyzer: () => analysis, decider: () => null, orchestrator: () => orchestration });
    expect(noDecider.reachedStage).toBe("analyzed");
    expect(noDecider.haltedAtStageGap).toBe("decision");

    const noAnalyzer = await runIntelligencePipeline({ record: perceived(), analyzer: () => null });
    expect(noAnalyzer.reachedStage).toBe("perceived");
    expect(noAnalyzer.haltedAtStageGap).toBe("analysis");
  });

  it("uses registered seams when handlers are not passed", async () => {
    registerIntelligenceAnalyzer(() => analysis);
    registerIntelligenceDecider(() => decision);
    registerIntelligenceOrchestrator(() => orchestration);
    const res = await runIntelligencePipeline({ record: perceived() });
    expect(res.reachedStage).toBe("orchestrated");
  });

  it("requires a perceived record", async () => {
    const analyzed = advanceToAnalyzed(perceived(), analysis);
    await expect(runIntelligencePipeline({ record: analyzed })).rejects.toThrow(/perceived/);
  });
});

describe("IntelligenceStore", () => {
  it("put upserts by id (stage advances in place), get/listByStage are workspace-scoped", async () => {
    const store = new InMemoryIntelligenceStore();
    const r0 = perceived();
    await store.put(r0);
    await store.put(advanceToAnalyzed(r0, analysis));
    expect((await store.get("w1", r0.intelligenceId))?.stage).toBe("analyzed");
    expect(await store.listByStage("w1", "perceived")).toHaveLength(0);
    expect(await store.listByStage("w1", "analyzed")).toHaveLength(1);
    expect(await store.listByStage("w2", "analyzed")).toHaveLength(0);
  });

  it("register/get seam swaps the active store", async () => {
    const custom = new InMemoryIntelligenceStore();
    registerIntelligenceStore(custom);
    expect(getIntelligenceStore()).toBe(custom);
  });
});

describe("collectIntelligenceFeedback (回灌)", () => {
  it("returns settled records pairing strategy with realized outcome, filterable by goal", async () => {
    const store = new InMemoryIntelligenceStore();
    // a fully-settled record
    let r = perceived("case-1:2026-06-28");
    r = advanceToAnalyzed(r, analysis);
    r = advanceToDecided(r, decision);
    r = advanceToOrchestrated(r, orchestration);
    r = settleIntelligence(r, { outcomeRef: "outcome:kept", settledAtRef: "window:2026-07-05", goalMovementRef: "move:+1pct" });
    await store.put(r);
    // a not-yet-settled record (must be excluded)
    await store.put(advanceToAnalyzed(perceived("case-2:2026-06-28"), analysis));

    const feedback = await collectIntelligenceFeedback("w1", { store });
    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({ goalRef: "goal:recovery", strategyRef: "strategy:remind", outcomeRef: "outcome:kept", goalMovementRef: "move:+1pct" });

    expect(await collectIntelligenceFeedback("w1", { store, goalRef: "goal:other" })).toHaveLength(0);
    expect(await collectIntelligenceFeedback("w1", { store, goalRef: "goal:recovery" })).toHaveLength(1);
  });
});
