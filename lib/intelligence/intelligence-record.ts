/**
 * lib/intelligence/intelligence-record.ts — the unified IntelligenceRecord that threads the
 * four Native-AI intelligence stages into one auditable pipeline.
 *
 * Review framing (Native-AI organized around intelligence): perception captures 情报,
 * analysis computes impact on the goal, decision produces a response strategy, orchestration
 * drafts an execution plan — and outcomes feed back. Helm had all four as ISLANDS (signals /
 * forecasts / worker decide() / agent-loop) with no shared object flowing through them. This
 * is that shared object: one record, enriched stage by stage, with a fail-closed state
 * machine (you cannot decide before you analyze, nor analyze before you perceive) and a final
 * settle stage that carries the outcome back for learning (回灌).
 *
 * Safety rails consistent with the rest of Helm: deterministic id (no UUID / no ms timestamp),
 * reference-only facets (signals/impact/strategy/plan/outcome carried as reference tokens — no
 * PII / no raw values inline), workspace-scoped. The decision risk reuses the existing
 * AgentImplementationRisk vocabulary (no forked risk enum).
 */

import {
  agentImplementationRiskSchema,
  type AgentImplementationRisk,
} from "@/lib/agentic/contracts";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MS_TIMESTAMP_RE = /\b\d{13,}\b/;

/** A reference token: non-empty, no whitespace (a ref, not inline content/PII). */
export function isIntelligenceRef(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !/\s/.test(value);
}

function assertRef(name: string, value: unknown): asserts value is string {
  if (!isIntelligenceRef(value)) throw new Error(`intelligence ${name} must be a non-empty reference token`);
}

function assertRefList(name: string, value: unknown): asserts value is readonly string[] {
  if (!Array.isArray(value)) throw new Error(`intelligence ${name} must be an array of reference tokens`);
  value.forEach((v, i) => assertRef(`${name}[${i}]`, v));
}

function assertDeterministic(name: string, value: string): void {
  if (UUID_RE.test(value)) throw new Error(`intelligence ${name} must not contain a UUID`);
  if (MS_TIMESTAMP_RE.test(value)) throw new Error(`intelligence ${name} must not contain a ms timestamp`);
}

// --- stages: a strict, fail-closed progression (no skipping) ---------------------

export const INTELLIGENCE_STAGES = ["perceived", "analyzed", "decided", "orchestrated", "settled"] as const;
export type IntelligenceStage = (typeof INTELLIGENCE_STAGES)[number];
const STAGE_INDEX: Readonly<Record<IntelligenceStage, number>> = Object.freeze(
  Object.fromEntries(INTELLIGENCE_STAGES.map((s, i) => [s, i])) as Record<IntelligenceStage, number>,
);

// --- per-stage facets (reference-only) -------------------------------------------

/** 感知:捕捉的情报(信号引用集 + 来源)。 */
export type PerceptionFacet = Readonly<{ sourceRef: string; signalRefs: readonly string[] }>;
/** 分析:对目标的影响(目标引用 + 影响引用 + 概率/置信)。 */
export type AnalysisFacet = Readonly<{
  goalRef: string;
  impactRef: string;
  probability?: number | null;
  confidenceRef?: string | null;
}>;
/** 决策:应对策略(策略引用 + 建议动作集 + 风险等级,复用 AgentImplementationRisk)。 */
export type DecisionFacet = Readonly<{
  strategyRef: string;
  recommendedActionRefs: readonly string[];
  riskLevel: AgentImplementationRisk;
}>;
/** 编排:执行方案草案(方案引用 + 可选 agent run id,接 agent-loop/run-store)。 */
export type OrchestrationFacet = Readonly<{ planRef: string; agentRunId?: string | null }>;
/** 回灌:结果(结果引用 + 结算窗口 + 目标变动引用)。 */
export type OutcomeFacet = Readonly<{ outcomeRef: string; settledAtRef: string; goalMovementRef?: string | null }>;

export type IntelligenceRecord = Readonly<{
  intelligenceId: string;
  workspaceId: string;
  topic: string;
  occurredAtRef: string;
  stage: IntelligenceStage;
  traceId?: string | null;
  perception: PerceptionFacet;
  analysis?: AnalysisFacet;
  decision?: DecisionFacet;
  orchestration?: OrchestrationFacet;
  outcome?: OutcomeFacet;
}>;

/** Deterministic intelligence id: intel:<topic>:<workspaceId>:<dedupeKey>. */
export function buildIntelligenceId(input: { topic: string; workspaceId: string; dedupeKey: string }): string {
  for (const [name, value] of Object.entries(input)) {
    assertRef(name, value);
    assertDeterministic(name, value);
  }
  return `intel:${input.topic}:${input.workspaceId}:${input.dedupeKey}`;
}

