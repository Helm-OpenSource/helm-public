/**
 * lib/intelligence/intelligence-pipeline.ts — the four-stage seam + runner + store + 回灌.
 *
 * intelligence-record.ts is the object that threads the four Native-AI stages; this is the
 * machinery that drives it: a registration seam per stage (analyzer / decider / orchestrator)
 * so the existing components plug in (forecasts/propensity → analyzer; worker decide() →
 * decider; agent-loop/post-approval → orchestrator), a runner that advances a perceived record
 * through whichever stages are bound (halting HONESTLY at the first unbound stage instead of
 * fabricating), a durable-swappable store, and a feedback collector that returns settled
 * records so analysis/decision can be recalibrated from real outcomes (回灌).
 *
 * Seam pattern + honest-unavailable defaults, consistent with event-bus / run-store. Purely
 * additive — nothing runs until a stage handler is registered or passed in.
 */

import {
  advanceToAnalyzed,
  advanceToDecided,
  advanceToOrchestrated,
  type AnalysisFacet,
  type DecisionFacet,
  type IntelligenceRecord,
  type IntelligenceStage,
  type OrchestrationFacet,
} from "@/lib/intelligence/intelligence-record";

// --- per-stage handler seams (existing components plug in here) -------------------
// A handler returns its stage's facet, or null when it cannot produce one (honest-unavailable
// → the runner halts at the current stage rather than inventing analysis/decision/plan).

export type AnalysisHandler = (record: IntelligenceRecord) => AnalysisFacet | null | Promise<AnalysisFacet | null>;
export type DecisionHandler = (record: IntelligenceRecord) => DecisionFacet | null | Promise<DecisionFacet | null>;
export type OrchestrationHandler = (record: IntelligenceRecord) => OrchestrationFacet | null | Promise<OrchestrationFacet | null>;

let activeAnalyzer: AnalysisHandler | null = null;
let activeDecider: DecisionHandler | null = null;
let activeOrchestrator: OrchestrationHandler | null = null;

export function registerIntelligenceAnalyzer(h: AnalysisHandler | null): AnalysisHandler | null {
  const prev = activeAnalyzer;
  activeAnalyzer = h;
  return prev;
}
export function registerIntelligenceDecider(h: DecisionHandler | null): DecisionHandler | null {
  const prev = activeDecider;
  activeDecider = h;
  return prev;
}
export function registerIntelligenceOrchestrator(h: OrchestrationHandler | null): OrchestrationHandler | null {
  const prev = activeOrchestrator;
  activeOrchestrator = h;
  return prev;
}
export function resetIntelligencePipelineForTest(): void {
  activeAnalyzer = null;
  activeDecider = null;
  activeOrchestrator = null;
}

export type IntelligencePipelineResult = Readonly<{
  record: IntelligenceRecord;
  /** The furthest stage reached. */
  reachedStage: IntelligenceStage;
  /** Set when the run halted before "orchestrated" because a stage handler was unavailable. */
  haltedAtStageGap?: "analysis" | "decision" | "orchestration";
}>;

/**
 * Drive a perceived record forward through analyzer → decider → orchestrator. Each stage uses
 * the bound handler (passed in, else the registered seam). A handler returning null halts the
 * run HONESTLY at the current stage (haltedAtStageGap names the missing stage). Stage
 * transitions are fail-closed (record.ts enforces no skipping).
 */
export async function runIntelligencePipeline(input: {
  record: IntelligenceRecord;
  analyzer?: AnalysisHandler | null;
  decider?: DecisionHandler | null;
  orchestrator?: OrchestrationHandler | null;
}): Promise<IntelligencePipelineResult> {
  let record = input.record;
  if (record.stage !== "perceived") {
    throw new Error(`runIntelligencePipeline requires a "perceived" record, got "${record.stage}"`);
  }

  const analyzer = input.analyzer !== undefined ? input.analyzer : activeAnalyzer;
  const analysis = analyzer ? await analyzer(record) : null;
  if (!analysis) return { record, reachedStage: record.stage, haltedAtStageGap: "analysis" };
  record = advanceToAnalyzed(record, analysis);

  const decider = input.decider !== undefined ? input.decider : activeDecider;
  const decision = decider ? await decider(record) : null;
  if (!decision) return { record, reachedStage: record.stage, haltedAtStageGap: "decision" };
  record = advanceToDecided(record, decision);

  const orchestrator = input.orchestrator !== undefined ? input.orchestrator : activeOrchestrator;
  const orchestration = orchestrator ? await orchestrator(record) : null;
  if (!orchestration) return { record, reachedStage: record.stage, haltedAtStageGap: "orchestration" };
  record = advanceToOrchestrated(record, orchestration);

  return { record, reachedStage: record.stage };
}

// --- store seam (durable-swappable) ----------------------------------------------

