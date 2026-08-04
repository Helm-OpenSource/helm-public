import type {
  CaioAdviceDecisionOutcome,
  CaioAdviceDecisionProjection,
} from "@/lib/caio-governance/advice";

import { WorkBuddyCollaborationError } from "./contracts";
import type {
  IdempotentCanonicalMutationPort,
} from "./governed-mutation-adapter.service";
import {
  adviceDecisionCommandSchema,
  promptResponseCommandSchema,
  questionSelectionCommandSchema,
} from "./mutation-commands";
import {
  assertWorkBuddyRequestActive,
} from "./request-cancellation";

type CanonicalMutationInput = Parameters<
  IdempotentCanonicalMutationPort["apply"]
>[0];

export interface CanonicalPromptResponseService {
  submit(input: {
    workspaceId: string;
    clientId: string;
    actorUserId: string;
    ceoRef: string;
    ceoBindingRef: string;
    mandateRef: string;
    sourceObjectKind:
      | "operating_question_candidate"
      | "decision_record"
      | "supervision_signal";
    sourceObjectId: string;
    sourceObjectHash: string;
    expectedVersion: number;
    command: ReturnType<typeof promptResponseCommandSchema.parse>;
    idempotencyKey: string;
    signal?: AbortSignal;
  }): Promise<Readonly<{ receiptRef: string }>>;
}

export interface CanonicalQuestionSelectionService {
  select(input: {
    workspaceId: string;
    expectedPortfolioId: string;
    actorUserId: string;
    ceoPrincipalRef: string;
    idempotencyKey: string;
    selections: unknown;
    reasonCodes: string[];
    evidenceRefs: string[];
    signal?: AbortSignal;
  }): Promise<
    Readonly<{
      receipt: Readonly<{ receiptId: string }>;
      replayed: boolean;
    }>
  >;
  bind(input: {
    workspaceId: string;
    expectedSelectionReceiptId: string;
    actorUserId: string;
    ceoPrincipalRef: string;
    signal?: AbortSignal;
  }): Promise<
    Readonly<{
      selectionReceipt: Readonly<{ receiptId: string }>;
      bindings: readonly Readonly<{
        decisionRecordId: string;
      }>[];
    }>
  >;
}

export interface CanonicalAdviceDecisionService {
  decide(input: {
    workspaceId: string;
    adviceRecordId: string;
    outcome: CaioAdviceDecisionOutcome;
    reason: string;
    actorUserId: string;
    actorCeoRef: string;
    signal?: AbortSignal;
  }): Promise<
    | Readonly<{
        kind: "decided" | "idempotent";
        projection: CaioAdviceDecisionProjection;
      }>
    | Readonly<{ kind: "expired" }>
  >;
}

export function createCanonicalPromptResponsePort(
  service: CanonicalPromptResponseService,
): IdempotentCanonicalMutationPort {
  return Object.freeze({
    idempotencyGuarantee: "payload_bound",
    async apply(input: CanonicalMutationInput) {
      assertWorkBuddyRequestActive(input.signal);
      if (
        input.target.objectKind === "caio_advice" ||
        input.target.objectKind === "operating_question_portfolio"
      ) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "This canonical object does not accept a prompt response.",
        );
      }
      const command = promptResponseCommandSchema.parse(input.command);
      const result = await service.submit({
        workspaceId: input.workspaceId,
        clientId: input.clientId,
        actorUserId: input.actorUserId,
        ceoRef: input.ceoRef,
        ceoBindingRef: input.ceoBindingRef,
        mandateRef: input.mandateRef,
        sourceObjectKind: input.target.objectKind,
        sourceObjectId: input.target.objectId,
        sourceObjectHash: input.target.objectHash,
        expectedVersion: input.expectedVersion,
        command,
        idempotencyKey: input.idempotencyKey,
        ...(input.signal === undefined
          ? {}
          : { signal: input.signal }),
      });
      return Object.freeze({
        canonicalReceiptRef: result.receiptRef,
      });
    },
  });
}

export function createCanonicalQuestionSelectionPort(
  service: CanonicalQuestionSelectionService,
): IdempotentCanonicalMutationPort {
  return Object.freeze({
    idempotencyGuarantee: "payload_bound",
    async apply(input: CanonicalMutationInput) {
      assertWorkBuddyRequestActive(input.signal);
      if (
        input.target.objectKind !==
        "operating_question_portfolio"
      ) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "Question selection must target the canonical P1C portfolio.",
        );
      }
      const command = questionSelectionCommandSchema.parse(
        input.command,
      );
      if (command.portfolioHash !== input.target.objectHash) {
        throw new WorkBuddyCollaborationError(
          "VERSION_CONFLICT",
          "The portfolio hash changed after preparation.",
        );
      }
      const result = await service.select({
        workspaceId: input.workspaceId,
        expectedPortfolioId: input.target.objectId,
        actorUserId: input.actorUserId,
        ceoPrincipalRef: input.ceoRef,
        idempotencyKey: input.idempotencyKey,
        selections: command.selections,
        reasonCodes: command.reasonCodes,
        evidenceRefs: command.evidenceRefs,
        ...(input.signal === undefined
          ? {}
          : { signal: input.signal }),
      });
      assertWorkBuddyRequestActive(input.signal);
      const binding = await service.bind({
        workspaceId: input.workspaceId,
        expectedSelectionReceiptId: result.receipt.receiptId,
        actorUserId: input.actorUserId,
        ceoPrincipalRef: input.ceoRef,
        ...(input.signal === undefined
          ? {}
          : { signal: input.signal }),
      });
      if (
        binding.selectionReceipt.receiptId !==
        result.receipt.receiptId
      ) {
        throw new WorkBuddyCollaborationError(
          "WRITE_UNAVAILABLE",
          "The canonical DecisionRecord binding did not preserve the selected receipt.",
        );
      }
      return Object.freeze({
        canonicalReceiptRef: result.receipt.receiptId,
      });
    },
  });
}

export function createCanonicalAdviceDecisionPort(
  service: CanonicalAdviceDecisionService,
): IdempotentCanonicalMutationPort {
  return Object.freeze({
    idempotencyGuarantee: "payload_bound",
    async apply(input: CanonicalMutationInput) {
      assertWorkBuddyRequestActive(input.signal);
      if (input.target.objectKind !== "caio_advice") {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "Advice decisions must target canonical CAIO advice.",
        );
      }
      const command = adviceDecisionCommandSchema.parse(
        input.command,
      );
      const result = await service.decide({
        workspaceId: input.workspaceId,
        adviceRecordId: input.target.objectId,
        outcome: command.outcome,
        reason: command.reason,
        actorUserId: input.actorUserId,
        actorCeoRef: input.ceoRef,
        ...(input.signal === undefined
          ? {}
          : { signal: input.signal }),
      });
      if (result.kind === "expired") {
        throw new WorkBuddyCollaborationError(
          "OBJECT_EXPIRED",
          "The canonical advice expired before submission.",
        );
      }
      if (
        result.projection.state !== "decided" ||
        result.projection.receipt.authorityEffect !== "none"
      ) {
        throw new WorkBuddyCollaborationError(
          "WRITE_UNAVAILABLE",
          "The canonical advice service did not return a decision receipt.",
        );
      }
      return Object.freeze({
        canonicalReceiptRef: result.projection.receipt.adviceRef,
      });
    },
  });
}
