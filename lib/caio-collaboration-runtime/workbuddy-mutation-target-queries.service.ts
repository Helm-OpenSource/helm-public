import "server-only";

import {
  WorkBuddyCollaborationError,
} from "@/lib/caio-collaboration/contracts";
import type {
  WorkBuddyMutationTargetQueries,
} from "@/lib/caio-collaboration/mutation-handlers";
import {
  governedMutationTargetSchema,
  type GovernedMutationTarget,
} from "@/lib/caio-collaboration/governed-mutation.service";
import {
  projectCaioAdviceDecision,
  validateCaioAdvice,
  type CaioAdvice,
} from "@/lib/caio-governance/advice";
import { toAdviceContract } from "@/lib/caio-governance/advice-store.service";
import { db } from "@/lib/db";
import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";
import {
  validateCaioOperatingQuestionPortfolio,
  type CaioOperatingQuestionPortfolio,
} from "@/lib/stage1-owner-loop/caio-operating-question";

import {
  parseStoredEnvelope,
} from "./workbuddy-delivery-store.service";

function parsePortfolioJson(
  value: string,
): CaioOperatingQuestionPortfolio {
  let portfolio: unknown;
  try {
    portfolio = JSON.parse(value);
  } catch {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "The canonical P1C portfolio is not valid JSON.",
    );
  }
  const candidate = portfolio as CaioOperatingQuestionPortfolio;
  const validation = validateCaioOperatingQuestionPortfolio(candidate);
  if (!validation.valid) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "The canonical P1C portfolio failed integrity validation.",
    );
  }
  return candidate;
}

function immutableAdviceHash(advice: CaioAdvice): string {
  return sha256(
    canonicalJson({
      schemaVersion: "helm.caio-advice-mutation-target/v1",
      adviceId: advice.adviceId,
      workspaceRef: advice.workspaceRef,
      mandateRef: advice.mandateRef,
      caioRef: advice.caioRef,
      adviceKey: advice.adviceKey,
      subjectRef: advice.subjectRef,
      title: advice.title,
      recommendation: advice.recommendation,
      observationRefs: advice.observationRefs,
      proposedAt: advice.proposedAt,
      validUntil: advice.validUntil,
      authorityEffect: advice.authorityEffect,
      executionRef: advice.executionRef,
    }),
  );
}

function freezeTarget(value: unknown): GovernedMutationTarget {
  const target = governedMutationTargetSchema.parse(value);
  return Object.freeze({ ...target });
}

export function createPrismaWorkBuddyMutationTargetQueries(input?: {
  now?: () => string;
}): WorkBuddyMutationTargetQueries {
  const now = input?.now ?? (() => new Date().toISOString());

  return Object.freeze({
    async loadPromptResponseTarget(
      request: Parameters<
        WorkBuddyMutationTargetQueries["loadPromptResponseTarget"]
      >[0],
    ) {
      const row = await db.workBuddyDeliveryEnvelope.findFirst({
        where: {
          id: request.deliveryObjectId,
          workspaceId: request.workspaceId,
        },
      });
      if (!row) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "The requested WorkBuddy delivery does not exist.",
        );
      }
      const envelope = parseStoredEnvelope(row);
      if (envelope.status === "withdrawn") {
        throw new WorkBuddyCollaborationError(
          "OBJECT_WITHDRAWN",
          "The canonical delivery was withdrawn.",
        );
      }
      if (
        envelope.status === "expired" ||
        Date.parse(now()) >= Date.parse(envelope.validUntil)
      ) {
        throw new WorkBuddyCollaborationError(
          "OBJECT_EXPIRED",
          "The canonical delivery expired.",
        );
      }
      return freezeTarget(envelope.source);
    },

    async loadQuestionSelectionTarget(
      request: Parameters<
        WorkBuddyMutationTargetQueries["loadQuestionSelectionTarget"]
      >[0],
    ) {
      const head =
        await db.caioOperatingQuestionPortfolioHead.findUnique({
          where: { workspaceId: request.workspaceId },
        });
      if (
        !head?.currentPortfolioId ||
        head.currentPortfolioId !== request.portfolioRef
      ) {
        throw new WorkBuddyCollaborationError(
          "VERSION_CONFLICT",
          "Question selection requires the current canonical P1C portfolio.",
        );
      }
      const row = await db.caioOperatingQuestionPortfolio.findFirst({
        where: {
          id: request.portfolioRef,
          workspaceId: request.workspaceId,
        },
      });
      if (!row) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "The requested canonical P1C portfolio does not exist.",
        );
      }
      const portfolio = parsePortfolioJson(row.portfolioJson);
      if (
        portfolio.portfolioId !== row.id ||
        portfolio.workspaceRef !== `workspace:${row.workspaceId}` ||
        portfolio.sequence !== row.sequence ||
        portfolio.contentHash !== row.contentHash ||
        portfolio.authorityEffect !== "none"
      ) {
        throw new WorkBuddyCollaborationError(
          "INTERNAL_ERROR",
          "The canonical P1C portfolio has inconsistent indexed fields.",
        );
      }
      return freezeTarget({
        schemaVersion: "helm.caio-canonical-object-ref/v1",
        objectKind: "operating_question_portfolio",
        objectId: row.id,
        objectVersion: row.sequence,
        objectHash: row.contentHash,
      });
    },

    async loadAdviceDecisionTarget(
      request: Parameters<
        WorkBuddyMutationTargetQueries["loadAdviceDecisionTarget"]
      >[0],
    ) {
      const row = await db.caioAdviceRecord.findFirst({
        where: {
          id: request.adviceRef,
          workspaceId: request.workspaceId,
        },
      });
      if (!row) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "The requested canonical CAIO advice does not exist.",
        );
      }
      const advice = toAdviceContract(row);
      const validation = validateCaioAdvice(advice);
      if (
        !validation.valid ||
        advice.adviceId !== row.id ||
        advice.workspaceRef !== `workspace:${row.workspaceId}` ||
        advice.authorityEffect !== "none" ||
        advice.executionRef !== null
      ) {
        throw new WorkBuddyCollaborationError(
          "INTERNAL_ERROR",
          "The canonical CAIO advice failed integrity validation.",
        );
      }
      const projection = projectCaioAdviceDecision(advice, now());
      if (projection.state === "withdrawn") {
        throw new WorkBuddyCollaborationError(
          "OBJECT_WITHDRAWN",
          "The canonical CAIO advice was withdrawn.",
        );
      }
      if (projection.state === "expired") {
        throw new WorkBuddyCollaborationError(
          "OBJECT_EXPIRED",
          "The canonical CAIO advice expired.",
        );
      }
      return freezeTarget({
        schemaVersion: "helm.caio-canonical-object-ref/v1",
        objectKind: "caio_advice",
        objectId: advice.adviceId,
        objectVersion: 1,
        objectHash: immutableAdviceHash(advice),
      });
    },
  });
}