export interface IntelligenceStore {
  put(record: IntelligenceRecord): Promise<IntelligenceRecord>;
  get(workspaceId: string, intelligenceId: string): Promise<IntelligenceRecord | null>;
  listByStage(workspaceId: string, stage: IntelligenceStage): Promise<readonly IntelligenceRecord[]>;
}

function key(workspaceId: string, intelligenceId: string): string {
  return `${workspaceId}::${intelligenceId}`;
}

/** In-process store. put() upserts the latest record for an id (stage advances in place). */
export class InMemoryIntelligenceStore implements IntelligenceStore {
  private readonly records = new Map<string, { record: IntelligenceRecord; order: number }>();
  private nextOrder = 0;

  async put(record: IntelligenceRecord): Promise<IntelligenceRecord> {
    if (!record?.workspaceId || !record?.intelligenceId) throw new Error("intelligence store requires workspaceId + intelligenceId");
    const k = key(record.workspaceId, record.intelligenceId);
    const existing = this.records.get(k);
    this.records.set(k, { record, order: existing ? existing.order : this.nextOrder++ });
    return record;
  }
  async get(workspaceId: string, intelligenceId: string): Promise<IntelligenceRecord | null> {
    return this.records.get(key(workspaceId, intelligenceId))?.record ?? null;
  }
  async listByStage(workspaceId: string, stage: IntelligenceStage): Promise<readonly IntelligenceRecord[]> {
    return [...this.records.values()]
      .filter((e) => e.record.workspaceId === workspaceId && e.record.stage === stage)
      .sort((a, b) => a.order - b.order)
      .map((e) => e.record);
  }
}

let activeStore: IntelligenceStore = new InMemoryIntelligenceStore();
export function registerIntelligenceStore(store: IntelligenceStore): IntelligenceStore {
  const prev = activeStore;
  activeStore = store;
  return prev;
}
export function getIntelligenceStore(): IntelligenceStore {
  return activeStore;
}
export function resetIntelligenceStoreForTest(): void {
  activeStore = new InMemoryIntelligenceStore();
}

// --- per-case source provider seam (real engines bind here) ----------------------
// A provider returns, for a given record, the case's raw stage inputs (the outcome readout /
// proposal / execution plan) that the tenant's stage adapters turn into facets. This is the
// clean cross-component injection point: the PACK registers a provider built from its real
// derivation engines (pack → @helm/core is a clean dependency), and the tenant overlay
// consumes getIntelligenceSourceProvider() — no fragile overlay→pack import. Null/unregistered
// → the consumer falls back (e.g. to fixtures) or halts honestly.

export type IntelligenceCaseSources = Readonly<{
  outcomeReadout?: unknown;
  proposal?: unknown;
  postApprovalPlan?: unknown;
}>;

export type IntelligenceSourceProvider = (
  record: IntelligenceRecord,
) => IntelligenceCaseSources | null;

let activeSourceProvider: IntelligenceSourceProvider | null = null;

export function registerIntelligenceSourceProvider(
  provider: IntelligenceSourceProvider | null,
): IntelligenceSourceProvider | null {
  const previous = activeSourceProvider;
  activeSourceProvider = provider;
  return previous;
}

/** The registered per-case source provider, or null when none is bound (consumer falls back). */
export function getIntelligenceSourceProvider(): IntelligenceSourceProvider | null {
  return activeSourceProvider;
}

export function resetIntelligenceSourceProviderForTest(): void {
  activeSourceProvider = null;
}

// --- 回灌: feedback for learning -------------------------------------------------

export type IntelligenceFeedbackItem = Readonly<{
  intelligenceId: string;
  topic: string;
  goalRef: string | null;
  /** what was decided (strategy + risk) paired with what actually happened (outcome). */
  strategyRef: string | null;
  outcomeRef: string;
  goalMovementRef: string | null;
}>;

/**
 * Collect settled records as learning feedback: each pairs the decision (strategy) + analysis
 * (goal) with the realized outcome, so analysis/decision can be recalibrated from real results.
 * Optionally filtered to one goalRef. This is the loop closing back from orchestration to
 * intelligence — the piece that makes the four stages a cycle, not a one-way chain.
 */
export async function collectIntelligenceFeedback(
  workspaceId: string,
  options: { goalRef?: string; store?: IntelligenceStore } = {},
): Promise<readonly IntelligenceFeedbackItem[]> {
  const store = options.store ?? activeStore;
  const settled = await store.listByStage(workspaceId, "settled");
  return settled
    .filter((r) => r.outcome != null && (options.goalRef == null || r.analysis?.goalRef === options.goalRef))
    .map((r) => ({
      intelligenceId: r.intelligenceId,
      topic: r.topic,
      goalRef: r.analysis?.goalRef ?? null,
      strategyRef: r.decision?.strategyRef ?? null,
      outcomeRef: r.outcome!.outcomeRef,
      goalMovementRef: r.outcome!.goalMovementRef ?? null,
    }));
}
