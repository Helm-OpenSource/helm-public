import { ActorType, MemoryFactType, MemoryStatus, ObjectType, SourceType, type MemoryFact, type Prisma } from "@prisma/client";
import { assertWorkspaceMemoryServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { extractMeetingFactDrafts, type MeetingFactExtractionInput } from "@/lib/memory/fact-extraction.service";
import {
  MEMORY_OBJECT_RETRIEVAL_LIMIT,
  type MemoryFactPageCursor,
  resolveMemoryBoundedLimit,
} from "@/lib/memory/query-contract";
import {
  type MemoryActorContext,
  type ObjectReference,
  getObjectExists,
  isFactRelevant,
  writeMemoryAuditAndEvent,
} from "@/lib/memory/shared";
import { jsonStringify } from "@/lib/utils";

type GetFactsInput = {
  workspaceId: string;
  objectType?: ObjectType;
  objectId?: string;
  factType?: MemoryFactType;
  status?: MemoryStatus;
  query?: string;
  limit?: number;
  cursor?: MemoryFactPageCursor | null;
};

export type CreateFactInput = MemoryActorContext & {
  objectType: ObjectType;
  objectId: string;
  factType: MemoryFactType;
  title: string;
  content: string;
  sourceType: SourceType;
  sourceId: string;
  normalizedValue?: unknown;
  confidence?: number;
  importance?: number;
  freshnessScore?: number;
  status?: MemoryStatus;
  confirmedByUser?: boolean;
  createdBySystem?: boolean;
};

export type MemoryFactWriteFailureClass =
  | "retryable"
  | "non_retryable"
  | "operator_review_required";

export type MemoryFactWriteFailureReason =
  | "database_unavailable"
  | "database_timeout"
  | "transaction_conflict"
  | "object_not_found"
  | "db_unique_conflict"
  | "db_constraint_or_validation"
  | "unknown_write_failure";

export type MemoryFactBatchWriteFailure = {
  failureClass: MemoryFactWriteFailureClass;
  reason: MemoryFactWriteFailureReason;
  message: string;
  title: string;
  objectType: ObjectType;
  objectId: string;
  factType: MemoryFactType;
  sourceType: SourceType;
  sourceId: string;
  retryable: boolean;
  operatorReviewRequired: boolean;
};

export type MemoryFactBatchWriteResult = {
  created: MemoryFact[];
  failures: MemoryFactBatchWriteFailure[];
  summary: {
    inputFactCount: number;
    attemptedFactCount: number;
    createdFactCount: number;
    failedFactCount: number;
    retryableFailureCount: number;
    nonRetryableFailureCount: number;
    operatorReviewRequiredCount: number;
    writeMode: "sequential_guarded_batch";
    failurePolicy: "fail_fast" | "collect_all";
    status: "complete" | "partial_failed" | "blocked";
    boundaryNote: string;
  };
};

type MemoryFactWriteFn = (fact: CreateFactInput) => Promise<MemoryFact>;

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown memory fact write failure";
}

export function classifyMemoryFactWriteFailure(error: unknown): Pick<
  MemoryFactBatchWriteFailure,
  "failureClass" | "reason" | "retryable" | "operatorReviewRequired"
> {
  const code = errorCode(error);
  const message = errorMessage(error);

  if (message.includes("未找到对应对象") || /object not found|record not found/i.test(message)) {
    return {
      failureClass: "non_retryable",
      reason: "object_not_found",
      retryable: false,
      operatorReviewRequired: false,
    };
  }

  if (["P1001", "P1002", "P1008", "P1017"].includes(code) || /can't reach database|connection/i.test(message)) {
    return {
      failureClass: "retryable",
      reason: "database_unavailable",
      retryable: true,
      operatorReviewRequired: false,
    };
  }

  if (code === "P2024" || /timed out|timeout/i.test(message)) {
    return {
      failureClass: "retryable",
      reason: "database_timeout",
      retryable: true,
      operatorReviewRequired: false,
    };
  }

  if (code === "P2034" || /transaction conflict|deadlock/i.test(message)) {
    return {
      failureClass: "retryable",
      reason: "transaction_conflict",
      retryable: true,
      operatorReviewRequired: false,
    };
  }

  if (code === "P2002") {
    return {
      failureClass: "operator_review_required",
      reason: "db_unique_conflict",
      retryable: false,
      operatorReviewRequired: true,
    };
  }

  if (["P2000", "P2001", "P2003", "P2025"].includes(code) || /constraint|invalid/i.test(message)) {
    return {
      failureClass: "non_retryable",
      reason: "db_constraint_or_validation",
      retryable: false,
      operatorReviewRequired: false,
    };
  }

  return {
    failureClass: "operator_review_required",
    reason: "unknown_write_failure",
    retryable: false,
    operatorReviewRequired: true,
  };
}

function buildMemoryFactBatchWriteFailure(fact: CreateFactInput, error: unknown): MemoryFactBatchWriteFailure {
  const classification = classifyMemoryFactWriteFailure(error);

  return {
    ...classification,
    message: errorMessage(error),
    title: fact.title,
    objectType: fact.objectType,
    objectId: fact.objectId,
    factType: fact.factType,
    sourceType: fact.sourceType,
    sourceId: fact.sourceId,
  };
}

