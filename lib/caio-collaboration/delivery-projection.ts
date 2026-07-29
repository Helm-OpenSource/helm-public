import {
  WorkBuddyCollaborationError,
} from "./contracts";
import type {
  CaioDeliveryEnvelope,
} from "./delivery-contracts";
import type {
  CaioDeliveryProjectionResolver,
  CaioDeliveryPromptProjection,
} from "./delivery.service";
import {
  projectP1cDeliveryPromptForWorkBuddy,
} from "./remote-projection";
import type {
  WorkBuddyP1cProjectionQueries,
} from "./readonly-handlers";

function localViewProjection(
  envelope: CaioDeliveryEnvelope,
): CaioDeliveryPromptProjection {
  return Object.freeze({
    schemaVersion: "helm.workbuddy-prompt-projection/v1",
    available: false,
    localViewRequired: true,
    source: Object.freeze({ ...envelope.source }),
    reason: "LOCAL_VIEW_REQUIRED",
    boundary: Object.freeze({
      authorityEffect: "none",
      canonicalMutationAuthorityGranted: false,
      rawContentIncluded: false,
      sourcePayloadCopied: false,
      externalExecutionAllowed: false,
    }),
  });
}

export function createWorkBuddyDeliveryProjectionResolver(input: {
  projectionQueries: WorkBuddyP1cProjectionQueries;
}): CaioDeliveryProjectionResolver {
  return async (envelope) => {
    if (
      envelope.source.objectKind !==
      "operating_question_candidate"
    ) {
      return localViewProjection(envelope);
    }
    const source =
      await input.projectionQueries.loadP1cProjectionSource({
        workspaceId: envelope.workspaceId,
        actorUserId: "system:workbuddy-delivery-projector",
        portfolioSequence: envelope.source.objectVersion,
      });
    if (source === null) {
      throw new WorkBuddyCollaborationError(
        "PROJECTION_BLOCKED",
        "The canonical P1C source is unavailable for this delivery.",
      );
    }
    return projectP1cDeliveryPromptForWorkBuddy({
      source,
      envelope,
    });
  };
}
