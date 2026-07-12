import { describe, expect, it } from "vitest";

import { sha256 } from "../expert-capability/hashing";
import {
  computeOperatingRelationEdgeContentHash,
  computeTemporalOperatingContextSnapshotContentHash,
  operatingRelationIdFromContentHash,
} from "./context-contracts";
import {
  computeBusinessObjectAliasContentHash,
  computeEvidenceBindingRootHash,
  computeEvidenceRefContentHash,
  computeJudgementPacketContentHash,
  computeSignalEventContentHash,
  type BusinessObjectAlias,
  type EvidenceRef,
  type JudgementPacket,
  type SignalEvent,
} from "./contracts";
import {
  syntheticEvalCasePromotion,
  syntheticEvidenceRef,
  syntheticSignalEvent,
} from "./fixtures";
import {
  syntheticFleetHarnessSource,
  syntheticHarnessSource,
} from "./harness-fixtures";
import {
  projectTemporalOperatingContext,
  validateTemporalOperatingContextProjectionInput,
  validateTemporalOperatingContextSnapshotBinding,
} from "./context-projector";
import { syntheticTemporalOperatingContextInput } from "./context-fixtures";
import { validateTemporalOperatingContextSnapshot } from "./context-validators";

function restampEvidenceRef(evidence: EvidenceRef): void {
  const { contentHash: _contentHash, ...content } = evidence;
  evidence.contentHash = computeEvidenceRefContentHash(content);
}

function restampBusinessObjectAlias(alias: BusinessObjectAlias): void {
  const { contentHash: _contentHash, ...content } = alias;
  alias.contentHash = computeBusinessObjectAliasContentHash(content);
}

function restampSignalEvent(signal: SignalEvent): void {
  const { contentHash: _contentHash, ...content } = signal;
  signal.contentHash = computeSignalEventContentHash(content);
}

function restampJudgementPacket(packet: JudgementPacket): void {
  const { contentHash: _contentHash, ...content } = packet;
  packet.contentHash = computeJudgementPacketContentHash(content);
}

function restampContextSnapshot(
  snapshot: NonNullable<
    ReturnType<typeof projectTemporalOperatingContext>["snapshot"]
  >,
): void {
  const { contentHash: _contentHash, ...content } = snapshot;
  snapshot.contentHash =
    computeTemporalOperatingContextSnapshotContentHash(content);
}

function syntheticSourceBinding(signalId: string) {
  const source = syntheticHarnessSource();
  return {
    source: {
      ...source,
      signalId,
      auditRefs: [`audit:${signalId.replaceAll(":", "-")}`],
    },
    promotion: null,
  };
}

