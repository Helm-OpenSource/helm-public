import "server-only";

import {
  Prisma,
} from "@prisma/client";

import {
  requireWorkBuddyOwnerCeoSnapshot,
  WORKBUDDY_OWNER_MUTATION_CAPABILITY,
} from "@/lib/caio-collaboration/authorization.service";
import type { CanonicalPromptResponseService } from "@/lib/caio-collaboration/canonical-mutation-ports";
import {
  WorkBuddyCollaborationError,
} from "@/lib/caio-collaboration/contracts";
import {
  transitionCaioDeliveryEnvelope,
  type CaioDeliveryEnvelope,
} from "@/lib/caio-collaboration/delivery-contracts";
import {
  promptResponseCommandSchema,
} from "@/lib/caio-collaboration/mutation-commands";
import {
  computeWorkBuddyPromptResponseRequestHash,
  createWorkBuddyPromptResponseReceiptRef,
  promptResponseResultingStatus,
  workBuddyPromptResponseReceiptSchema,
  type WorkBuddyPromptResponseReceipt,
} from "@/lib/caio-collaboration/prompt-response-contracts";
import {
  assertWorkBuddyRequestActive,
} from "@/lib/caio-collaboration/request-cancellation";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";

import {
  envelopeStateWriteData,
  parseStoredClaim,
  parseStoredEnvelope,
} from "./workbuddy-delivery-store.service";
import {
  loadPrismaWorkBuddyAuthorizationSnapshot,
} from "./workbuddy-authorization-queries.service";

type Tx = Prisma.TransactionClient;
type StoredPromptResponseReceiptWithBindings =
  Prisma.WorkBuddyPromptResponseReceiptGetPayload<{
    include: {
      envelope: true;
      deliveryClaim: true;
    };
  }>;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

function parseStoredReceipt(
  row: StoredPromptResponseReceiptWithBindings,
): WorkBuddyPromptResponseReceipt {
  let raw: unknown;
  try {
    raw = JSON.parse(row.receiptJson);
  } catch {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy prompt response receipt is not valid JSON.",
    );
  }
  const receipt = workBuddyPromptResponseReceiptSchema.parse(raw);
  if (
    sha256(canonicalJson(receipt)) !== row.contentHash ||
    canonicalJson(receipt.response) !== row.responseJson ||
    receipt.receiptRef !== row.id ||
    receipt.workspaceId !== row.workspaceId ||
    receipt.deliveryObjectId !== row.deliveryObjectId ||
    receipt.deliveryClaimId !== row.deliveryClaimId ||
    receipt.deliveryClaimHash !== row.deliveryClaimHash ||
    receipt.clientId !== row.clientId ||
    receipt.actorUserId !== row.actorUserId ||
    receipt.ceoBindingRef !== row.ceoBindingRef ||
    receipt.mandateRef !== row.mandateRef ||
    receipt.ceoRef !== row.ceoRef ||
    receipt.source.objectKind !== row.sourceObjectKind ||
    receipt.source.objectId !== row.sourceObjectId ||
    receipt.source.objectHash !== row.sourceObjectHash ||
    receipt.source.objectVersion !== row.expectedVersion ||
    receipt.response.responseKind !== row.responseKind ||
    receipt.resultingDeliveryStatus !== row.resultingStatus ||
    receipt.idempotencyKey !== row.idempotencyKey ||
    receipt.requestHash !== row.requestHash ||
    receipt.authorityEffect !== row.authorityEffect ||
    receipt.recordedAt !== row.recordedAt.toISOString()
  ) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy prompt response receipt failed integrity checks.",
    );
  }
  const envelope = parseStoredEnvelope(row.envelope);
  const claim = parseStoredClaim(row.deliveryClaim);
  if (
    row.deliveryClaim.contentHash !== row.deliveryClaimHash ||
    claim.deliveryClaimId !== receipt.deliveryClaimId ||
    claim.workspaceId !== receipt.workspaceId ||
    claim.clientId !== receipt.clientId ||
    claim.deliveryObjectId !== receipt.deliveryObjectId ||
    claim.deliveryKey !== envelope.deliveryKey ||
    claim.deliveryVersion !== envelope.deliveryVersion ||
    claim.severity !== envelope.severity ||
    receipt.source.objectKind !== envelope.source.objectKind ||
    receipt.source.objectId !== envelope.source.objectId ||
    receipt.source.objectVersion !== envelope.source.objectVersion ||
    receipt.source.objectHash !== envelope.source.objectHash
  ) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy prompt response receipt is not bound to its delivery claim and envelope.",
    );
  }
  return Object.freeze({
    ...receipt,
    source: Object.freeze({ ...receipt.source }),
    response: Object.freeze({ ...receipt.response }),
  });
}