function summarizeMemoryFactBatchWrite(args: {
  inputFactCount: number;
  attemptedFactCount: number;
  createdCount: number;
  failures: MemoryFactBatchWriteFailure[];
  failurePolicy: MemoryFactBatchWriteResult["summary"]["failurePolicy"];
}): MemoryFactBatchWriteResult["summary"] {
  const retryableFailureCount = args.failures.filter((item) => item.failureClass === "retryable").length;
  const nonRetryableFailureCount = args.failures.filter((item) => item.failureClass === "non_retryable").length;
  const operatorReviewRequiredCount = args.failures.filter((item) => item.operatorReviewRequired).length;

  return {
    inputFactCount: args.inputFactCount,
    attemptedFactCount: args.attemptedFactCount,
    createdFactCount: args.createdCount,
    failedFactCount: args.failures.length,
    retryableFailureCount,
    nonRetryableFailureCount,
    operatorReviewRequiredCount,
    writeMode: "sequential_guarded_batch",
    failurePolicy: args.failurePolicy,
    status: args.failures.length === 0 ? "complete" : args.createdCount > 0 ? "partial_failed" : "blocked",
    boundaryNote:
      "Memory fact batch write classifies failures for audit and review; it does not retry automatically, rewrite canonical facts, or change recommendation / commitment authority.",
  };
}

export async function getMemoryFacts(input: GetFactsInput) {
  const where: Prisma.MemoryFactWhereInput = {
    workspaceId: input.workspaceId,
    ...(input.objectType ? { objectType: input.objectType } : {}),
    ...(input.objectId ? { objectId: input.objectId } : {}),
    ...(input.factType ? { factType: input.factType } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.query
      ? {
          OR: [{ title: { contains: input.query } }, { content: { contains: input.query } }, { sourceId: { contains: input.query } }],
        }
      : {}),
  };

  if (input.cursor) {
    where.AND = [
      {
        OR: [
          { importance: { lt: input.cursor.importance } },
          {
            importance: input.cursor.importance,
            createdAt: { lt: new Date(input.cursor.createdAt) },
          },
          {
            importance: input.cursor.importance,
            createdAt: new Date(input.cursor.createdAt),
            id: { lt: input.cursor.id },
          },
        ],
      },
    ];
  }

  return db.memoryFact.findMany({
    where,
    orderBy: [{ importance: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: input.limit ?? 50,
  });
}

export async function createMemoryFact(input: CreateFactInput) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const exists = await getObjectExists(input.workspaceId, input.objectType, input.objectId);
  if (!exists) {
    throw new Error("未找到对应对象");
  }

  const created = await db.memoryFact.create({
    data: {
      workspaceId: input.workspaceId,
      objectType: input.objectType,
      objectId: input.objectId,
      factType: input.factType,
      title: input.title,
      content: input.content,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      normalizedValue: input.normalizedValue ? jsonStringify(input.normalizedValue) : undefined,
      confidence: input.confidence ?? 65,
      importance: input.importance ?? 60,
      freshnessScore: input.freshnessScore ?? 60,
      status: input.status ?? MemoryStatus.ACTIVE,
      confirmedByUser: input.confirmedByUser ?? false,
      createdBySystem: input.createdBySystem ?? true,
    },
  });

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.SYSTEM,
    sourcePage: input.sourcePage,
    actionType: "MEMORY_FACT_CREATED",
    targetType: "MemoryFact",
    targetId: created.id,
    summary: `新增结构化记忆：${created.title}`,
    eventName: "memory_fact_created",
    eventCategory: "memory",
    metadata: {
      objectType: created.objectType,
      objectId: created.objectId,
      factType: created.factType,
      sourceType: created.sourceType,
      sourceId: created.sourceId,
      confidence: created.confidence,
      importance: created.importance,
    },
  });

  return created;
}

export async function createMemoryFacts(input: { facts: CreateFactInput[] }) {
  const created: MemoryFact[] = [];

  for (const fact of input.facts) {
    created.push(await createMemoryFact(fact));
  }

  return created;
}

export async function createMemoryFactsWithWriteResult(input: {
  facts: CreateFactInput[];
  continueOnFailure?: boolean;
  writeFact?: MemoryFactWriteFn;
}): Promise<MemoryFactBatchWriteResult> {
  const created: MemoryFact[] = [];
  const failures: MemoryFactBatchWriteFailure[] = [];
  const writeFact = input.writeFact ?? createMemoryFact;
  const failurePolicy = input.continueOnFailure ? "collect_all" : "fail_fast";
  let attemptedFactCount = 0;

  for (const fact of input.facts) {
    attemptedFactCount += 1;
    try {
      created.push(await writeFact(fact));
    } catch (error) {
      failures.push(buildMemoryFactBatchWriteFailure(fact, error));
      if (!input.continueOnFailure) break;
    }
  }

  return {
    created,
    failures,
    summary: summarizeMemoryFactBatchWrite({
      inputFactCount: input.facts.length,
      attemptedFactCount,
      createdCount: created.length,
      failures,
      failurePolicy,
    }),
  };
}

export function buildMeetingFactDrafts(input: MemoryActorContext & MeetingFactExtractionInput) {
  return extractMeetingFactDrafts(input);
}

export async function getRelevantMemoryFacts(args: {
  workspaceId: string;
  objectRefs: ObjectReference[];
  limit?: number;
}) {
  const byObject = args.objectRefs.map((item) => ({
    objectType: item.objectType,
    objectId: item.objectId,
  }));

  const boundedLimit = resolveMemoryBoundedLimit(String(args.limit ?? ""), {
    defaultLimit: MEMORY_OBJECT_RETRIEVAL_LIMIT.default,
    maxLimit: MEMORY_OBJECT_RETRIEVAL_LIMIT.max,
  });

  const facts = await db.memoryFact.findMany({
    where: {
      workspaceId: args.workspaceId,
      OR: byObject,
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    take: boundedLimit.limit,
  });

  return facts.filter(isFactRelevant);
}