function assertPerception(p: PerceptionFacet): void {
  assertRef("perception.sourceRef", p?.sourceRef);
  assertRefList("perception.signalRefs", p?.signalRefs);
}

/** Stage 1 — 感知: create a record at "perceived". */
export function buildPerceivedIntelligence(input: {
  topic: string;
  workspaceId: string;
  dedupeKey: string;
  occurredAtRef: string;
  perception: PerceptionFacet;
  traceId?: string | null;
}): IntelligenceRecord {
  assertRef("topic", input.topic);
  assertRef("workspaceId", input.workspaceId);
  assertRef("occurredAtRef", input.occurredAtRef);
  assertDeterministic("occurredAtRef", input.occurredAtRef);
  if (input.traceId != null) assertDeterministic("traceId", input.traceId);
  assertPerception(input.perception);
  return Object.freeze({
    intelligenceId: buildIntelligenceId({ topic: input.topic, workspaceId: input.workspaceId, dedupeKey: input.dedupeKey }),
    workspaceId: input.workspaceId,
    topic: input.topic,
    occurredAtRef: input.occurredAtRef,
    stage: "perceived",
    traceId: input.traceId ?? null,
    perception: Object.freeze({ sourceRef: input.perception.sourceRef, signalRefs: Object.freeze([...input.perception.signalRefs]) }),
  });
}

function requireStage(record: IntelligenceRecord, expected: IntelligenceStage): void {
  if (record?.stage !== expected) {
    throw new Error(`intelligence stage must be "${expected}" to advance, but was "${record?.stage}" (no stage skipping)`);
  }
}

/** Stage 2 — 分析: perceived → analyzed (impact on goal). */
export function advanceToAnalyzed(record: IntelligenceRecord, analysis: AnalysisFacet): IntelligenceRecord {
  requireStage(record, "perceived");
  assertRef("analysis.goalRef", analysis?.goalRef);
  assertRef("analysis.impactRef", analysis?.impactRef);
  if (analysis.probability != null && (typeof analysis.probability !== "number" || analysis.probability < 0 || analysis.probability > 1)) {
    throw new Error("intelligence analysis.probability must be in [0,1]");
  }
  if (analysis.confidenceRef != null) assertRef("analysis.confidenceRef", analysis.confidenceRef);
  return Object.freeze({ ...record, stage: "analyzed", analysis: Object.freeze({ ...analysis, probability: analysis.probability ?? null, confidenceRef: analysis.confidenceRef ?? null }) });
}

/** Stage 3 — 决策: analyzed → decided (response strategy). */
export function advanceToDecided(record: IntelligenceRecord, decision: DecisionFacet): IntelligenceRecord {
  requireStage(record, "analyzed");
  assertRef("decision.strategyRef", decision?.strategyRef);
  assertRefList("decision.recommendedActionRefs", decision?.recommendedActionRefs);
  agentImplementationRiskSchema.parse(decision?.riskLevel); // fail-closed on an unknown risk token
  return Object.freeze({ ...record, stage: "decided", decision: Object.freeze({ ...decision, recommendedActionRefs: Object.freeze([...decision.recommendedActionRefs]) }) });
}

/** Stage 4 — 编排: decided → orchestrated (execution plan draft; may link an agent run). */
export function advanceToOrchestrated(record: IntelligenceRecord, orchestration: OrchestrationFacet): IntelligenceRecord {
  requireStage(record, "decided");
  assertRef("orchestration.planRef", orchestration?.planRef);
  if (orchestration.agentRunId != null) {
    assertRef("orchestration.agentRunId", orchestration.agentRunId);
    assertDeterministic("orchestration.agentRunId", orchestration.agentRunId);
  }
  return Object.freeze({ ...record, stage: "orchestrated", orchestration: Object.freeze({ planRef: orchestration.planRef, agentRunId: orchestration.agentRunId ?? null }) });
}

/** Stage 5 — 回灌: orchestrated → settled (outcome carried back for learning). */
export function settleIntelligence(record: IntelligenceRecord, outcome: OutcomeFacet): IntelligenceRecord {
  requireStage(record, "orchestrated");
  assertRef("outcome.outcomeRef", outcome?.outcomeRef);
  assertRef("outcome.settledAtRef", outcome?.settledAtRef);
  assertDeterministic("outcome.settledAtRef", outcome.settledAtRef);
  if (outcome.goalMovementRef != null) assertRef("outcome.goalMovementRef", outcome.goalMovementRef);
  return Object.freeze({ ...record, stage: "settled", outcome: Object.freeze({ ...outcome, goalMovementRef: outcome.goalMovementRef ?? null }) });
}

/** True once an outcome has been settled — i.e. this record is feedback for learning. */
export function isSettled(record: IntelligenceRecord): boolean {
  return record.stage === "settled" && record.outcome != null;
}

export function stageIndex(stage: IntelligenceStage): number {
  return STAGE_INDEX[stage];
}
