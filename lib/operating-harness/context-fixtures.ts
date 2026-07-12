import { sha256 } from "../expert-capability/hashing";
import {
  TEMPORAL_OPERATING_CONTEXT_INPUT_SCHEMA_VERSION,
  type TemporalOperatingContextProjectionInput,
} from "./context-contracts";
import { computeEvidenceBindingRootHash } from "./contracts";
import {
  TEMPORAL_CONTEXT_GOLDEN_PACK_SCHEMA_VERSION,
  computeTemporalContextGoldenPackContentHash,
  type TemporalContextGoldenPack,
} from "./context-eval";
import {
  syntheticBusinessObjectAlias,
  syntheticEvidenceRef,
  syntheticJudgementPacket,
  syntheticSignalEvent,
} from "./fixtures";
import {
  syntheticHarnessPair,
  syntheticHarnessSource,
} from "./harness-fixtures";

const WINDOW_START = "2026-07-01T00:00:00.000Z";
const WINDOW_END = "2026-07-31T23:59:59.000Z";
const AS_OF = "2026-08-01T00:00:00.000Z";

function sourceBinding(signalId: string) {
  const source = syntheticHarnessSource();
  return {
    source: {
      ...source,
      signalId,
      auditRefs: [`audit:${signalId.replaceAll(":", "-")}`],
      boundaryNote:
        "Synthetic public context input; advice only and no action authority.",
    },
    promotion: null,
  };
}

export function syntheticTemporalOperatingContextInput(): TemporalOperatingContextProjectionInput {
  const { baselineManifest, baselineRevision } = syntheticHarnessPair();

  const accountEvidence = syntheticEvidenceRef({
    evidenceRef: "evidence:account-health-17",
    sourceSnapshotHash: sha256("synthetic account health 17"),
    capturedAt: "2026-07-02T09:00:00.000Z",
  });
  const dealEvidence = syntheticEvidenceRef({
    evidenceRef: "evidence:deal-risk-17",
    sourceSnapshotHash: sha256("synthetic deal risk 17"),
    capturedAt: "2026-07-05T09:00:00.000Z",
  });
  const deliveryEvidence = syntheticEvidenceRef({
    evidenceRef: "evidence:delivery-watch-17",
    sourceSnapshotHash: sha256("synthetic delivery watch 17"),
    capturedAt: "2026-07-10T09:00:00.000Z",
  });

  const accountAlias = syntheticBusinessObjectAlias({
    aliasRef: "object:account-alias-17",
    objectKind: "account",
    sourceObjectAliasRefs: ["source-object:crm-account-17"],
    createdAt: "2026-07-02T09:00:00.000Z",
  });
  const dealAlias = syntheticBusinessObjectAlias({
    aliasRef: "object:deal-alias-17",
    objectKind: "deal",
    sourceObjectAliasRefs: [
      "source-object:crm-account-17",
      "source-object:crm-deal-17",
    ],
    createdAt: "2026-07-05T09:00:00.000Z",
  });
  const deliveryAlias = syntheticBusinessObjectAlias({
    aliasRef: "object:delivery-alias-17",
    objectKind: "delivery",
    sourceObjectAliasRefs: ["source-object:delivery-17"],
    createdAt: "2026-07-10T09:00:00.000Z",
  });

  const accountSignal = syntheticSignalEvent({
    signalId: "signal:account-health-17",
    signalKey: "health:account-alias-17",
    sourceEnvelopeRef: "source-envelope:account-health-17",
    sourceRef: "source:synthetic-operating-feed",
    signalFamily: "health",
    observedAt: "2026-07-02T09:00:00.000Z",
    capturedAt: "2026-07-02T09:00:00.000Z",
    evidenceRefs: [accountEvidence.evidenceRef],
    evidenceRootHash: computeEvidenceBindingRootHash([accountEvidence]),
    businessObjectAliasRef: accountAlias.aliasRef,
  });
  const dealSignal = syntheticSignalEvent({
    signalId: "signal:deal-risk-17",
    signalKey: "risk:deal-alias-17",
    sourceEnvelopeRef: "source-envelope:deal-risk-17",
    sourceRef: "source:synthetic-operating-feed",
    signalFamily: "risk",
    observedAt: "2026-07-05T09:00:00.000Z",
    capturedAt: "2026-07-05T09:00:00.000Z",
    evidenceRefs: [accountEvidence.evidenceRef, dealEvidence.evidenceRef],
    evidenceRootHash: computeEvidenceBindingRootHash([
      accountEvidence,
      dealEvidence,
    ]),
    businessObjectAliasRef: dealAlias.aliasRef,
  });
  const deliverySignal = syntheticSignalEvent({
    signalId: "signal:delivery-watch-17",
    signalKey: "watch:delivery-alias-17",
    sourceEnvelopeRef: "source-envelope:delivery-watch-17",
    sourceRef: "source:synthetic-operating-feed",
    signalFamily: "delivery_watch",
    observedAt: "2026-07-10T09:00:00.000Z",
    capturedAt: "2026-07-10T09:00:00.000Z",
    evidenceRefs: [dealEvidence.evidenceRef, deliveryEvidence.evidenceRef],
    evidenceRootHash: computeEvidenceBindingRootHash([
      dealEvidence,
      deliveryEvidence,
    ]),
    businessObjectAliasRef: deliveryAlias.aliasRef,
  });

  const accountPacket = syntheticJudgementPacket({
    packetId: "packet:account-health-17",
    inputSnapshotRef: sha256("synthetic account context input"),
    signalEventRefs: [accountSignal.signalId],
    businessObjectAliasRef: accountAlias.aliasRef,
    disposition: "needs_attention",
    evidenceRefs: [accountEvidence.evidenceRef],
    createdAt: "2026-07-12T09:00:00.000Z",
  });
  const deliveryPacket = syntheticJudgementPacket({
    packetId: "packet:delivery-watch-17",
    inputSnapshotRef: sha256("synthetic delivery context input"),
    signalEventRefs: [deliverySignal.signalId],
    businessObjectAliasRef: deliveryAlias.aliasRef,
    disposition: "monitor_delivery",
    evidenceRefs: [dealEvidence.evidenceRef, deliveryEvidence.evidenceRef],
    createdAt: "2026-07-12T09:00:00.000Z",
  });
  const dealPacket = syntheticJudgementPacket({
    packetId: "packet:deal-risk-17",
    inputSnapshotRef: sha256("synthetic deal context input"),
    signalEventRefs: [dealSignal.signalId],
    businessObjectAliasRef: dealAlias.aliasRef,
    disposition: "prepare_review_packet",
    evidenceRefs: [accountEvidence.evidenceRef, dealEvidence.evidenceRef],
    createdAt: "2026-07-12T09:00:00.000Z",
  });

  return {
    schemaVersion: TEMPORAL_OPERATING_CONTEXT_INPUT_SCHEMA_VERSION,
    workspaceAlias: "workspace:synthetic-operating-context",
    tenantScopeRef: "tenant:synthetic-1",
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    asOf: AS_OF,
    manifest: baselineManifest,
    revision: baselineRevision,
    signalEvents: [accountSignal, dealSignal, deliverySignal],
    evidenceRefs: [accountEvidence, dealEvidence, deliveryEvidence],
    businessObjectAliases: [accountAlias, dealAlias, deliveryAlias],
    judgementPackets: [accountPacket, deliveryPacket, dealPacket],
    sourceBindings: [
      sourceBinding(accountSignal.signalId),
      sourceBinding(dealSignal.signalId),
      sourceBinding(deliverySignal.signalId),
    ],
  };
}

