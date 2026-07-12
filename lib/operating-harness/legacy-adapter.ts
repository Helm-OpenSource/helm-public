import type { OperatingSignalFlowEvent } from "../operating-signal-flow/contract";
import type { BusinessObjectAlias, EvidenceRef, SignalEvent } from "./contracts";
import {
  SIGNAL_EVENT_SCHEMA_VERSION,
  computeEvidenceBindingRootHash,
  computeSignalEventContentHash,
} from "./contracts";
import {
  assertValidBusinessObjectAlias,
  assertValidEvidenceRef,
  assertValidSignalEvent,
} from "./validators";

export type LegacyOperatingSignalFlowAdapterInput = {
  event: OperatingSignalFlowEvent;
  workspaceBinding: {
    legacyWorkspaceId: string;
    tenantScopeRef: string;
    sourceEnvelopeRef: string;
  };
  capturedAt: string;
  evidenceRefs: EvidenceRef[];
  businessObjectAlias: BusinessObjectAlias | null;
};

export type LegacyOperatingSignalFlowAdapterResult = {
  signalEvent: SignalEvent;
  evidenceRefs: EvidenceRef[];
  businessObjectAlias: BusinessObjectAlias | null;
  legacyWorkspaceBinding: LegacyOperatingSignalFlowAdapterInput["workspaceBinding"];
  ignoredLegacyState: {
    transitionFrom: OperatingSignalFlowEvent["transitionFrom"];
    transitionTo: OperatingSignalFlowEvent["transitionTo"];
    currentBlockerType: OperatingSignalFlowEvent["currentBlockerType"];
  };
};

export function adaptOperatingSignalFlowEvent(
  input: LegacyOperatingSignalFlowAdapterInput,
): LegacyOperatingSignalFlowAdapterResult {
  if (input.event.redactionStatus === "raw_blocked") {
    throw new Error("raw_blocked_legacy_signal_forbidden");
  }
  if (input.event.crossTenantProjection) {
    throw new Error("cross_tenant_legacy_signal_forbidden");
  }
  if (input.event.workspaceId !== input.workspaceBinding.legacyWorkspaceId) {
    throw new Error(`legacy_workspace_binding_mismatch:${input.event.workspaceId}`);
  }
  const observedAtMs = Date.parse(input.event.occurredAt);
  const capturedAtMs = Date.parse(input.capturedAt);
  if (!Number.isFinite(observedAtMs)) throw new Error("invalid_legacy_observed_at");
  if (!Number.isFinite(capturedAtMs)) throw new Error("invalid_legacy_captured_at");
  if (capturedAtMs < observedAtMs) {
    throw new Error("legacy_signal_captured_before_observed");
  }

  const { tenantScopeRef, sourceEnvelopeRef } = input.workspaceBinding;

  for (const item of input.evidenceRefs) {
    assertValidEvidenceRef(item);
    if (item.tenantScopeRef !== tenantScopeRef) {
      throw new Error(`evidence_tenant_scope_mismatch:${item.evidenceRef}`);
    }
  }
  if (input.businessObjectAlias) {
    assertValidBusinessObjectAlias(input.businessObjectAlias);
    if (input.businessObjectAlias.tenantScopeRef !== tenantScopeRef) {
      throw new Error("business_object_alias_tenant_scope_mismatch");
    }
  }

  const canonicalEvidenceByRef = new Map<string, EvidenceRef>();
  for (const evidence of input.evidenceRefs) {
    if (canonicalEvidenceByRef.has(evidence.evidenceRef)) {
      throw new Error(`duplicate_canonical_evidence_ref:${evidence.evidenceRef}`);
    }
    canonicalEvidenceByRef.set(evidence.evidenceRef, evidence);
  }
  for (const ref of input.event.evidenceRefs) {
    if (!canonicalEvidenceByRef.has(ref)) {
      throw new Error(`missing_canonical_evidence_ref:${ref}`);
    }
  }

  if (input.event.objectRef && !input.businessObjectAlias) {
    throw new Error("legacy_object_requires_business_object_alias");
  }
  if (
    input.event.objectRef &&
    input.businessObjectAlias &&
    !input.businessObjectAlias.sourceObjectAliasRefs.includes(input.event.objectRef)
  ) {
    throw new Error(`legacy_object_alias_mismatch:${input.event.objectRef}`);
  }
  if (
    input.event.objectKind &&
    input.businessObjectAlias &&
    input.businessObjectAlias.objectKind.toLowerCase() !==
      input.event.objectKind.toLowerCase()
  ) {
    throw new Error(`legacy_object_kind_mismatch:${input.event.objectKind}`);
  }

  const content = {
    schemaVersion: SIGNAL_EVENT_SCHEMA_VERSION,
    signalId: input.event.id,
    signalKey: input.event.signalKey,
    tenantScopeRef,
    sourceEnvelopeRef,
    sourceRef: input.event.sourceRef,
    signalFamily: input.event.signalFamily,
    observedAt: input.event.occurredAt,
    capturedAt: input.capturedAt,
    evidenceRefs: [...input.event.evidenceRefs],
    evidenceRootHash: computeEvidenceBindingRootHash(
      input.event.evidenceRefs.map((ref) => canonicalEvidenceByRef.get(ref)!),
    ),
    businessObjectAliasRef: input.businessObjectAlias?.aliasRef ?? null,
    redactionStatus: input.event.redactionStatus,
    boundaryNote: input.event.boundaryNote,
  };
  const signalEvent: SignalEvent = {
    ...content,
    contentHash: computeSignalEventContentHash(content),
  };
  assertValidSignalEvent(signalEvent);

  return {
    signalEvent,
    evidenceRefs: [...input.evidenceRefs],
    businessObjectAlias: input.businessObjectAlias,
    legacyWorkspaceBinding: { ...input.workspaceBinding },
    ignoredLegacyState: {
      transitionFrom: input.event.transitionFrom,
      transitionTo: input.event.transitionTo,
      currentBlockerType: input.event.currentBlockerType,
    },
  };
}
