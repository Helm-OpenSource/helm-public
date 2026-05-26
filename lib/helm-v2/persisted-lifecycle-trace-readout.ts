import type { HelmV21OperatorDebuggerPersistedLifecycleTrace } from "@/lib/helm-v2/contracts";

export type HelmV21PersistedLifecycleTraceReadout = {
  compactSummary: string;
  provenanceSummary: string | null;
  referenceSummary: string | null;
  integritySummary: string;
};

function joinParts(parts: Array<string | null>): string | null {
  const value = parts.filter(Boolean).join(" · ");
  return value || null;
}

export function buildPersistedLifecycleTraceReadout(
  trace: HelmV21OperatorDebuggerPersistedLifecycleTrace,
): HelmV21PersistedLifecycleTraceReadout {
  const referenceSummary = joinParts([
    trace.checkpointId ? `id ${trace.checkpointId}` : null,
    trace.checkpointKey ? `key ${trace.checkpointKey}` : null,
    trace.resumeToken ? `resume ${trace.resumeToken}` : null,
  ]);

  const provenanceSummary = joinParts([
    trace.refreshReason ? `refresh ${trace.refreshReason}` : null,
    trace.refreshSource ? `source ${trace.refreshSource}` : null,
  ]);
  const integritySummary =
    joinParts([
      `lifecycle ${trace.persistedLifecycleState}`,
      `write ${trace.writeSideState}`,
      `compact ${trace.compactionState}`,
      `reconcile ${trace.reconciliationState}`,
      `${trace.checkpointLineageDepth} checkpoint anchor(s)`,
      `${trace.replayEventLogEntries} replay event(s)`,
    ]) ?? `${trace.persistedLifecycleState} · ${trace.writeSideState}`;

  return {
    compactSummary:
      joinParts([trace.state, trace.anchor, referenceSummary, provenanceSummary]) ??
      `${trace.state} · ${trace.anchor}`,
    provenanceSummary,
    referenceSummary,
    integritySummary,
  };
}
