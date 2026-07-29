// CAIO context broker — enterprise negative rule lifecycle.
//
// draft → published → revoked. Publishing requires an OWNER/ADMIN role flag
// asserted by the caller port; publishing a new version of a ruleKey
// supersedes (revokes) the previously published version. Async audit may only
// create DRAFT suggestions: suggestRuleFromAudit structurally cannot publish.

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  CaioContextBrokerError,
  CAIO_NEGATIVE_RULE_KINDS,
  CAIO_RULE_SCOPE_KINDS,
  caioNegativeRulePatternSchema,
  caioNegativeRuleSchema,
  type CaioNegativeRule,
} from "@/lib/caio-context-broker/broker-contracts";

export type RuleActor = Readonly<{
  actorRef: string;
  /** Role flag passed by the caller port; publishing/revoking requires it. */
  isOwnerOrAdmin: boolean;
}>;

const draftRuleInputSchema = z
  .object({
    workspaceId: z.string().min(1).max(200),
    ruleKey: z.string().min(1).max(190),
    scopeKind: z.enum(CAIO_RULE_SCOPE_KINDS),
    scopeRef: z.string().min(1).max(200).nullable().optional(),
    ruleKind: z.enum(CAIO_NEGATIVE_RULE_KINDS),
    pattern: caioNegativeRulePatternSchema,
    createdByRef: z.string().min(1).max(200),
  })
  .strict();

export type DraftRuleInput = z.infer<typeof draftRuleInputSchema>;

/**
 * Audit-originated suggestions carry provenance but NO status field and no
 * publish authority: the only thing this input can ever become is a draft.
 */
const auditSuggestionInputSchema = draftRuleInputSchema
  .extend({
    auditFindingRef: z.string().min(1).max(300),
  })
  .strict();

export type AuditSuggestionInput = z.infer<typeof auditSuggestionInputSchema>;

export type ContextRuleStore = Readonly<{
  createDraftRule(input: DraftRuleInput, now: Date): Promise<CaioNegativeRule>;
  /** Requires actor.isOwnerOrAdmin. Supersedes the prior published version. */
  publishRule(input: {
    workspaceId: string;
    ruleId: string;
    actor: RuleActor;
    now: Date;
  }): Promise<CaioNegativeRule>;
  revokeRule(input: {
    workspaceId: string;
    ruleId: string;
    actor: RuleActor;
    now: Date;
  }): Promise<CaioNegativeRule>;
  /** Audit path: always lands as status "draft"; cannot publish. */
  suggestRuleFromAudit(
    input: AuditSuggestionInput,
    now: Date,
  ): Promise<CaioNegativeRule>;
  listPublishedRules(input: {
    workspaceId: string;
  }): Promise<readonly CaioNegativeRule[]>;
  getRule(input: {
    workspaceId: string;
    ruleId: string;
  }): Promise<CaioNegativeRule | null>;
}>;

function ruleId(input: {
  workspaceId: string;
  ruleKey: string;
  version: number;
}): string {
  return `caio-context-rule:${sha256(canonicalJson(input)).slice(
    "sha256:".length,
  )}`;
}

function buildDraft(
  input: DraftRuleInput,
  version: number,
  now: Date,
): CaioNegativeRule {
  const parsedInput = draftRuleInputSchema.parse(input);
  const candidate = {
    id: ruleId({
      workspaceId: parsedInput.workspaceId,
      ruleKey: parsedInput.ruleKey,
      version,
    }),
    workspaceId: parsedInput.workspaceId,
    ruleKey: parsedInput.ruleKey,
    scopeKind: parsedInput.scopeKind,
    scopeRef: parsedInput.scopeRef ?? null,
    ruleKind: parsedInput.ruleKind,
    pattern: parsedInput.pattern,
    version,
    status: "draft" as const,
    createdByRef: parsedInput.createdByRef,
    publishedByRef: null,
    createdAt: now.toISOString(),
    publishedAt: null,
    revokedAt: null,
  };
  const parsed = caioNegativeRuleSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new CaioContextBrokerError(
      "caio_invalid_input",
      "The negative rule draft input is invalid.",
    );
  }
  return Object.freeze(parsed.data);
}

