// CAIO context broker — per-request context receipts.
//
// A receipt aggregates every source that contributed context to one request,
// each with a citation label "[CAIO:S<n>]". Receipts carry NO secret or raw
// content — only refs, hashes, decisions, and rule hits.
//
// READ PATH IS THE SOURCE OF TRUTH FOR CITATIONS: model-generated citations
// are never the only evidence that a source was used; consumers must resolve
// citations against the stored receipt for the request.

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  CaioContextBrokerError,
  caioContextDecisionSchema,
  caioContextSourceSchema,
  formatCitationLabel,
  type CaioContextSource,
} from "@/lib/caio-context-broker/broker-contracts";

export const caioContextReceiptSchema = z
  .object({
    id: z.string().min(1).max(200),
    workspaceId: z.string().min(1).max(200),
    userRef: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    decision: caioContextDecisionSchema,
    policyVersion: z.string().min(1).max(200),
    ruleHits: z.array(z.string().min(1).max(300)).max(200),
    sources: z.array(caioContextSourceSchema).max(200),
    redactionReliable: z.boolean(),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CaioContextReceipt = z.infer<typeof caioContextReceiptSchema>;

export type ContextReceiptSourceInput = Omit<
  CaioContextSource,
  "citationLabel"
>;

function computeReceiptContentHash(
  receipt: Omit<CaioContextReceipt, "contentHash">,
): string {
  return sha256(canonicalJson(receipt));
}

/**
 * Builds the immutable per-request receipt. Citation labels are assigned in
 * source order starting at [CAIO:S1]. Sources may only carry refs and
 * version/content hashes — never content bodies.
 */
export function buildContextReceipt(input: {
  workspaceId: string;
  userRef: string;
  requestId: string;
  decision: CaioContextReceipt["decision"];
  policyVersion: string;
  ruleHits: readonly string[];
  sources: readonly ContextReceiptSourceInput[];
  redactionReliable: boolean;
  now: Date;
}): CaioContextReceipt {
  const sources = input.sources.map((source, index) => ({
    ...source,
    citationLabel: formatCitationLabel(index + 1),
  }));
  const id = `caio-context-receipt:${sha256(
    canonicalJson({
      workspaceId: input.workspaceId,
      requestId: input.requestId,
    }),
  ).slice("sha256:".length)}`;
  const withoutHash = {
    id,
    workspaceId: input.workspaceId,
    userRef: input.userRef,
    requestId: input.requestId,
    decision: input.decision,
    policyVersion: input.policyVersion,
    ruleHits: [...input.ruleHits],
    sources,
    redactionReliable: input.redactionReliable,
    createdAt: input.now.toISOString(),
  };
  const parsed = caioContextReceiptSchema.safeParse({
    ...withoutHash,
    contentHash: computeReceiptContentHash({ ...withoutHash }),
  });
  if (!parsed.success) {
    throw new CaioContextBrokerError(
      "caio_invalid_input",
      "The context receipt input is invalid.",
    );
  }
  return Object.freeze(parsed.data);
}

// ---------------------------------------------------------------------------
// Store port
// ---------------------------------------------------------------------------

export type ContextReceiptStore = Readonly<{
  /**
   * Writes a receipt. A request id may be bound exactly once per workspace;
   * any re-write for the same request id is rejected with the typed
   * caio_receipt_conflict error.
   */
  writeReceipt(receipt: CaioContextReceipt): Promise<CaioContextReceipt>;
  /** Source of truth for citations on the read path. */
  readReceipt(input: {
    workspaceId: string;
    requestId: string;
  }): Promise<CaioContextReceipt | null>;
}>;

export function createInMemoryContextReceiptStore(): ContextReceiptStore {
  const receipts = new Map<string, CaioContextReceipt>();
  const key = (workspaceId: string, requestId: string) =>
    `${workspaceId}\u0000${requestId}`;
  return Object.freeze({
    async writeReceipt(rawReceipt) {
      const receipt = caioContextReceiptSchema.parse(rawReceipt);
      const receiptKey = key(receipt.workspaceId, receipt.requestId);
      if (receipts.has(receiptKey)) {
        throw new CaioContextBrokerError(
          "caio_receipt_conflict",
          "A context receipt already exists for this request.",
        );
      }
      const frozen = Object.freeze({
        ...receipt,
        ruleHits: Object.freeze([...receipt.ruleHits]),
        sources: Object.freeze(
          receipt.sources.map((source) => Object.freeze({ ...source })),
        ),
      }) as CaioContextReceipt;
      receipts.set(receiptKey, frozen);
      return frozen;
    },
    async readReceipt(input) {
      return receipts.get(key(input.workspaceId, input.requestId)) ?? null;
    },
  });
}

// ---------------------------------------------------------------------------
// Prisma adapter
// ---------------------------------------------------------------------------

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function createPrismaContextReceiptStore(): ContextReceiptStore {
  return Object.freeze({
    async writeReceipt(rawReceipt) {
      const receipt = caioContextReceiptSchema.parse(rawReceipt);
      try {
        await db.caioContextReceipt.create({
          data: {
            id: receipt.id,
            workspaceId: receipt.workspaceId,
            userRef: receipt.userRef,
            requestId: receipt.requestId,
            decision: receipt.decision,
            policyVersion: receipt.policyVersion,
            ruleHitsJson: canonicalJson(receipt.ruleHits),
            sourcesJson: canonicalJson(receipt.sources),
            redactionReliable: receipt.redactionReliable,
            contentHash: receipt.contentHash,
            createdAt: new Date(receipt.createdAt),
          },
        });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw new CaioContextBrokerError(
            "caio_receipt_conflict",
            "A context receipt already exists for this request.",
          );
        }
        throw error;
      }
      return receipt;
    },

    async readReceipt(input) {
      const row = await db.caioContextReceipt.findUnique({
        where: {
          workspaceId_requestId: {
            workspaceId: input.workspaceId,
            requestId: input.requestId,
          },
        },
      });
      if (!row) return null;
      const receipt = caioContextReceiptSchema.parse({
        id: row.id,
        workspaceId: row.workspaceId,
        userRef: row.userRef,
        requestId: row.requestId,
        decision: row.decision,
        policyVersion: row.policyVersion,
        ruleHits: JSON.parse(row.ruleHitsJson),
        sources: JSON.parse(row.sourcesJson),
        redactionReliable: row.redactionReliable,
        contentHash: row.contentHash,
        createdAt: row.createdAt.toISOString(),
      });
      const { contentHash: _stored, ...rest } = receipt;
      if (computeReceiptContentHash(rest) !== receipt.contentHash) {
        throw new CaioContextBrokerError(
          "caio_internal_error",
          "A stored context receipt failed its content hash.",
        );
      }
      return Object.freeze(receipt);
    },
  });
}