async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "The WorkBuddy workspace does not exist.",
    );
  }
}

function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return runWithWriteConflictRetry(
    () => db.$transaction(work, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

function transitionForResponse(input: {
  envelope: CaioDeliveryEnvelope;
  response: ReturnType<typeof promptResponseCommandSchema.parse>;
  recordedAt: string;
}): CaioDeliveryEnvelope {
  if (
    input.envelope.status !== "delivered" &&
    input.envelope.status !== "opened"
  ) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "A new prompt response requires a delivered or opened envelope.",
    );
  }
  let envelope = input.envelope;
  if (
    (input.response.responseKind === "answer" ||
      input.response.responseKind === "provide_evidence") &&
    envelope.status === "delivered"
  ) {
    envelope = transitionCaioDeliveryEnvelope({
      envelope,
      status: "opened",
      transitionedAt: input.recordedAt,
    });
  }
  if (
    input.response.responseKind === "answer" ||
    input.response.responseKind === "provide_evidence"
  ) {
    return transitionCaioDeliveryEnvelope({
      envelope,
      status: "answered",
      transitionedAt: input.recordedAt,
    });
  }
  if (input.response.responseKind === "snooze") {
    return transitionCaioDeliveryEnvelope({
      envelope,
      status: "snoozed",
      transitionedAt: input.recordedAt,
      snoozedUntil: input.response.snoozedUntil,
    });
  }
  return transitionCaioDeliveryEnvelope({
    envelope,
    status: "declined",
    transitionedAt: input.recordedAt,
  });
}

function assertSourceBinding(input: {
  request: Parameters<CanonicalPromptResponseService["submit"]>[0];
  envelope: CaioDeliveryEnvelope;
}): void {
  if (
    input.envelope.deliveryObjectId !==
      input.request.command.deliveryObjectId ||
    input.envelope.workspaceId !== input.request.workspaceId ||
    input.envelope.source.objectKind !==
      input.request.sourceObjectKind ||
    input.envelope.source.objectId !== input.request.sourceObjectId ||
    input.envelope.source.objectVersion !==
      input.request.expectedVersion ||
    input.envelope.source.objectHash !==
      input.request.sourceObjectHash
  ) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "The prompt response no longer matches the delivered canonical object.",
    );
  }
}