describe("operating harness P3a temporal context model", () => {
  it("projects a content-bound, derived-only context snapshot", () => {
    const input = syntheticTemporalOperatingContextInput();
    const result = projectTemporalOperatingContext(input);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.derivedOnly).toBe(true);
    expect(result.snapshot?.canonicalStateAuthority).toBe(false);
    expect(result.snapshot?.writebackAllowed).toBe(false);
    expect(result.snapshot?.actionAuthority).toBe("none");
    expect(result.snapshot?.modelCallsUsed).toBe(false);
    expect(result.snapshot?.objectSummaries).toHaveLength(3);
    expect(result.snapshot?.relations.map((edge) => edge.relationKind)).toEqual(
      expect.arrayContaining([
        "shared_evidence",
        "shared_source_object",
        "source_temporal_sequence",
      ]),
    );
    expect(validateTemporalOperatingContextSnapshot(result.snapshot)).toEqual({
      ok: true,
      errors: [],
    });
    expect(
      validateTemporalOperatingContextSnapshotBinding({
        input,
        snapshot: result.snapshot,
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it("is replay-stable when canonical inputs arrive in a different order", () => {
    const input = syntheticTemporalOperatingContextInput();
    const reordered = structuredClone(input);
    reordered.signalEvents.reverse();
    reordered.evidenceRefs.reverse();
    reordered.businessObjectAliases.reverse();
    reordered.judgementPackets.reverse();
    reordered.sourceBindings.reverse();

    const first = projectTemporalOperatingContext(input);
    const replay = projectTemporalOperatingContext(reordered);

    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    expect(replay.snapshot?.replayRootHash).toBe(
      first.snapshot?.replayRootHash,
    );
    expect(replay.snapshot?.contentHash).toBe(first.snapshot?.contentHash);
    expect(replay.snapshot).toEqual(first.snapshot);
  });

  it("fails closed on cross-tenant, raw, or fleet source input", () => {
    const crossTenant = syntheticTemporalOperatingContextInput();
    crossTenant.businessObjectAliases[0].tenantScopeRef = "tenant:synthetic-2";
    restampBusinessObjectAlias(crossTenant.businessObjectAliases[0]);

    const raw = syntheticTemporalOperatingContextInput();
    (raw.evidenceRefs[0] as unknown as Record<string, unknown>).rawPayload =
      "private source body";

    const fleet = syntheticTemporalOperatingContextInput();
    fleet.sourceBindings[0] = {
      source: {
        ...syntheticFleetHarnessSource(),
        signalId: fleet.signalEvents[0].signalId,
      },
      promotion: null,
    };

    expect(
      validateTemporalOperatingContextProjectionInput(crossTenant).errors,
    ).toContain(
      `business_object_tenant_scope_mismatch:${crossTenant.businessObjectAliases[0].aliasRef}`,
    );
    expect(
      validateTemporalOperatingContextProjectionInput(raw).errors,
    ).toContain("forbidden_key_present:rawPayload");
    expect(
      validateTemporalOperatingContextProjectionInput(fleet).errors,
    ).toContain(
      "source_gate:source_class_forbidden_from_improvement_loop:fleet_customer_health",
    );
  });

  it("rejects out-of-window signals and disconnected judgement evidence", () => {
    const outside = syntheticTemporalOperatingContextInput();
    outside.signalEvents[0].observedAt = "2026-06-01T00:00:00.000Z";
    restampSignalEvent(outside.signalEvents[0]);

    const disconnected = syntheticTemporalOperatingContextInput();
    disconnected.judgementPackets[0].evidenceRefs = ["evidence:not-attached"];
    restampJudgementPacket(disconnected.judgementPackets[0]);

    expect(
      validateTemporalOperatingContextProjectionInput(outside).errors,
    ).toContain(
      `signal_outside_context_window:${outside.signalEvents[0].signalId}`,
    );
    expect(
      validateTemporalOperatingContextProjectionInput(disconnected).errors,
    ).toContain(
      `judgement_evidence_not_bound:${disconnected.judgementPackets[0].packetId}:evidence:not-attached`,
    );
  });

  it("rejects evidence substitution even when the replacement receipt is self-consistent", () => {
    const input = syntheticTemporalOperatingContextInput();
    const evidence = input.evidenceRefs[0];
    evidence.sourceSnapshotHash = sha256("replacement evidence snapshot");
    restampEvidenceRef(evidence);

    expect(
      validateTemporalOperatingContextProjectionInput(input).errors,
    ).toEqual(
      expect.arrayContaining([
        `signal_evidence_root_hash_mismatch:${input.signalEvents[0].signalId}`,
      ]),
    );
  });

  it("surfaces deterministic judgement conflict and staleness without making them facts", () => {
    const input = syntheticTemporalOperatingContextInput();
    const conflicting = structuredClone(input.judgementPackets[1]);
    conflicting.packetId = "packet:delivery-conflict";
    conflicting.disposition = "hold_for_evidence";
    restampJudgementPacket(conflicting);
    input.judgementPackets.push(conflicting);
    input.asOf = "2026-09-30T00:00:00.000Z";

    const result = projectTemporalOperatingContext(input);
    const delivery = result.snapshot?.objectSummaries.find(
      (summary) => summary.objectKind === "delivery",
    );

    expect(result.ok).toBe(true);
    expect(delivery?.judgementState).toBe("conflicting_dispositions");
    expect(delivery?.staleness).toBe("stale");
    expect(result.snapshot?.canonicalStateAuthority).toBe(false);
  });

  it("rejects restamped authority and writeback claims", () => {
    const projected = projectTemporalOperatingContext(
      syntheticTemporalOperatingContextInput(),
    );
    if (!projected.snapshot) throw new Error("expected projected snapshot");
    const unsafe = {
      ...projected.snapshot,
      canonicalStateAuthority: true,
      writebackAllowed: true,
      actionAuthority: "execute",
    };

    expect(validateTemporalOperatingContextSnapshot(unsafe).errors).toEqual(
      expect.arrayContaining([
        "context_snapshot_content_hash_mismatch",
        "invalid_context_snapshot:canonicalStateAuthority:invalid_value",
        "invalid_context_snapshot:writebackAllowed:invalid_value",
        "invalid_context_snapshot:actionAuthority:invalid_value",
      ]),
    );
  });

  it("detects a snapshot replayed against changed canonical input", () => {
    const input = syntheticTemporalOperatingContextInput();
    const projected = projectTemporalOperatingContext(input);
    const changed = syntheticTemporalOperatingContextInput();
    changed.workspaceAlias = "workspace:synthetic-other";

    expect(
      validateTemporalOperatingContextSnapshotBinding({
        input: changed,
        snapshot: projected.snapshot,
      }).errors,
    ).toContain("context_snapshot_not_reproducible_from_input");
  });

  it("fails closed on malformed record and source elements without throwing", () => {
    const malformedSignal = {
      ...syntheticTemporalOperatingContextInput(),
      signalEvents: [null],
    };
    const malformedSource = {
      ...syntheticTemporalOperatingContextInput(),
      sourceBindings: [{ source: null, promotion: null }],
    };

    expect(() =>
      validateTemporalOperatingContextProjectionInput(malformedSignal),
    ).not.toThrow();
    expect(
      validateTemporalOperatingContextProjectionInput(malformedSignal),
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "invalid_context_projection_input:signalEvents.0:invalid_type",
      ]),
    });
    expect(() =>
      validateTemporalOperatingContextProjectionInput(malformedSource),
    ).not.toThrow();
    expect(
      validateTemporalOperatingContextProjectionInput(malformedSource),
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "invalid_context_projection_input:sourceBindings.0.source:invalid_type",
      ]),
    });
  });

  it("rejects impossible temporal ordering before projection", () => {
    const expiredBeforeCapture = syntheticTemporalOperatingContextInput();
    expiredBeforeCapture.evidenceRefs[0].expiresAt = "2026-07-01T00:00:00.000Z";
    restampEvidenceRef(expiredBeforeCapture.evidenceRefs[0]);

    const capturedBeforeObserved = syntheticTemporalOperatingContextInput();
    capturedBeforeObserved.signalEvents[0].capturedAt =
      "2026-07-01T00:00:00.000Z";
    restampSignalEvent(capturedBeforeObserved.signalEvents[0]);

    const judgementBeforeSignal = syntheticTemporalOperatingContextInput();
    judgementBeforeSignal.judgementPackets[0].createdAt =
      "2026-07-01T00:00:00.000Z";
    restampJudgementPacket(judgementBeforeSignal.judgementPackets[0]);

    expect(
      validateTemporalOperatingContextProjectionInput(expiredBeforeCapture)
        .errors,
    ).toContain(
      `evidence_expires_before_capture:${expiredBeforeCapture.evidenceRefs[0].evidenceRef}`,
    );
    expect(
      validateTemporalOperatingContextProjectionInput(capturedBeforeObserved)
        .errors,
    ).toContain(
      `signal_captured_before_observed:${capturedBeforeObserved.signalEvents[0].signalId}`,
    );
    expect(
      validateTemporalOperatingContextProjectionInput(judgementBeforeSignal)
        .errors,
    ).toContain(
      `judgement_created_before_signal:${judgementBeforeSignal.judgementPackets[0].packetId}:${judgementBeforeSignal.judgementPackets[0].signalEventRefs[0]}`,
    );
  });

  it("keeps binding validators total for cyclic and non-JSON snapshots", () => {
    const input = syntheticTemporalOperatingContextInput();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const nonJson = {
      contentHash: `sha256:${"0".repeat(64)}`,
      unsupported: 1n,
    };

    expect(() =>
      validateTemporalOperatingContextSnapshotBinding({
        input,
        snapshot: cyclic,
      }),
    ).not.toThrow();
    expect(
      validateTemporalOperatingContextSnapshotBinding({
        input,
        snapshot: cyclic,
      }).errors,
    ).toContain("input_graph_contains_reused_reference");
    expect(() =>
      validateTemporalOperatingContextSnapshot(nonJson),
    ).not.toThrow();
    expect(validateTemporalOperatingContextSnapshot(nonJson).errors).toContain(
      "context_snapshot_content_not_hashable",
    );
  });

  it("validates snapshot-derived self-consistency before replay binding", () => {
    const projected = projectTemporalOperatingContext(
      syntheticTemporalOperatingContextInput(),
    );
    if (!projected.snapshot) throw new Error("expected projected snapshot");

    const wrongState = structuredClone(projected.snapshot);
    wrongState.objectSummaries[0].judgementState = "conflicting_dispositions";
    restampContextSnapshot(wrongState);

    const wrongStaleness = structuredClone(projected.snapshot);
    wrongStaleness.objectSummaries[0].staleness = "stale";
    restampContextSnapshot(wrongStaleness);

    const missingReceipt = structuredClone(projected.snapshot);
    const removedSignalId = missingReceipt.sourceReceipts[0].signalId;
    missingReceipt.sourceReceipts.shift();
    restampContextSnapshot(missingReceipt);

    const fabricatedRelation = structuredClone(projected.snapshot);
    const edge = fabricatedRelation.relations.find(
      (item) => item.relationKind === "shared_evidence",
    );
    if (!edge) throw new Error("expected shared evidence relation");
    edge.supportingEvidenceRefs = ["evidence:delivery-watch-17"];
    const {
      relationId: _relationId,
      contentHash: _edgeHash,
      ...edgeContent
    } = edge;
    edge.contentHash = computeOperatingRelationEdgeContentHash(edgeContent);
    edge.relationId = operatingRelationIdFromContentHash(edge.contentHash);
    fabricatedRelation.relations.sort((left, right) =>
      left.relationId.localeCompare(right.relationId),
    );
    restampContextSnapshot(fabricatedRelation);

    expect(
      validateTemporalOperatingContextSnapshot(wrongState).errors,
    ).toContain(
      `context_summary_judgement_state_mismatch:${wrongState.objectSummaries[0].businessObjectAliasRef}`,
    );
    expect(
      validateTemporalOperatingContextSnapshot(wrongStaleness).errors,
    ).toContain(
      `context_summary_staleness_mismatch:${wrongStaleness.objectSummaries[0].businessObjectAliasRef}`,
    );
    expect(
      validateTemporalOperatingContextSnapshot(missingReceipt).errors,
    ).toContain(`context_source_receipt_missing:${removedSignalId}`);
    expect(
      validateTemporalOperatingContextSnapshot(fabricatedRelation).errors,
    ).toContain(
      `context_shared_evidence_not_supported_by_endpoint_intersection:${edge.relationId}`,
    );
  });

  it("limits shared-evidence provenance to signals that carry the shared evidence", () => {
    const input = syntheticTemporalOperatingContextInput();
    const extraEvidence = syntheticEvidenceRef({
      evidenceRef: "evidence:account-unrelated-17",
      sourceSnapshotHash: sha256("synthetic account unrelated 17"),
      capturedAt: "2026-07-30T09:00:00.000Z",
    });
    const extraSignal = syntheticSignalEvent({
      signalId: "signal:account-unrelated-17",
      signalKey: "notice:account-unrelated-17",
      sourceEnvelopeRef: "source-envelope:account-unrelated-17",
      sourceRef: "source:synthetic-unrelated-feed",
      signalFamily: "notice",
      observedAt: "2026-07-30T09:00:00.000Z",
      capturedAt: "2026-07-30T09:00:00.000Z",
      evidenceRefs: [extraEvidence.evidenceRef],
      evidenceRootHash: sha256("placeholder"),
      businessObjectAliasRef: "object:account-alias-17",
    });
    extraSignal.evidenceRootHash = computeEvidenceBindingRootHash([
      extraEvidence,
    ]);
    restampSignalEvent(extraSignal);
    input.evidenceRefs.push(extraEvidence);
    input.signalEvents.push(extraSignal);
    input.sourceBindings.push(syntheticSourceBinding(extraSignal.signalId));

    const projected = projectTemporalOperatingContext(input);
    const relation = projected.snapshot?.relations.find(
      (item) =>
        item.relationKind === "shared_evidence" &&
        item.fromBusinessObjectAliasRef === "object:account-alias-17" &&
        item.toBusinessObjectAliasRef === "object:deal-alias-17",
    );

    expect(projected.ok).toBe(true);
    expect(relation?.supportingSignalEventRefs).not.toContain(
      extraSignal.signalId,
    );
    expect(relation?.validTo).toBe("2026-07-05T09:00:00.000Z");
  });

  it("orders mixed-offset timestamps by instant instead of string form", () => {
    const input = syntheticTemporalOperatingContextInput();
    input.signalEvents[0].observedAt = "2026-07-02T09:00:00+08:00";
    input.signalEvents[0].capturedAt = "2026-07-02T09:00:00+08:00";
    restampSignalEvent(input.signalEvents[0]);

    const laterSignal = structuredClone(input.signalEvents[0]);
    laterSignal.signalId = "signal:account-health-later-17";
    laterSignal.signalKey = "health:account-alias-later-17";
    laterSignal.sourceEnvelopeRef = "source-envelope:account-health-later-17";
    laterSignal.sourceRef = "source:synthetic-offset-feed";
    laterSignal.observedAt = "2026-07-02T02:00:00.000Z";
    laterSignal.capturedAt = "2026-07-02T02:00:00.000Z";
    restampSignalEvent(laterSignal);
    input.signalEvents.push(laterSignal);
    input.sourceBindings.push(syntheticSourceBinding(laterSignal.signalId));

    const projected = projectTemporalOperatingContext(input);
    const account = projected.snapshot?.objectSummaries.find(
      (summary) => summary.businessObjectAliasRef === "object:account-alias-17",
    );

    expect(projected.ok).toBe(true);
    expect(account?.firstObservedAt).toBe("2026-07-02T09:00:00+08:00");
    expect(account?.latestObservedAt).toBe("2026-07-02T02:00:00.000Z");
  });

  it("rejects a promotion attached to a source class that does not require one", () => {
    const input = syntheticTemporalOperatingContextInput();
    input.sourceBindings[0].promotion = syntheticEvalCasePromotion({
      sourceCaseId: input.sourceBindings[0].source.signalId,
    });

    expect(
      validateTemporalOperatingContextProjectionInput(input).errors,
    ).toContain(
      `unexpected_eval_case_promotion:synthetic_public:${input.sourceBindings[0].source.signalId}`,
    );
  });
});
