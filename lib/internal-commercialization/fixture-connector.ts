import fixturePack from "@/evals/internal-commercialization/offer-path-cases.json";
import type {
  InternalCommercializationCase,
  InternalCommercializationFixturePack,
} from "@/lib/evals/internal-commercialization-evals";
import { db } from "@/lib/db";
import {
  assertInternalCommercializationAliasOnly,
  assertInternalCommercializationReviewSafeAction,
  INTERNAL_COMMERCIALIZATION_FIXTURE_CONNECTOR_ID,
  normalizeInternalCommercializationChannelGateLevel,
  normalizeInternalCommercializationDecision,
  normalizeInternalCommercializationLifecycleState,
  normalizeInternalCommercializationOfferStage,
  normalizeInternalCommercializationProviderType,
  normalizeInternalCommercializationReviewSafeAction,
} from "@/lib/internal-commercialization/contract";

export type InternalCommercializationConnectorRecord = ReturnType<
  typeof buildConnectorRecordFromCase
>;

function encodeJson(value: unknown) {
  assertInternalCommercializationAliasOnly(value, "connector payload");
  return JSON.stringify(value);
}

function buildConnectorRecordFromCase(item: InternalCommercializationCase) {
  assertInternalCommercializationAliasOnly(item, item.caseId);
  assertInternalCommercializationReviewSafeAction(item.expectedNextAction);

  if (item.helmDirectCustomerContactAllowed) {
    throw new Error(
      `${item.caseId} grants direct customer contact; fixture connector only accepts service-provider-managed cases.`,
    );
  }

  if (
    item.externalSideEffectAllowed ||
    item.officialCommitmentAllowed ||
    item.publicClaimAllowed ||
    item.customerVisibleWithoutReview ||
    item.rawPiiIncluded
  ) {
    throw new Error(
      `${item.caseId} violates internal commercialization boundary flags.`,
    );
  }

  return {
    lifecycleRunId: item.lifecycleRunId,
    providerAliasId: item.providerAliasId,
    providerType: normalizeInternalCommercializationProviderType(
      item.providerType,
    ),
    title: item.aliasId,
    sourceFixtureId: item.caseId,
    currentState: normalizeInternalCommercializationLifecycleState(
      item.currentLifecycleState,
    ),
    nextState: normalizeInternalCommercializationLifecycleState(
      item.nextLifecycleState,
    ),
    decision: normalizeInternalCommercializationDecision(item.expectedDecision),
    expectedOfferStage: normalizeInternalCommercializationOfferStage(
      item.expectedOfferStage,
    ),
    nextAction: normalizeInternalCommercializationReviewSafeAction(
      item.expectedNextAction,
    ),
    ownerAlias: item.ownerAlias,
    reviewerAlias: item.reviewerAlias,
    customerOpportunityAliasIds: encodeJson(item.customerOpportunityAliasIds),
    evidenceRefs: encodeJson(item.evidenceRefs),
    requiredEvidenceKinds: encodeJson(item.requiredEvidenceKinds),
    riskTags: encodeJson(item.riskTags),
    commercialSignalsJson: encodeJson(item.commercialSignals),
    channelGateLevel: normalizeInternalCommercializationChannelGateLevel(
      item.channelGateLevel,
    ),
    managingThroughServiceProvider: item.managingThroughServiceProvider,
    serviceProviderCustomerFacingOwner:
      item.serviceProviderCustomerFacingOwner,
    helmDirectCustomerContactAllowed: item.helmDirectCustomerContactAllowed,
    stageReviewPacketRequired: item.stageReviewPacketRequired,
    reviewStaleHours: item.reviewStaleHours,
    outcomeWindowHours: item.outcomeWindowHours,
    safeSampleAvailable: item.safeSampleAvailable,
    acceptedReviewFirst: item.acceptedReviewFirst,
    requiresReview: item.requiresReview,
    channelAssessmentRequired: item.channelAssessmentRequired,
    externalSideEffectAllowed: item.externalSideEffectAllowed,
    officialCommitmentAllowed: item.officialCommitmentAllowed,
    publicClaimAllowed: item.publicClaimAllowed,
    customerVisibleWithoutReview: item.customerVisibleWithoutReview,
    rawPiiIncluded: item.rawPiiIncluded,
  };
}

export function buildInternalCommercializationConnectorRecords(
  pack: InternalCommercializationFixturePack =
    fixturePack as InternalCommercializationFixturePack,
) {
  if (pack.targetTenantKey !== "helm-business-development") {
    throw new Error(
      `Internal commercialization fixture connector only accepts helm-business-development, received ${pack.targetTenantKey}.`,
    );
  }

  return pack.cases.map(buildConnectorRecordFromCase);
}

export async function runInternalCommercializationFixtureConnector({
  workspaceId,
  dryRun = true,
}: {
  workspaceId: string;
  dryRun?: boolean;
}) {
  const records = buildInternalCommercializationConnectorRecords();

  if (dryRun) {
    return {
      connectorId: INTERNAL_COMMERCIALIZATION_FIXTURE_CONNECTOR_ID,
      dryRun,
      importedCount: 0,
      candidateCount: records.length,
      records,
    };
  }

  const upserted = await db.$transaction(
    records.map((record) =>
      db.internalCommercializationRun.upsert({
        where: {
          workspaceId_lifecycleRunId: {
            workspaceId,
            lifecycleRunId: record.lifecycleRunId,
          },
        },
        create: {
          workspaceId,
          ...record,
        },
        update: record,
      }),
    ),
  );

  return {
    connectorId: INTERNAL_COMMERCIALIZATION_FIXTURE_CONNECTOR_ID,
    dryRun,
    importedCount: upserted.length,
    candidateCount: records.length,
    records: upserted,
  };
}