export function createPrismaCanonicalPromptResponseService(input?: {
  now?: () => string;
}): CanonicalPromptResponseService {
  const now = input?.now ?? (() => new Date().toISOString());

  return Object.freeze({
    async submit(
      rawRequest: Parameters<
        CanonicalPromptResponseService["submit"]
      >[0],
    ) {
      const { signal, ...requestWithoutSignal } = rawRequest;
      assertWorkBuddyRequestActive(signal);
      const request = {
        ...requestWithoutSignal,
        command: promptResponseCommandSchema.parse(
          rawRequest.command,
        ),
      };
      const requestHash =
        computeWorkBuddyPromptResponseRequestHash(request);

      return transaction(async (tx) => {
        await lockWorkspace(tx, request.workspaceId);
        const recordedAt = now();
        const authorization =
          await loadPrismaWorkBuddyAuthorizationSnapshot(tx, {
            workspaceId: request.workspaceId,
            actorUserId: request.actorUserId,
            capability: WORKBUDDY_OWNER_MUTATION_CAPABILITY,
            checkedAt: recordedAt,
          });
        const { mandate, binding } =
          requireWorkBuddyOwnerCeoSnapshot({
            snapshot: authorization,
            actorUserId: request.actorUserId,
          });
        if (
          mandate.mandateRef !== request.mandateRef ||
          mandate.ceoRef !== request.ceoRef ||
          binding.bindingRef !== request.ceoBindingRef ||
          binding.ceoRef !== request.ceoRef
        ) {
          throw new WorkBuddyCollaborationError(
            "SCOPE_DENIED",
            "The prompt response authorization changed before persistence.",
          );
        }
        const existing =
          await tx.workBuddyPromptResponseReceipt.findUnique({
            where: {
              workspaceId_idempotencyKey: {
                workspaceId: request.workspaceId,
                idempotencyKey: request.idempotencyKey,
              },
            },
            include: {
              envelope: true,
              deliveryClaim: true,
            },
          });
        if (existing) {
          const receipt = parseStoredReceipt(existing);
          if (receipt.requestHash !== requestHash) {
            throw new WorkBuddyCollaborationError(
              "VERSION_CONFLICT",
              "The prompt response idempotency key is bound to different content.",
            );
          }
          return Object.freeze({ receiptRef: receipt.receiptRef });
        }

        const envelopeRow =
          await tx.workBuddyDeliveryEnvelope.findFirst({
            where: {
              id: request.command.deliveryObjectId,
              workspaceId: request.workspaceId,
            },
          });
        if (!envelopeRow) {
          throw new WorkBuddyCollaborationError(
            "INVALID_TOOL_INPUT",
            "The prompt response delivery does not exist.",
          );
        }
        const envelope = parseStoredEnvelope(envelopeRow);
        assertSourceBinding({ request, envelope });
        const claim = await tx.workBuddyDeliveryClaim.findFirst({
          where: {
            workspaceId: request.workspaceId,
            clientId: request.clientId,
            deliveryObjectId: request.command.deliveryObjectId,
            deliveryKey: envelope.deliveryKey,
            deliveryVersion: envelope.deliveryVersion,
          },
        });
        if (!claim) {
          throw new WorkBuddyCollaborationError(
            "SCOPE_DENIED",
            "The authenticated WorkBuddy client has not claimed this delivery.",
          );
        }
        const parsedClaim = parseStoredClaim(claim);

        const transitioned = transitionForResponse({
          envelope,
          response: request.command,
          recordedAt,
        });
        const receipt = Object.freeze(
          workBuddyPromptResponseReceiptSchema.parse({
            schemaVersion:
              "helm.workbuddy-prompt-response-receipt/v1",
            receiptRef: createWorkBuddyPromptResponseReceiptRef({
              workspaceId: request.workspaceId,
              idempotencyKey: request.idempotencyKey,
            }),
            workspaceId: request.workspaceId,
            deliveryObjectId: request.command.deliveryObjectId,
            deliveryClaimId: parsedClaim.deliveryClaimId,
            deliveryClaimHash: claim.contentHash,
            clientId: request.clientId,
            actorUserId: request.actorUserId,
            ceoBindingRef: request.ceoBindingRef,
            mandateRef: request.mandateRef,
            ceoRef: request.ceoRef,
            source: envelope.source,
            response: request.command,
            resultingDeliveryStatus:
              promptResponseResultingStatus(request.command),
            idempotencyKey: request.idempotencyKey,
            requestHash,
            recordedAt,
            authorityEffect: "none",
            canonicalMutationAuthorityGranted: false,
            sourceObjectMutationRecorded: false,
            deliveryTransitionRecorded: true,
            externalExecutionAllowed: false,
          }),
        );
        const receiptJson = canonicalJson(receipt);

        const updated =
          await tx.workBuddyDeliveryEnvelope.updateMany({
            where: {
              id: envelope.deliveryObjectId,
              workspaceId: envelope.workspaceId,
              status: envelope.status,
              updatedAt: new Date(envelope.updatedAt),
            },
            data: envelopeStateWriteData(transitioned),
          });
        if (updated.count !== 1) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The delivery changed while its response was recorded.",
          );
        }
        await tx.workBuddyPromptResponseReceipt.create({
          data: {
            id: receipt.receiptRef,
            workspaceId: receipt.workspaceId,
            deliveryObjectId: receipt.deliveryObjectId,
            deliveryClaimId: receipt.deliveryClaimId,
            deliveryClaimHash: receipt.deliveryClaimHash,
            clientId: receipt.clientId,
            actorUserId: receipt.actorUserId,
            ceoBindingRef: receipt.ceoBindingRef,
            mandateRef: receipt.mandateRef,
            ceoRef: receipt.ceoRef,
            sourceObjectKind: receipt.source.objectKind,
            sourceObjectId: receipt.source.objectId,
            sourceObjectHash: receipt.source.objectHash,
            expectedVersion: receipt.source.objectVersion,
            responseKind: receipt.response.responseKind,
            resultingStatus: receipt.resultingDeliveryStatus,
            idempotencyKey: receipt.idempotencyKey,
            requestHash: receipt.requestHash,
            responseJson: canonicalJson(receipt.response),
            receiptJson,
            contentHash: sha256(receiptJson),
            authorityEffect: receipt.authorityEffect,
            recordedAt: new Date(receipt.recordedAt),
          },
        });
        return Object.freeze({ receiptRef: receipt.receiptRef });
      });
    },
  });
}
