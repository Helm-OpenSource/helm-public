import {
  ExternalSyncProvider,
  ObjectType,
  RuntimeMemoryCandidateStatus,
} from "@prisma/client";
import type { MemoryDistillationCandidateStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  buildEvidenceSourceClasses,
  buildReflectionCandidateReadout,
} from "@/lib/helm-v2/runtime-upgrade";
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

type MemberSignalMemoryCandidateRow = {
  id: string;
  candidateKey: string;
  summary: string;
  status: string;
  reviewerNote: string | null;
  sourceVerification: string;
  sourceStatus: string;
  evidenceRefs: string | null;
  createdAt: Date;
};

export type MemberSignalMemoryCandidateProvenance = Readonly<{
  memberRef: string | null;
  signalReceiptRef: string | null;
  gatewaySessionRef: string | null;
}>;

// Member-anchored MemoryCandidate readout (memory member-verification
// plan, Architecture 3). Deliberately separate from
// buildReflectionCandidateReadout above, which this function must NEVER
// touch or feed — that builder's input type requires a non-null
// runtimeSession, which a member-anchored row structurally never has
// (mutually exclusive anchors, MemoryCandidate_anchor_check). sourceClasses
// still reuses buildEvidenceSourceClasses (now exported from
// runtime-upgrade.ts for exactly this caller), the same class-derivation
// logic reflection rows get.
export type MemberSignalMemoryCandidateReadout = Readonly<{
  id: string;
  candidateKey: string;
  summary: string;
  status: string;
  createdAt: Date;
  reviewerNote: string | null;
  sourceClasses: string[];
  // A malformed/tampered sourceStatus blob is marked corrupt rather than
  // guessed at — taint/evaluationUseProhibited/provenance are withheld
  // entirely (null) so a corrupt row can never render as if it carried a
  // verifiable taint/provenance judgment. sourceClasses is still computed:
  // buildEvidenceSourceClasses treats sourceStatus as an opaque string (no
  // JSON.parse of its own), so it degrades independently.
  corrupt: boolean;
  taint: string | null;
  evaluationUseProhibited: boolean | null;
  provenance: MemberSignalMemoryCandidateProvenance | null;
}>;