function assertPublishAuthority(actor: RuleActor): void {
  if (actor.isOwnerOrAdmin !== true) {
    throw new CaioContextBrokerError(
      "caio_rule_forbidden",
      "Only OWNER/ADMIN actors may change negative rule publication state.",
    );
  }
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

export function createInMemoryContextRuleStore(): ContextRuleStore {
  const rules = new Map<string, CaioNegativeRule>();

  const nextVersion = (workspaceId: string, ruleKey: string): number => {
    let max = 0;
    for (const rule of rules.values()) {
      if (rule.workspaceId === workspaceId && rule.ruleKey === ruleKey) {
        max = Math.max(max, rule.version);
      }
    }
    return max + 1;
  };

  const store: ContextRuleStore = Object.freeze({
    async createDraftRule(input, now) {
      const parsed = draftRuleInputSchema.parse(input);
      const draft = buildDraft(
        parsed,
        nextVersion(parsed.workspaceId, parsed.ruleKey),
        now,
      );
      rules.set(draft.id, draft);
      return draft;
    },

    async publishRule(input) {
      assertPublishAuthority(input.actor);
      const rule = rules.get(input.ruleId);
      if (!rule || rule.workspaceId !== input.workspaceId) {
        throw new CaioContextBrokerError(
          "caio_rule_not_found",
          "The negative rule does not exist in this workspace.",
        );
      }
      if (rule.status !== "draft") {
        throw new CaioContextBrokerError(
          "caio_rule_illegal_state",
          "Only draft rules can be published.",
        );
      }
      for (const existing of rules.values()) {
        if (
          existing.workspaceId === rule.workspaceId &&
          existing.ruleKey === rule.ruleKey &&
          existing.status === "published"
        ) {
          rules.set(
            existing.id,
            Object.freeze({
              ...existing,
              status: "revoked" as const,
              revokedAt: input.now.toISOString(),
            }),
          );
        }
      }
      const published = Object.freeze({
        ...rule,
        status: "published" as const,
        publishedByRef: input.actor.actorRef,
        publishedAt: input.now.toISOString(),
      });
      rules.set(published.id, published);
      return published;
    },

    async revokeRule(input) {
      assertPublishAuthority(input.actor);
      const rule = rules.get(input.ruleId);
      if (!rule || rule.workspaceId !== input.workspaceId) {
        throw new CaioContextBrokerError(
          "caio_rule_not_found",
          "The negative rule does not exist in this workspace.",
        );
      }
      if (rule.status !== "published") {
        throw new CaioContextBrokerError(
          "caio_rule_illegal_state",
          "Only published rules can be revoked.",
        );
      }
      const revoked = Object.freeze({
        ...rule,
        status: "revoked" as const,
        revokedAt: input.now.toISOString(),
      });
      rules.set(revoked.id, revoked);
      return revoked;
    },

    async suggestRuleFromAudit(input, now) {
      const parsed = auditSuggestionInputSchema.parse(input);
      const { auditFindingRef: _provenance, ...draftInput } = parsed;
      // The suggestion path can only produce a draft; publication requires a
      // separate OWNER/ADMIN publishRule call.
      return store.createDraftRule(draftInput, now);
    },

    async listPublishedRules(input) {
      return Object.freeze(
        [...rules.values()].filter(
          (rule) =>
            rule.workspaceId === input.workspaceId &&
            rule.status === "published",
        ),
      );
    },

    async getRule(input) {
      const rule = rules.get(input.ruleId);
      if (!rule || rule.workspaceId !== input.workspaceId) return null;
      return rule;
    },
  });
  return store;
}

// ---------------------------------------------------------------------------
// Prisma adapter
// ---------------------------------------------------------------------------

type StoredRuleRow = {
  id: string;
  workspaceId: string;
  ruleKey: string;
  scopeKind: string;
  scopeRef: string | null;
  ruleKind: string;
  patternJson: string;
  version: number;
  status: string;
  createdByRef: string;
  publishedByRef: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  revokedAt: Date | null;
};

function parseStoredRule(row: StoredRuleRow): CaioNegativeRule {
  const parsed = caioNegativeRuleSchema.safeParse({
    id: row.id,
    workspaceId: row.workspaceId,
    ruleKey: row.ruleKey,
    scopeKind: row.scopeKind,
    scopeRef: row.scopeRef,
    ruleKind: row.ruleKind,
    pattern: JSON.parse(row.patternJson),
    version: row.version,
    status: row.status,
    createdByRef: row.createdByRef,
    publishedByRef: row.publishedByRef,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  });
  if (!parsed.success) {
    throw new CaioContextBrokerError(
      "caio_internal_error",
      "A stored negative rule failed contract validation.",
    );
  }
  return Object.freeze(parsed.data);
}

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

export function createPrismaContextRuleStore(): ContextRuleStore {
  const store: ContextRuleStore = Object.freeze({
    async createDraftRule(input, now) {
      const parsed = draftRuleInputSchema.parse(input);
      return db.$transaction(async (tx) => {
        const latest = await tx.caioContextNegativeRule.findFirst({
          where: {
            workspaceId: parsed.workspaceId,
            ruleKey: parsed.ruleKey,
          },
          orderBy: { version: "desc" },
        });
        const draft = buildDraft(parsed, (latest?.version ?? 0) + 1, now);
        await tx.caioContextNegativeRule.create({
          data: {
            id: draft.id,
            workspaceId: draft.workspaceId,
            ruleKey: draft.ruleKey,
            scopeKind: draft.scopeKind,
            scopeRef: draft.scopeRef,
            ruleKind: draft.ruleKind,
            patternJson: canonicalJson(draft.pattern),
            version: draft.version,
            status: draft.status,
            createdByRef: draft.createdByRef,
            publishedByRef: null,
            createdAt: new Date(draft.createdAt),
            publishedAt: null,
            revokedAt: null,
          },
        });
        return draft;
      }, TRANSACTION_OPTIONS);
    },

    async publishRule(input) {
      assertPublishAuthority(input.actor);
      return db.$transaction(async (tx) => {
        const row = await tx.caioContextNegativeRule.findFirst({
          where: { id: input.ruleId, workspaceId: input.workspaceId },
        });
        if (!row) {
          throw new CaioContextBrokerError(
            "caio_rule_not_found",
            "The negative rule does not exist in this workspace.",
          );
        }
        if (row.status !== "draft") {
          throw new CaioContextBrokerError(
            "caio_rule_illegal_state",
            "Only draft rules can be published.",
          );
        }
        await tx.caioContextNegativeRule.updateMany({
          where: {
            workspaceId: input.workspaceId,
            ruleKey: row.ruleKey,
            status: "published",
          },
          data: { status: "revoked", revokedAt: input.now },
        });
        await tx.caioContextNegativeRule.update({
          where: { id: row.id },
          data: {
            status: "published",
            publishedByRef: input.actor.actorRef,
            publishedAt: input.now,
          },
        });
        const published = await tx.caioContextNegativeRule.findUniqueOrThrow({
          where: { id: row.id },
        });
        return parseStoredRule(published);
      }, TRANSACTION_OPTIONS);
    },

    async revokeRule(input) {
      assertPublishAuthority(input.actor);
      return db.$transaction(async (tx) => {
        const row = await tx.caioContextNegativeRule.findFirst({
          where: { id: input.ruleId, workspaceId: input.workspaceId },
        });
        if (!row) {
          throw new CaioContextBrokerError(
            "caio_rule_not_found",
            "The negative rule does not exist in this workspace.",
          );
        }
        if (row.status !== "published") {
          throw new CaioContextBrokerError(
            "caio_rule_illegal_state",
            "Only published rules can be revoked.",
          );
        }
        await tx.caioContextNegativeRule.update({
          where: { id: row.id },
          data: { status: "revoked", revokedAt: input.now },
        });
        const revoked = await tx.caioContextNegativeRule.findUniqueOrThrow({
          where: { id: row.id },
        });
        return parseStoredRule(revoked);
      }, TRANSACTION_OPTIONS);
    },

    async suggestRuleFromAudit(input, now) {
      const parsed = auditSuggestionInputSchema.parse(input);
      const { auditFindingRef: _provenance, ...draftInput } = parsed;
      return store.createDraftRule(draftInput, now);
    },

    async listPublishedRules(input) {
      const rows = await db.caioContextNegativeRule.findMany({
        where: { workspaceId: input.workspaceId, status: "published" },
        orderBy: [{ ruleKey: "asc" }, { version: "asc" }],
      });
      return Object.freeze(rows.map(parseStoredRule));
    },

    async getRule(input) {
      const row = await db.caioContextNegativeRule.findFirst({
        where: { id: input.ruleId, workspaceId: input.workspaceId },
      });
      return row ? parseStoredRule(row) : null;
    },
  });
  return store;
}