export function syntheticTemporalContextGoldenPack(): TemporalContextGoldenPack {
  const content = {
    schemaVersion: TEMPORAL_CONTEXT_GOLDEN_PACK_SCHEMA_VERSION,
    goldenPackId: "goldens:synthetic-operating-context-v1",
    evaluationMode: "synthetic_contract_eval" as const,
    sourceClass: "synthetic_public" as const,
    empiricalGeneralizationClaimed: false as const,
    expectedSignalRefs: [
      "signal:account-health-17",
      "signal:deal-risk-17",
      "signal:delivery-watch-17",
    ],
    expectedObjects: [
      {
        businessObjectAliasRef: "object:account-alias-17",
        objectKind: "account",
        judgementState: "single_disposition" as const,
        staleness: "current" as const,
        expectedEvidenceRefs: ["evidence:account-health-17"],
      },
      {
        businessObjectAliasRef: "object:deal-alias-17",
        objectKind: "deal",
        judgementState: "single_disposition" as const,
        staleness: "current" as const,
        expectedEvidenceRefs: [
          "evidence:account-health-17",
          "evidence:deal-risk-17",
        ],
      },
      {
        businessObjectAliasRef: "object:delivery-alias-17",
        objectKind: "delivery",
        judgementState: "single_disposition" as const,
        staleness: "current" as const,
        expectedEvidenceRefs: [
          "evidence:deal-risk-17",
          "evidence:delivery-watch-17",
        ],
      },
    ],
    expectedRelations: [
      {
        relationKind: "shared_evidence" as const,
        fromBusinessObjectAliasRef: "object:account-alias-17",
        toBusinessObjectAliasRef: "object:deal-alias-17",
        requiredSignalEventRefs: [
          "signal:account-health-17",
          "signal:deal-risk-17",
        ],
        expectedEvidenceRefs: ["evidence:account-health-17"],
      },
      {
        relationKind: "shared_source_object" as const,
        fromBusinessObjectAliasRef: "object:account-alias-17",
        toBusinessObjectAliasRef: "object:deal-alias-17",
        requiredSignalEventRefs: [
          "signal:account-health-17",
          "signal:deal-risk-17",
        ],
        expectedEvidenceRefs: ["evidence:account-health-17"],
      },
      {
        relationKind: "source_temporal_sequence" as const,
        fromBusinessObjectAliasRef: "object:account-alias-17",
        toBusinessObjectAliasRef: "object:deal-alias-17",
        requiredSignalEventRefs: [
          "signal:account-health-17",
          "signal:deal-risk-17",
        ],
        expectedEvidenceRefs: [
          "evidence:account-health-17",
          "evidence:deal-risk-17",
        ],
      },
      {
        relationKind: "shared_evidence" as const,
        fromBusinessObjectAliasRef: "object:deal-alias-17",
        toBusinessObjectAliasRef: "object:delivery-alias-17",
        requiredSignalEventRefs: [
          "signal:deal-risk-17",
          "signal:delivery-watch-17",
        ],
        expectedEvidenceRefs: ["evidence:deal-risk-17"],
      },
      {
        relationKind: "source_temporal_sequence" as const,
        fromBusinessObjectAliasRef: "object:deal-alias-17",
        toBusinessObjectAliasRef: "object:delivery-alias-17",
        requiredSignalEventRefs: [
          "signal:deal-risk-17",
          "signal:delivery-watch-17",
        ],
        expectedEvidenceRefs: [
          "evidence:account-health-17",
          "evidence:deal-risk-17",
          "evidence:delivery-watch-17",
        ],
      },
    ],
  };
  return {
    ...content,
    contentHash: computeTemporalContextGoldenPackContentHash(content),
  };
}