function buildMemberSignalMemoryCandidateReadout(
  row: MemberSignalMemoryCandidateRow,
): MemberSignalMemoryCandidateReadout {
  const evidenceRefs = safeParseJson<string[]>(row.evidenceRefs, []);
  const sourceClasses = buildEvidenceSourceClasses({
    sourceVerification: row.sourceVerification,
    sourceStatus: row.sourceStatus,
    evidenceRefs,
  });
  const base = {
    id: row.id,
    candidateKey: row.candidateKey,
    summary: row.summary,
    status: row.status,
    createdAt: row.createdAt,
    reviewerNote: row.reviewerNote,
    sourceClasses,
  };

  type ParsedMemberSourceStatus = {
    taint?: unknown;
    evaluationUseProhibited?: unknown;
    provenance?: {
      memberRef?: unknown;
      signalReceiptRef?: unknown;
      gatewaySessionRef?: unknown;
    };
  };

  try {
    const parsed = JSON.parse(row.sourceStatus) as ParsedMemberSourceStatus;
    const provenanceSource = parsed.provenance;
    return {
      ...base,
      corrupt: false,
      taint: typeof parsed.taint === "string" ? parsed.taint : null,
      evaluationUseProhibited:
        typeof parsed.evaluationUseProhibited === "boolean"
          ? parsed.evaluationUseProhibited
          : null,
      provenance: provenanceSource
        ? {
            memberRef:
              typeof provenanceSource.memberRef === "string"
                ? provenanceSource.memberRef
                : null,
            signalReceiptRef:
              typeof provenanceSource.signalReceiptRef === "string"
                ? provenanceSource.signalReceiptRef
                : null,
            gatewaySessionRef:
              typeof provenanceSource.gatewaySessionRef === "string"
                ? provenanceSource.gatewaySessionRef
                : null,
          }
        : null,
    };
  } catch {
    return {
      ...base,
      corrupt: true,
      taint: null,
      evaluationUseProhibited: null,
      provenance: null,
    };
  }
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
  const includeOpenClaw = source === "ALL" || source === "OPENCLAW";
  const includeQoderWork = source === "ALL" || source === "QODERWORK";
  const includeHelm = source === "ALL" || source === "HELM";

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

  const shouldReturnExternalRecords =
    (includeOpenClaw || includeQoderWork) &&
    (objectLevel === "ALL" || objectLevel === "WORKSPACE" || objectLevel === "OPPORTUNITY");
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
  // Member-anchored candidates (memory member-fact-write plan, Architecture
  // 1/3/6): discriminated by the anchor column (memberGatewaySessionRef
  // non-null), never by a sourceStatus/sourceVerification string match —
  // the JSON blob those columns carry for this family would not reliably
  // match the reflection query's exact-equality OR above anyway. Unlike the
  // reflection query, member rows carry no object anchor at all (no
  // meetingId/objectType), so there is no meaningful object-level scoping
  // to apply here; this is gated on includeHelm only, matching the
  // distillation candidate queries below. PROMOTED is included alongside
  // the legacy VERIFIED status: a "verify" decision now lands on PROMOTED
  // (write-on-verify, 2026-08-22 second-round ruling), while any row still
  // sitting at VERIFIED predates that ruling and stays visible, un-migrated.
  const memberSignalMemoryCandidatePromise: Promise<MemberSignalMemoryCandidateRow[]> =
    includeHelm
      ? db.memoryCandidate.findMany({
          where: {
            workspaceId,
            memberGatewaySessionRef: { not: null },
            status: {
              in: [
                RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
                RuntimeMemoryCandidateStatus.VERIFIED,
                RuntimeMemoryCandidateStatus.PROMOTED,
                RuntimeMemoryCandidateStatus.REJECTED,
              ],
            },
          },
          select: {
            id: true,
            candidateKey: true,
            summary: true,
            status: true,
            reviewerNote: true,
            sourceVerification: true,
            sourceStatus: true,
            evidenceRefs: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
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
    memberSignalMemoryCandidates,
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
      shouldReturnExternalRecords
        ? db.externalMemoryRecord.findMany({
            where: {
              workspaceId,
              provider: {
                in: [
                  ...(includeOpenClaw ? [ExternalSyncProvider.OPENCLAW] : []),
                  ...(includeQoderWork ? [ExternalSyncProvider.QODERWORK] : []),
                ],
              },
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
      memberSignalMemoryCandidatePromise,
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
    memberSignalPending: memberSignalMemoryCandidates
      .filter(
        (item) => item.status === RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
      )
      .map(buildMemberSignalMemoryCandidateReadout),
    memberSignalDecisions: memberSignalMemoryCandidates
      .filter(
        (item) => item.status !== RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
      )
      .map(buildMemberSignalMemoryCandidateReadout),
    distillationCandidates: distillationCandidates.map(buildMemoryDistillationCandidateReadout),
    distillationDecisions: distillationDecisions.map(buildMemoryDistillationCandidateReadout),
  };
}

// ---------------------------------------------------------------------------
// Object-first memory facts (2026-10-15 wave 4).
//
// MemoryFact is polymorphic (objectType + objectId, sourceType + sourceId) and
// has no Prisma relations, so the timeline used to print 「对象：联系人」 and
// never showed where a fact came from. These helpers resolve, in a few bounded
// workspace-scoped batches, the object's own name and — where a resolver
// exists — the source's original text (email message body, meeting note).
// Other sources fall back to their type plus a link.
//
// MemoryFact 是多态记录，没有 Prisma 关系。这里按工作区分批查出对象名，以及能解析的
// 来源原文（邮件正文、会议纪要）；解析不了的来源只给类型和链接。
// ---------------------------------------------------------------------------

export type MemoryFactObjectRef = {
  name: string;
  href: string | null;
};

export type MemoryFactSourceRef = {
  kind: "EMAIL_MESSAGE" | "MEETING_NOTE" | "EMAIL_THREAD" | "MEETING" | "OTHER";
  title: string | null;
  author: string | null;
  occurredAt: Date | null;
  text: string | null;
  href: string | null;
};

type MemoryFactContextInput = {
  objectType: ObjectType | string;
  objectId: string;
  sourceType: string;
  sourceId: string;
};

const MEMORY_FACT_CONTEXT_ID_LIMIT = 500;

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim()))),
  ).slice(0, MEMORY_FACT_CONTEXT_ID_LIMIT);
}

