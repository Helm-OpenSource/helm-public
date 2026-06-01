import {
  ExternalSyncProvider,
  ObjectType,
} from "@prisma/client";
import type { MemoryDistillationCandidateStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { buildReflectionCandidateReadout } from "@/lib/helm-v2/runtime-upgrade";
import {
  buildMemoryEntrySourceWhere,
  type MemorySourceFilter,
} from "@/lib/memory/source-filter";
import { safeParseJson } from "@/lib/utils";

export {
  buildMemoryEntrySourceWhere,
  normalizeMemorySourceFilter,
  type MemorySourceFilter,
} from "@/lib/memory/source-filter";
export type MemoryObjectLevel = "ALL" | "WORKSPACE" | "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING";

export type MemoryDistillationCandidateReadout = {
  id: string;
  objectType: ObjectType;
  objectId: string;
  factType: string;
  title: string;
  summary: string;
  sourceFactIds: string[];
  evidenceRefs: string[];
  sourceRefs: string[];
  repeatCount: number;
  confidence: number;
  reviewPosture: string;
  status: MemoryDistillationCandidateStatus;
  boundaryNote: string;
  createdFrom: string;
  latestSourceAt: Date;
  decisionReason: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MemoryDistillationCandidateRow = {
  id: string;
  objectType: ObjectType;
  objectId: string;
  factType: string;
  title: string;
  summary: string;
  sourceFactIds: string;
  evidenceRefs: string;
  sourceRefs: string;
  repeatCount: number;
  confidence: number;
  reviewPosture: string;
  status: MemoryDistillationCandidateStatus;
  boundaryNote: string;
  createdFrom: string;
  latestSourceAt: Date;
  decisionReason: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const REVIEWED_DISTILLATION_CANDIDATE_STATUSES = [
  "APPROVED",
  "REJECTED",
  "DEFERRED",
] as const satisfies readonly MemoryDistillationCandidateStatus[];

const PENDING_DISTILLATION_CANDIDATE_STATUSES = [
  "PENDING_REVIEW",
] as const satisfies readonly MemoryDistillationCandidateStatus[];

export function buildMemoryDistillationCandidateWhere(options: {
  workspaceId: string;
  query?: string;
  objectLevel?: MemoryObjectLevel;
  objectType?: ObjectType;
  objectId?: string;
  statuses: MemoryDistillationCandidateStatus[];
}) {
  const objectLevel = options.objectLevel ?? "ALL";
  return {
    workspaceId: options.workspaceId,
    status: { in: options.statuses },
    ...(objectLevel !== "ALL" && objectLevel !== "WORKSPACE"
      ? { objectType: objectLevel as ObjectType }
      : {}),
    ...(options.objectType ? { objectType: options.objectType } : {}),
    ...(options.objectType && options.objectId ? { objectId: options.objectId } : {}),
    ...(options.query
      ? {
          OR: [
            { title: { contains: options.query } },
            { summary: { contains: options.query } },
            { groupKey: { contains: options.query } },
          ],
        }
      : {}),
  } as const;
}

export function buildMemoryDistillationCandidateReadout(
  item: MemoryDistillationCandidateRow,
): MemoryDistillationCandidateReadout {
  return {
    ...item,
    sourceFactIds: safeParseJson<string[]>(item.sourceFactIds, []),
    evidenceRefs: safeParseJson<string[]>(item.evidenceRefs, []),
    sourceRefs: safeParseJson<string[]>(item.sourceRefs, []),
  };
}

export async function getMemoryData(
  workspaceId: string,
  options?: {
    query?: string;
    dimension?: MemoryObjectLevel;
    objectLevel?: MemoryObjectLevel;
    source?: MemorySourceFilter;
    objectType?: ObjectType;
    objectId?: string;
  },
) {
  type ReflectionCandidateRow = {
    id: string;
    status: string;
    summary: string;
    reviewerNote: string | null;
    sourceVerification: string;
    sourceStatus: string;
    evidenceRefs: string | null;
    createdAt: Date;
    runtimeSession: {
      id: string;
      label: string;
      meetingId: string | null;
    } | null;
  };

  const query = options?.query;
  const objectLevel = options?.objectLevel ?? options?.dimension ?? "ALL";
  const source = options?.source ?? "ALL";
  const includeOpenClaw = source !== "HELM";
  const includeHelm = source !== "OPENCLAW";

  const entrySourceWhere = buildMemoryEntrySourceWhere(source);

  const memoryEntryWhere = {
    workspaceId,
    deletedAt: null,
    ...entrySourceWhere,
    ...(objectLevel !== "ALL" ? { entityType: objectLevel } : {}),
    ...(options?.objectType === ObjectType.CONTACT ? { contactId: options.objectId } : {}),
    ...(options?.objectType === ObjectType.COMPANY ? { companyId: options.objectId } : {}),
    ...(options?.objectType === ObjectType.OPPORTUNITY ? { opportunityId: options.objectId } : {}),
    ...(options?.objectType === ObjectType.MEETING ? { meetingId: options.objectId } : {}),
    ...(query
      ? {
          OR: [{ title: { contains: query } }, { content: { contains: query } }, { source: { contains: query } }],
        }
      : {}),
  } as const;

  const shouldReturnOpenClawRecords = includeOpenClaw && (objectLevel === "ALL" || objectLevel === "WORKSPACE");
  const shouldReturnReflectionCandidates =
    includeHelm &&
    (objectLevel === "ALL" || objectLevel === "WORKSPACE" || objectLevel === "MEETING" || options?.objectType === ObjectType.MEETING);
  const reflectionCandidatePromise: Promise<ReflectionCandidateRow[]> =
    shouldReturnReflectionCandidates
      ? db.memoryCandidate.findMany({
          where: {
            AND: [
              { workspaceId },
              { status: { in: ["VERIFIED", "PROMOTED", "REJECTED"] } },
              {
                OR: [
                  { sourceVerification: "human_confirmed_reflection" },
                  { sourceStatus: "trusted_runtime_compaction" },
                ],
              },
            ],
            ...(options?.objectType === ObjectType.MEETING ? { meetingId: options.objectId } : {}),
            ...(objectLevel === "MEETING" && !options?.objectType ? { meetingId: { not: null } } : {}),
            ...(query
              ? {
                  OR: [
                    { summary: { contains: query } },
                    { reviewerNote: { contains: query } },
                    { runtimeSession: { is: { label: { contains: query } } } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            status: true,
            summary: true,
            reviewerNote: true,
            sourceVerification: true,
            sourceStatus: true,
            evidenceRefs: true,
            createdAt: true,
            runtimeSession: {
              select: {
                id: true,
                label: true,
                meetingId: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]);
  const distillationCandidateSelect = {
    id: true,
    objectType: true,
    objectId: true,
    factType: true,
    title: true,
    summary: true,
    sourceFactIds: true,
    evidenceRefs: true,
    sourceRefs: true,
    repeatCount: true,
    confidence: true,
    reviewPosture: true,
    status: true,
    boundaryNote: true,
    createdFrom: true,
    latestSourceAt: true,
    decisionReason: true,
    decidedAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;
  const memoryDistillationCandidateDelegate = (
    db as typeof db & {
      memoryDistillationCandidate?: {
        findMany: (args: unknown) => Promise<MemoryDistillationCandidateRow[]>;
      };
    }
  ).memoryDistillationCandidate;
  const distillationCandidatesPromise: Promise<MemoryDistillationCandidateRow[]> = includeHelm
    ? memoryDistillationCandidateDelegate?.findMany({
        where: buildMemoryDistillationCandidateWhere({
          workspaceId,
          query,
          objectLevel,
          objectType: options?.objectType,
          objectId: options?.objectId,
          statuses: [...PENDING_DISTILLATION_CANDIDATE_STATUSES],
        }),
        select: distillationCandidateSelect,
        orderBy: [
          { latestSourceAt: "desc" },
          { createdAt: "desc" },
          { id: "asc" },
        ],
        take: 24,
      }) ?? Promise.resolve([])
    : Promise.resolve([]);
  const distillationDecisionsPromise: Promise<MemoryDistillationCandidateRow[]> = includeHelm
    ? memoryDistillationCandidateDelegate?.findMany({
        where: buildMemoryDistillationCandidateWhere({
          workspaceId,
          query,
          objectLevel,
          objectType: options?.objectType,
          objectId: options?.objectId,
          statuses: [...REVIEWED_DISTILLATION_CANDIDATE_STATUSES],
        }),
        select: distillationCandidateSelect,
        orderBy: [
          { decidedAt: "desc" },
          { updatedAt: "desc" },
          { id: "asc" },
        ],
        take: 12,
      }) ?? Promise.resolve([])
    : Promise.resolve([]);

  const [
    memoryEntries,
    memoryFacts,
    commitments,
    blockers,
    corrections,
    auditLogs,
    externalMemoryRecords,
    reflectionCandidates,
    distillationCandidates,
    distillationDecisions,
  ] =
    await Promise.all([
      db.memoryEntry.findMany({
        where: memoryEntryWhere,
        include: {
          contact: true,
          company: true,
          opportunity: true,
          meeting: true,
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      includeHelm
        ? db.memoryFact.findMany({
            where: {
              workspaceId,
              ...(objectLevel !== "ALL" && objectLevel !== "WORKSPACE" ? { objectType: objectLevel } : {}),
              ...(options?.objectType ? { objectType: options.objectType, objectId: options.objectId } : {}),
              ...(query
                ? {
                    OR: [{ title: { contains: query } }, { content: { contains: query } }, { sourceId: { contains: query } }],
                  }
                : {}),
            },
            orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
          })
        : Promise.resolve([]),
      includeHelm
        ? db.commitment.findMany({
            where: {
              workspaceId,
              ...(objectLevel !== "ALL" && objectLevel !== "WORKSPACE"
                ? objectLevel === "CONTACT"
                  ? { relatedContactId: { not: null } }
                  : objectLevel === "COMPANY"
                    ? { relatedCompanyId: { not: null } }
                    : objectLevel === "OPPORTUNITY"
                      ? { relatedOpportunityId: { not: null } }
                      : { relatedMeetingId: { not: null } }
                : {}),
              ...(options?.objectType === ObjectType.CONTACT ? { relatedContactId: options.objectId } : {}),
              ...(options?.objectType === ObjectType.COMPANY ? { relatedCompanyId: options.objectId } : {}),
              ...(options?.objectType === ObjectType.OPPORTUNITY ? { relatedOpportunityId: options.objectId } : {}),
              ...(options?.objectType === ObjectType.MEETING ? { relatedMeetingId: options.objectId } : {}),
              ...(query ? { OR: [{ title: { contains: query } }, { commitmentText: { contains: query } }] } : {}),
            },
            include: {
              relatedContact: true,
              relatedCompany: true,
              relatedOpportunity: true,
              relatedMeeting: true,
              ownerUser: true,
            },
            orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          })
        : Promise.resolve([]),
      includeHelm
        ? db.blocker.findMany({
            where: {
              workspaceId,
              ...(objectLevel !== "ALL" && objectLevel !== "WORKSPACE"
                ? objectLevel === "CONTACT"
                  ? { relatedContactId: { not: null } }
                  : objectLevel === "COMPANY"
                    ? { relatedCompanyId: { not: null } }
                    : objectLevel === "OPPORTUNITY"
                      ? { relatedOpportunityId: { not: null } }
                      : { relatedMeetingId: { not: null } }
                : {}),
              ...(options?.objectType === ObjectType.CONTACT ? { relatedContactId: options.objectId } : {}),
              ...(options?.objectType === ObjectType.COMPANY ? { relatedCompanyId: options.objectId } : {}),
              ...(options?.objectType === ObjectType.OPPORTUNITY ? { relatedOpportunityId: options.objectId } : {}),
              ...(options?.objectType === ObjectType.MEETING ? { relatedMeetingId: options.objectId } : {}),
              ...(query
                ? {
                    OR: [
                      { title: { contains: query } },
                      { blockerText: { contains: query } },
                      { blockerType: { contains: query } },
                    ],
                  }
                : {}),
            },
            include: {
              relatedContact: true,
              relatedCompany: true,
              relatedOpportunity: true,
              relatedMeeting: true,
            },
            orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
          })
        : Promise.resolve([]),
      includeHelm
        ? db.memoryCorrection.findMany({
            where: {
              workspaceId,
              ...(options?.objectType && options?.objectId
                ? {
                    memoryFact: {
                      objectType: options.objectType,
                      objectId: options.objectId,
                    },
                  }
                : {}),
            },
            include: {
              memoryFact: true,
              correctedByUser: true,
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      includeHelm
        ? db.auditLog.findMany({
            where: {
              workspaceId,
              ...(options?.objectType && options?.objectId
                ? {
                    OR: [
                      { relatedObjectType: options.objectType, relatedObjectId: options.objectId },
                      { targetId: options.objectId },
                    ],
                  }
                : {}),
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
      shouldReturnOpenClawRecords
        ? db.externalMemoryRecord.findMany({
            where: {
              workspaceId,
              provider: ExternalSyncProvider.OPENCLAW,
              ...(query
                ? {
                    OR: [
                      { text: { contains: query } },
                      { category: { contains: query } },
                      { scope: { contains: query } },
                    ],
                  }
                : {}),
            },
            orderBy: [{ occurredAt: "desc" }],
          })
        : Promise.resolve([]),
      reflectionCandidatePromise,
      distillationCandidatesPromise,
      distillationDecisionsPromise,
    ]);

  return {
    source,
    objectLevel,
    memoryEntries,
    memoryFacts,
    commitments,
    blockers,
    corrections,
    auditLogs,
    externalMemoryRecords,
    reflectionCandidates: reflectionCandidates.flatMap((item) =>
      item.runtimeSession && item.status === "VERIFIED"
        ? [
            buildReflectionCandidateReadout({
              ...item,
              runtimeSession: item.runtimeSession,
            }),
          ]
        : [],
    ),
    reflectionDecisions: reflectionCandidates.flatMap((item) =>
      item.runtimeSession && item.status !== "VERIFIED"
        ? [
            buildReflectionCandidateReadout({
              ...item,
              runtimeSession: item.runtimeSession,
            }),
          ]
        : [],
    ),
    distillationCandidates: distillationCandidates.map(buildMemoryDistillationCandidateReadout),
    distillationDecisions: distillationDecisions.map(buildMemoryDistillationCandidateReadout),
  };
}
