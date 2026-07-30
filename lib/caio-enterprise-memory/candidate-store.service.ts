// CAIO enterprise memory — candidate store (port + in-memory + Prisma).
//
// Retrieval exclusion is enforced at the STORE layer: queryRetrievableMemory
// only ever returns state IN ("ephemeral","verified"), even when a candidate
// is requested directly by id. Rejected/expired entries lose their body (set
// to null) while contentHash, state, and the secret-free receiptJson are
// preserved as evidence.

import { z } from "zod";

import { db } from "@/lib/db";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  CANDIDATE_TTL_MS,
  CaioMemoryError,
  EPHEMERAL_TTL_MS,
  assertLegalMemoryTransition,
  caioMemoryStateSchema,
  memoryCandidateCreateSchema,
  type CaioMemoryState,
  type MemoryCandidateCreateInput,
} from "@/lib/caio-enterprise-memory/memory-contracts";

export const caioMemoryCandidateRecordSchema = z
  .object({
    id: z.string().min(1).max(200),
    workspaceId: z.string().min(1).max(200),
    projectRef: z.string().min(1).max(200).nullable(),
    createdByRef: z.string().min(1).max(200),
    state: caioMemoryStateSchema,
    body: z.string().nullable(),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    sourceRequestId: z.string().min(1).max(200).nullable(),
    receiptJson: z.string().min(2),
    createdAt: z.string().datetime({ offset: true }),
    candidateExpiresAt: z.string().datetime({ offset: true }),
    adoptedAt: z.string().datetime({ offset: true }).nullable(),
    adoptedByRef: z.string().min(1).max(200).nullable(),
    ephemeralExpiresAt: z.string().datetime({ offset: true }).nullable(),
    verifiedAt: z.string().datetime({ offset: true }).nullable(),
    verifiedByRef: z.string().min(1).max(200).nullable(),
    rejectedAt: z.string().datetime({ offset: true }).nullable(),
    rejectedByRef: z.string().min(1).max(200).nullable(),
    expiredAt: z.string().datetime({ offset: true }).nullable(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CaioMemoryCandidateRecord = z.infer<
  typeof caioMemoryCandidateRecordSchema
>;

/** Only these states are ever visible through the retrieval API. */
export const RETRIEVABLE_MEMORY_STATES = ["ephemeral", "verified"] as const;
export type RetrievableMemoryState =
  (typeof RETRIEVABLE_MEMORY_STATES)[number];

export type RetrievableMemoryEntry = Readonly<{
  id: string;
  workspaceId: string;
  projectRef: string | null;
  body: string;
  contentHash: string;
  /**
   * Provenance travels with every query result: ephemeral entries are
   * flagged isVerified:false so they never override formal knowledge. The
   * precedence is also materialised in the RESULT ORDER (see
   * compareRetrievablePrecedence) instead of being delegated to the consumer.
   */
  provenance: Readonly<{
    state: RetrievableMemoryState;
    isVerified: boolean;
    createdByRef: string;
    adoptedByRef: string | null;
    verifiedByRef: string | null;
    sourceRequestId: string | null;
  }>;
}>;

export type CaioMemoryCandidateStore = Readonly<{
  /** Auto-generated content only ever enters as state "candidate". */
  createCandidate(
    input: MemoryCandidateCreateInput,
    now: Date,
  ): Promise<CaioMemoryCandidateRecord>;
  /** A user sees only their own candidates. */
  listOwnCandidates(input: {
    workspaceId: string;
    userRef: string;
  }): Promise<readonly CaioMemoryCandidateRecord[]>;
  /**
   * Store-layer retrieval: state IN ("ephemeral","verified") only, ordered
   * verified-before-ephemeral and then newest-first in both implementations.
   */
  queryRetrievableMemory(input: {
    workspaceId: string;
    projectRef?: string;
    id?: string;
    now: Date;
  }): Promise<readonly RetrievableMemoryEntry[]>;
  /**
   * Single conditional transition candidate → ephemeral. Only the creator
   * may adopt; only from state "candidate" and inside the candidate TTL.
   *
   * Scope never widens implicitly: adoption PRESERVES the creation-time
   * projectRef. An explicit targetProjectRef re-targets the entry to that
   * project; widening a project-scoped candidate to workspace scope
   * (projectRef null, visible from every project) requires the explicit
   * promoteToWorkspaceScope opt-in. Passing both is invalid_input.
   */
  adoptCandidate(input: {
    workspaceId: string;
    candidateId: string;
    actorRef: string;
    targetProjectRef?: string;
    promoteToWorkspaceScope?: boolean;
    now: Date;
  }): Promise<CaioMemoryCandidateRecord>;
  /** Creator-only. Deletes the body; keeps contentHash + receiptJson. */
  rejectCandidate(input: {
    workspaceId: string;
    candidateId: string;
    actorRef: string;
    now: Date;
  }): Promise<CaioMemoryCandidateRecord>;
  /** TTL sweep for candidates and ephemerals. Deletes bodies. */
  expireCandidates(input: { workspaceId: string; now: Date }): Promise<number>;
  /** Knowledge-owner-only confirmation ephemeral → verified. */
  verifyEphemeral(input: {
    workspaceId: string;
    candidateId: string;
    actorRef: string;
    actorIsKnowledgeOwner: boolean;
    now: Date;
  }): Promise<CaioMemoryCandidateRecord>;
}>;

function candidateId(input: {
  workspaceId: string;
  contentHash: string;
  createdByRef: string;
  createdAt: string;
}): string {
  return `caio-memory-candidate:${sha256(canonicalJson(input)).slice(
    "sha256:".length,
  )}`;
}

/** Secret-free receipt: hash + refs only, never the body. */
function buildCandidateReceiptJson(record: {
  contentHash: string;
  createdByRef: string;
  sourceRequestId: string | null;
  createdAt: string;
}): string {
  return canonicalJson({
    schemaVersion: "helm.caio-memory-candidate-receipt/v1",
    contentHash: record.contentHash,
    createdByRef: record.createdByRef,
    sourceRequestId: record.sourceRequestId,
    createdAt: record.createdAt,
  });
}

function buildNewCandidate(
  input: MemoryCandidateCreateInput,
  now: Date,
): CaioMemoryCandidateRecord {
  const parsed = memoryCandidateCreateSchema.parse(input);
  const createdAt = now.toISOString();
  const contentHash = sha256(parsed.body);
  const record: CaioMemoryCandidateRecord = {
    id: candidateId({
      workspaceId: parsed.workspaceId,
      contentHash,
      createdByRef: parsed.createdByRef,
      createdAt,
    }),
    workspaceId: parsed.workspaceId,
    projectRef: parsed.projectRef ?? null,
    createdByRef: parsed.createdByRef,
    state: "candidate",
    body: parsed.body,
    contentHash,
    sourceRequestId: parsed.sourceRequestId ?? null,
    receiptJson: buildCandidateReceiptJson({
      contentHash,
      createdByRef: parsed.createdByRef,
      sourceRequestId: parsed.sourceRequestId ?? null,
      createdAt,
    }),
    createdAt,
    candidateExpiresAt: new Date(now.getTime() + CANDIDATE_TTL_MS).toISOString(),
    adoptedAt: null,
    adoptedByRef: null,
    ephemeralExpiresAt: null,
    verifiedAt: null,
    verifiedByRef: null,
    rejectedAt: null,
    rejectedByRef: null,
    expiredAt: null,
    updatedAt: createdAt,
  };
  return Object.freeze(caioMemoryCandidateRecordSchema.parse(record));
}

function toRetrievableEntry(
  record: CaioMemoryCandidateRecord,
): RetrievableMemoryEntry | null {
  if (record.state !== "ephemeral" && record.state !== "verified") return null;
  if (record.body === null) return null;
  return Object.freeze({
    id: record.id,
    workspaceId: record.workspaceId,
    projectRef: record.projectRef,
    body: record.body,
    contentHash: record.contentHash,
    provenance: Object.freeze({
      state: record.state,
      isVerified: record.state === "verified",
      createdByRef: record.createdByRef,
      adoptedByRef: record.adoptedByRef,
      verifiedByRef: record.verifiedByRef,
      sourceRequestId: record.sourceRequestId,
    }),
  });
}

/**
 * Adoption scope resolution (F7). Omitting every scope argument must PRESERVE
 * the creation-time projectRef: silently promoting a project-scoped candidate
 * to workspace scope would make it visible from every project and detach it
 * from any project-scoped no_cross_project_context rule.
 */
export function resolveAdoptionProjectRef(input: {
  currentProjectRef: string | null;
  targetProjectRef?: string;
  promoteToWorkspaceScope?: boolean;
}): string | null {
  const promote = input.promoteToWorkspaceScope === true;
  const target =
    typeof input.targetProjectRef === "string" && input.targetProjectRef !== ""
      ? input.targetProjectRef
      : null;
  if (promote && target !== null) {
    throw new CaioMemoryError(
      "invalid_input",
      "targetProjectRef and promoteToWorkspaceScope are mutually exclusive.",
    );
  }
  if (promote) return null;
  if (target !== null) return target;
  return input.currentProjectRef;
}

/**
 * Deterministic retrieval precedence (F8): verified knowledge always precedes
 * unverified ephemeral knowledge, and inside one provenance class the newest
 * entry comes first. Both store implementations apply this comparator so the
 * observable order is identical.
 */
export function compareRetrievablePrecedence(
  left: { state: string; createdAt: string; id: string },
  right: { state: string; createdAt: string; id: string },
): number {
  const rank = (state: string): number => (state === "verified" ? 0 : 1);
  if (rank(left.state) !== rank(right.state)) {
    return rank(left.state) - rank(right.state);
  }
  const leftCreated = Date.parse(left.createdAt);
  const rightCreated = Date.parse(right.createdAt);
  if (leftCreated !== rightCreated) return rightCreated - leftCreated;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function retrievableFilterMatches(
  record: CaioMemoryCandidateRecord,
  input: { workspaceId: string; projectRef?: string; id?: string; now: Date },
): boolean {
  if (record.workspaceId !== input.workspaceId) return false;
  if (input.id !== undefined && record.id !== input.id) return false;
  if (
    input.projectRef !== undefined &&
    record.projectRef !== null &&
    record.projectRef !== input.projectRef
  ) {
    return false;
  }
  if (
    record.state === "ephemeral" &&
    (record.ephemeralExpiresAt === null ||
      input.now.getTime() >= Date.parse(record.ephemeralExpiresAt))
  ) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// In-memory implementation (unit-test port)
// ---------------------------------------------------------------------------

export function createInMemoryCaioMemoryStore(): CaioMemoryCandidateStore {
  const records = new Map<string, CaioMemoryCandidateRecord>();

  const load = (
    workspaceId: string,
    id: string,
  ): CaioMemoryCandidateRecord => {
    const record = records.get(id);
    if (!record || record.workspaceId !== workspaceId) {
      throw new CaioMemoryError(
        "not_found",
        "The memory entry does not exist in this workspace.",
      );
    }
    return record;
  };

  // Synchronous conditional state swap: the check and the write happen in one
  // JS turn, so of two concurrent adopts exactly one observes "candidate".
  const conditionalTransition = (
    id: string,
    expectedState: CaioMemoryState,
    apply: (record: CaioMemoryCandidateRecord) => CaioMemoryCandidateRecord,
  ): CaioMemoryCandidateRecord => {
    const record = records.get(id);
    if (!record) {
      throw new CaioMemoryError("not_found", "The memory entry disappeared.");
    }
    if (record.state !== expectedState) {
      throw new CaioMemoryError(
        "illegal_transition",
        `Memory transition from ${record.state} is not allowed here.`,
      );
    }
    const next = Object.freeze(apply(record));
    records.set(id, next);
    return next;
  };

  return Object.freeze({
    async createCandidate(input, now) {
      const record = buildNewCandidate(input, now);
      records.set(record.id, record);
      return record;
    },

    async listOwnCandidates(input) {
      return Object.freeze(
        [...records.values()].filter(
          (record) =>
            record.workspaceId === input.workspaceId &&
            record.createdByRef === input.userRef &&
            record.state === "candidate",
        ),
      );
    },

    async queryRetrievableMemory(input) {
      const matched = [...records.values()]
        .filter((record) => retrievableFilterMatches(record, input))
        .sort(compareRetrievablePrecedence);
      const entries: RetrievableMemoryEntry[] = [];
      for (const record of matched) {
        const entry = toRetrievableEntry(record);
        if (entry) entries.push(entry);
      }
      return Object.freeze(entries);
    },

    async adoptCandidate(input) {
      const record = load(input.workspaceId, input.candidateId);
      if (record.createdByRef !== input.actorRef) {
        throw new CaioMemoryError(
          "forbidden",
          "Only the creator may adopt a memory candidate.",
        );
      }
      if (record.state === "candidate") {
        if (input.now.getTime() >= Date.parse(record.candidateExpiresAt)) {
          throw new CaioMemoryError(
            "expired",
            "The candidate TTL elapsed; it can no longer be adopted.",
          );
        }
      }
      assertLegalMemoryTransition(record.state, "ephemeral");
      const nowIso = input.now.toISOString();
      const adoptedProjectRef = resolveAdoptionProjectRef({
        currentProjectRef: record.projectRef,
        targetProjectRef: input.targetProjectRef,
        promoteToWorkspaceScope: input.promoteToWorkspaceScope,
      });
      return conditionalTransition(record.id, "candidate", (current) => ({
        ...current,
        state: "ephemeral",
        projectRef: adoptedProjectRef,
        adoptedAt: nowIso,
        adoptedByRef: input.actorRef,
        ephemeralExpiresAt: new Date(
          input.now.getTime() + EPHEMERAL_TTL_MS,
        ).toISOString(),
        updatedAt: nowIso,
      }));
    },

    async rejectCandidate(input) {
      const record = load(input.workspaceId, input.candidateId);
      if (record.createdByRef !== input.actorRef) {
        throw new CaioMemoryError(
          "forbidden",
          "Only the creator may reject a memory candidate.",
        );
      }
      assertLegalMemoryTransition(record.state, "rejected");
      const nowIso = input.now.toISOString();
      return conditionalTransition(record.id, "candidate", (current) => ({
        ...current,
        state: "rejected",
        body: null,
        rejectedAt: nowIso,
        rejectedByRef: input.actorRef,
        updatedAt: nowIso,
      }));
    },

    async expireCandidates(input) {
      let expired = 0;
      const nowIso = input.now.toISOString();
      for (const record of records.values()) {
        if (record.workspaceId !== input.workspaceId) continue;
        const candidateElapsed =
          record.state === "candidate" &&
          input.now.getTime() >= Date.parse(record.candidateExpiresAt);
        const ephemeralElapsed =
          record.state === "ephemeral" &&
          record.ephemeralExpiresAt !== null &&
          input.now.getTime() >= Date.parse(record.ephemeralExpiresAt);
        if (!candidateElapsed && !ephemeralElapsed) continue;
        assertLegalMemoryTransition(record.state, "expired");
        records.set(
          record.id,
          Object.freeze({
            ...record,
            state: "expired" as const,
            body: null,
            expiredAt: nowIso,
            updatedAt: nowIso,
          }),
        );
        expired += 1;
      }
      return expired;
    },

    async verifyEphemeral(input) {
      if (input.actorIsKnowledgeOwner !== true) {
        throw new CaioMemoryError(
          "forbidden",
          "Only a knowledge owner may verify an ephemeral memory entry.",
        );
      }
      const record = load(input.workspaceId, input.candidateId);
      if (
        record.state === "ephemeral" &&
        (record.ephemeralExpiresAt === null ||
          input.now.getTime() >= Date.parse(record.ephemeralExpiresAt))
      ) {
        throw new CaioMemoryError(
          "expired",
          "The ephemeral TTL elapsed; the entry can no longer be verified.",
        );
      }
      assertLegalMemoryTransition(record.state, "verified");
      const nowIso = input.now.toISOString();
      return conditionalTransition(record.id, "ephemeral", (current) => ({
        ...current,
        state: "verified",
        verifiedAt: nowIso,
        verifiedByRef: input.actorRef,
        updatedAt: nowIso,
      }));
    },
  });
}

// ---------------------------------------------------------------------------
// Prisma adapter
// ---------------------------------------------------------------------------

type StoredCandidateRow = {
  id: string;
  workspaceId: string;
  projectRef: string | null;
  createdByRef: string;
  state: string;
  body: string | null;
  contentHash: string;
  sourceRequestId: string | null;
  receiptJson: string;
  createdAt: Date;
  candidateExpiresAt: Date;
  adoptedAt: Date | null;
  adoptedByRef: string | null;
  ephemeralExpiresAt: Date | null;
  verifiedAt: Date | null;
  verifiedByRef: string | null;
  rejectedAt: Date | null;
  rejectedByRef: string | null;
  expiredAt: Date | null;
  updatedAt: Date;
};

function parseStoredCandidate(
  row: StoredCandidateRow,
): CaioMemoryCandidateRecord {
  const parsed = caioMemoryCandidateRecordSchema.safeParse({
    id: row.id,
    workspaceId: row.workspaceId,
    projectRef: row.projectRef,
    createdByRef: row.createdByRef,
    state: row.state,
    body: row.body,
    contentHash: row.contentHash,
    sourceRequestId: row.sourceRequestId,
    receiptJson: row.receiptJson,
    createdAt: row.createdAt.toISOString(),
    candidateExpiresAt: row.candidateExpiresAt.toISOString(),
    adoptedAt: row.adoptedAt?.toISOString() ?? null,
    adoptedByRef: row.adoptedByRef,
    ephemeralExpiresAt: row.ephemeralExpiresAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    verifiedByRef: row.verifiedByRef,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedByRef: row.rejectedByRef,
    expiredAt: row.expiredAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  });
  if (!parsed.success) {
    throw new CaioMemoryError(
      "internal_error",
      "A stored memory candidate failed contract validation.",
    );
  }
  return Object.freeze(parsed.data);
}

export function createPrismaCaioMemoryStore(): CaioMemoryCandidateStore {
  const loadRow = async (
    workspaceId: string,
    id: string,
  ): Promise<StoredCandidateRow> => {
    const row = await db.caioMemoryCandidate.findFirst({
      where: { id, workspaceId },
    });
    if (!row) {
      throw new CaioMemoryError(
        "not_found",
        "The memory entry does not exist in this workspace.",
      );
    }
    return row;
  };

  return Object.freeze({
    async createCandidate(input, now) {
      const record = buildNewCandidate(input, now);
      await db.caioMemoryCandidate.create({
        data: {
          id: record.id,
          workspaceId: record.workspaceId,
          projectRef: record.projectRef,
          createdByRef: record.createdByRef,
          state: record.state,
          body: record.body,
          contentHash: record.contentHash,
          sourceRequestId: record.sourceRequestId,
          receiptJson: record.receiptJson,
          createdAt: new Date(record.createdAt),
          candidateExpiresAt: new Date(record.candidateExpiresAt),
          updatedAt: new Date(record.updatedAt),
        },
      });
      return record;
    },

    async listOwnCandidates(input) {
      const rows = await db.caioMemoryCandidate.findMany({
        where: {
          workspaceId: input.workspaceId,
          createdByRef: input.userRef,
          state: "candidate",
        },
        orderBy: { createdAt: "asc" },
      });
      return Object.freeze(rows.map(parseStoredCandidate));
    },

    async queryRetrievableMemory(input) {
      // The state filter lives in the WHERE clause: candidates are excluded
      // at the store layer even when an id is requested directly.
      const rows = await db.caioMemoryCandidate.findMany({
        where: {
          workspaceId: input.workspaceId,
          ...(input.id !== undefined ? { id: input.id } : {}),
          OR: [
            { state: "verified" },
            {
              state: "ephemeral",
              ephemeralExpiresAt: { gt: input.now },
            },
          ],
          ...(input.projectRef !== undefined
            ? {
                AND: [
                  {
                    OR: [
                      { projectRef: null },
                      { projectRef: input.projectRef },
                    ],
                  },
                ],
              }
            : {}),
        },
        // Verified before ephemeral, then newest first. The SQL order is
        // deterministic on its own; the shared comparator below then
        // guarantees the exact same observable order as the in-memory store.
        orderBy: [{ state: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      });
      const records = rows
        .map(parseStoredCandidate)
        .sort(compareRetrievablePrecedence);
      const entries: RetrievableMemoryEntry[] = [];
      for (const record of records) {
        const entry = toRetrievableEntry(record);
        if (entry) entries.push(entry);
      }
      return Object.freeze(entries);
    },

    async adoptCandidate(input) {
      const row = await loadRow(input.workspaceId, input.candidateId);
      if (row.createdByRef !== input.actorRef) {
        throw new CaioMemoryError(
          "forbidden",
          "Only the creator may adopt a memory candidate.",
        );
      }
      if (
        row.state === "candidate" &&
        input.now.getTime() >= row.candidateExpiresAt.getTime()
      ) {
        throw new CaioMemoryError(
          "expired",
          "The candidate TTL elapsed; it can no longer be adopted.",
        );
      }
      assertLegalMemoryTransition(
        parseStoredCandidate(row).state,
        "ephemeral",
      );
      const adoptedProjectRef = resolveAdoptionProjectRef({
        currentProjectRef: row.projectRef,
        targetProjectRef: input.targetProjectRef,
        promoteToWorkspaceScope: input.promoteToWorkspaceScope,
      });
      // Single conditional write: only one concurrent adopt can flip
      // state="candidate" to "ephemeral".
      const updated = await db.caioMemoryCandidate.updateMany({
        where: {
          id: input.candidateId,
          workspaceId: input.workspaceId,
          state: "candidate",
          adoptedByRef: null,
        },
        data: {
          state: "ephemeral",
          projectRef: adoptedProjectRef,
          adoptedAt: input.now,
          adoptedByRef: input.actorRef,
          ephemeralExpiresAt: new Date(
            input.now.getTime() + EPHEMERAL_TTL_MS,
          ),
          updatedAt: input.now,
        },
      });
      if (updated.count !== 1) {
        throw new CaioMemoryError(
          "conflict",
          "The candidate was transitioned concurrently.",
        );
      }
      return parseStoredCandidate(
        await loadRow(input.workspaceId, input.candidateId),
      );
    },

    async rejectCandidate(input) {
      const row = await loadRow(input.workspaceId, input.candidateId);
      if (row.createdByRef !== input.actorRef) {
        throw new CaioMemoryError(
          "forbidden",
          "Only the creator may reject a memory candidate.",
        );
      }
      assertLegalMemoryTransition(parseStoredCandidate(row).state, "rejected");
      const updated = await db.caioMemoryCandidate.updateMany({
        where: {
          id: input.candidateId,
          workspaceId: input.workspaceId,
          state: "candidate",
        },
        data: {
          state: "rejected",
          body: null,
          rejectedAt: input.now,
          rejectedByRef: input.actorRef,
          updatedAt: input.now,
        },
      });
      if (updated.count !== 1) {
        throw new CaioMemoryError(
          "conflict",
          "The candidate was transitioned concurrently.",
        );
      }
      return parseStoredCandidate(
        await loadRow(input.workspaceId, input.candidateId),
      );
    },

    async expireCandidates(input) {
      const expiredCandidates = await db.caioMemoryCandidate.updateMany({
        where: {
          workspaceId: input.workspaceId,
          state: "candidate",
          candidateExpiresAt: { lte: input.now },
        },
        data: {
          state: "expired",
          body: null,
          expiredAt: input.now,
          updatedAt: input.now,
        },
      });
      const expiredEphemerals = await db.caioMemoryCandidate.updateMany({
        where: {
          workspaceId: input.workspaceId,
          state: "ephemeral",
          ephemeralExpiresAt: { lte: input.now },
        },
        data: {
          state: "expired",
          body: null,
          expiredAt: input.now,
          updatedAt: input.now,
        },
      });
      return expiredCandidates.count + expiredEphemerals.count;
    },

    async verifyEphemeral(input) {
      if (input.actorIsKnowledgeOwner !== true) {
        throw new CaioMemoryError(
          "forbidden",
          "Only a knowledge owner may verify an ephemeral memory entry.",
        );
      }
      const row = await loadRow(input.workspaceId, input.candidateId);
      if (
        row.state === "ephemeral" &&
        (row.ephemeralExpiresAt === null ||
          input.now.getTime() >= row.ephemeralExpiresAt.getTime())
      ) {
        throw new CaioMemoryError(
          "expired",
          "The ephemeral TTL elapsed; the entry can no longer be verified.",
        );
      }
      assertLegalMemoryTransition(parseStoredCandidate(row).state, "verified");
      const updated = await db.caioMemoryCandidate.updateMany({
        where: {
          id: input.candidateId,
          workspaceId: input.workspaceId,
          state: "ephemeral",
        },
        data: {
          state: "verified",
          verifiedAt: input.now,
          verifiedByRef: input.actorRef,
          updatedAt: input.now,
        },
      });
      if (updated.count !== 1) {
        throw new CaioMemoryError(
          "conflict",
          "The entry was transitioned concurrently.",
        );
      }
      return parseStoredCandidate(
        await loadRow(input.workspaceId, input.candidateId),
      );
    },
  });
}