function idsFor<T extends MemoryFactContextInput>(
  facts: readonly T[],
  pick: (fact: T) => string | null,
) {
  return uniqueIds(facts.map(pick));
}

function pickMeetingNoteText(note: {
  summary: string | null;
  keyDecisions: string | null;
  liveTranscript: string | null;
}) {
  return note.summary?.trim() || note.keyDecisions?.trim() || note.liveTranscript?.trim() || null;
}

/**
 * Resolves each fact's object name and source original text. Returns maps keyed
 * by `${objectType}:${objectId}` and `${sourceType}:${sourceId}`.
 */
export async function resolveMemoryFactContext<T extends MemoryFactContextInput>(
  workspaceId: string,
  facts: readonly T[],
) {
  const objectIds = (type: string) =>
    idsFor(facts, (fact) => (fact.objectType === type ? fact.objectId : null));
  const sourceIds = (type: string) =>
    idsFor(facts, (fact) => (fact.sourceType === type ? fact.sourceId : null));

  const contactIds = objectIds("CONTACT");
  const companyIds = objectIds("COMPANY");
  const opportunityIds = objectIds("OPPORTUNITY");
  const emailThreadObjectIds = objectIds("EMAIL_THREAD");
  const emailMessageIds = sourceIds("EMAIL_MESSAGE");
  const meetingNoteSourceIds = sourceIds("MEETING_NOTE");
  const emailThreadSourceIds = sourceIds("EMAIL_THREAD");
  // MEETING_NOTE facts point at meeting.id (fact extraction, meeting memory
  // workflow) or at meetingNote.id (CRM warm-up), so both are looked up.
  const meetingIds = uniqueIds([
    ...objectIds("MEETING"),
    ...sourceIds("MEETING"),
    ...meetingNoteSourceIds,
  ]);
  const threadIds = uniqueIds([...emailThreadObjectIds, ...emailThreadSourceIds]);

  const [contacts, companies, opportunities, meetings, threads, messages, notes] =
    await Promise.all([
      contactIds.length
        ? db.contact.findMany({
            where: { workspaceId, id: { in: contactIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      companyIds.length
        ? db.company.findMany({
            where: { workspaceId, id: { in: companyIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      opportunityIds.length
        ? db.opportunity.findMany({
            where: { workspaceId, id: { in: opportunityIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      meetingIds.length
        ? db.meeting.findMany({
            where: { workspaceId, id: { in: meetingIds } },
            select: { id: true, title: true, startsAt: true },
          })
        : Promise.resolve([]),
      threadIds.length
        ? db.emailThread.findMany({
            where: { workspaceId, id: { in: threadIds } },
            select: { id: true, subject: true },
          })
        : Promise.resolve([]),
      emailMessageIds.length
        ? db.emailMessage.findMany({
            // EmailMessage has no workspaceId; scope through its thread.
            where: { id: { in: emailMessageIds }, thread: { workspaceId } },
            select: {
              id: true,
              sender: true,
              senderEmail: true,
              body: true,
              sentAt: true,
              threadId: true,
              thread: { select: { subject: true } },
            },
          })
        : Promise.resolve([]),
      meetingNoteSourceIds.length
        ? db.meetingNote.findMany({
            where: {
              workspaceId,
              OR: [
                { id: { in: meetingNoteSourceIds } },
                { meetingId: { in: meetingNoteSourceIds } },
              ],
            },
            select: {
              id: true,
              meetingId: true,
              summary: true,
              keyDecisions: true,
              liveTranscript: true,
              updatedAt: true,
              meeting: { select: { title: true, startsAt: true } },
            },
          })
        : Promise.resolve([]),
    ]);

  const objects = new Map<string, MemoryFactObjectRef>();
  for (const contact of contacts) {
    objects.set(`CONTACT:${contact.id}`, { name: contact.name, href: `/contacts/${contact.id}` });
  }
  for (const company of companies) {
    objects.set(`COMPANY:${company.id}`, { name: company.name, href: `/companies/${company.id}` });
  }
  for (const opportunity of opportunities) {
    objects.set(`OPPORTUNITY:${opportunity.id}`, {
      name: opportunity.title,
      href: `/opportunities?opportunityId=${encodeURIComponent(opportunity.id)}`,
    });
  }
  for (const meeting of meetings) {
    objects.set(`MEETING:${meeting.id}`, { name: meeting.title, href: `/meetings/${meeting.id}` });
  }
  for (const thread of threads) {
    objects.set(`EMAIL_THREAD:${thread.id}`, { name: thread.subject, href: `/inbox/${thread.id}` });
  }

  const sources = new Map<string, MemoryFactSourceRef>();
  for (const message of messages) {
    sources.set(`EMAIL_MESSAGE:${message.id}`, {
      kind: "EMAIL_MESSAGE",
      title: message.thread.subject,
      author: message.sender || message.senderEmail,
      occurredAt: message.sentAt,
      text: message.body,
      href: `/inbox/${message.threadId}`,
    });
  }
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  for (const sourceId of meetingNoteSourceIds) {
    const note = notes.find((item) => item.id === sourceId || item.meetingId === sourceId);
    const meeting = note ? null : meetingById.get(sourceId);
    if (note) {
      sources.set(`MEETING_NOTE:${sourceId}`, {
        kind: "MEETING_NOTE",
        title: note.meeting.title,
        author: null,
        occurredAt: note.meeting.startsAt,
        text: pickMeetingNoteText(note),
        href: `/meetings/${note.meetingId}`,
      });
    } else if (meeting) {
      sources.set(`MEETING_NOTE:${sourceId}`, {
        kind: "MEETING_NOTE",
        title: meeting.title,
        author: null,
        occurredAt: meeting.startsAt,
        text: null,
        href: `/meetings/${meeting.id}`,
      });
    }
  }
  for (const sourceId of sourceIds("MEETING")) {
    const meeting = meetingById.get(sourceId);
    if (meeting) {
      sources.set(`MEETING:${sourceId}`, {
        kind: "MEETING",
        title: meeting.title,
        author: null,
        occurredAt: meeting.startsAt,
        text: null,
        href: `/meetings/${meeting.id}`,
      });
    }
  }
  const threadById = new Map(threads.map((thread) => [thread.id, thread]));
  for (const sourceId of emailThreadSourceIds) {
    const thread = threadById.get(sourceId);
    if (thread) {
      sources.set(`EMAIL_THREAD:${sourceId}`, {
        kind: "EMAIL_THREAD",
        title: thread.subject,
        author: null,
        occurredAt: null,
        text: null,
        href: `/inbox/${thread.id}`,
      });
    }
  }

  return { objects, sources };
}

/**
 * Attaches `object` (its own name and page) and `source` (original text where a
 * resolver exists, otherwise type + link) to every fact.
 */
export async function attachMemoryFactContext<T extends MemoryFactContextInput>(
  workspaceId: string,
  facts: readonly T[],
): Promise<Array<T & { object: MemoryFactObjectRef | null; source: MemoryFactSourceRef | null }>> {
  if (!facts.length) return [];
  const { objects, sources } = await resolveMemoryFactContext(workspaceId, facts);
  return facts.map((fact) => ({
    ...fact,
    object: objects.get(`${fact.objectType}:${fact.objectId}`) ?? null,
    source: sources.get(`${fact.sourceType}:${fact.sourceId}`) ?? null,
  }));
}
