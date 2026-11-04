import type { CaioAttentionCase, PrismaClient } from "@prisma/client";

import {
  CAIO_ATTENTION_DISPOSITION_OUTCOMES, type CaioAttentionCaseView, type CaioAttentionCommandFailure, type CaioAttentionCommandFields,
  type CaioAttentionCommandInput, type CaioAttentionPageService, type CaioAttentionViewerRole,
} from "@/features/caio-attention/service-contract";
import type { CaioAttentionCategory, CaioAttentionSeverity } from "@/lib/caio-attention/contracts";
import { listCaioAttentionCasesForViewer, loadCaioAttentionCaseForViewer } from "@/lib/caio-attention/lifecycle/case-loader";
import {
  caioAttentionActor, caioAttentionParties, parseCaioAttentionIdList, type CaioAttentionLifecycleDeps, type CaioAttentionLifecycleResult,
} from "@/lib/caio-attention/lifecycle/core";
import {
  ackCaioAttentionCase, noteCaioAttentionCase, reviewCaioAttentionDisposition, submitCaioAttentionDisposition,
} from "@/lib/caio-attention/lifecycle/disposition.service";
import {
  assignCaioAttentionReviewers, cancelCaioAttentionCase, confirmCaioAttentionCase, deferCaioAttentionCase, dismissCaioAttentionCase,
  reissueCaioAttentionCase,
} from "@/lib/caio-attention/lifecycle/lifecycle.service";
import type { CaioAttentionPolicy } from "@/lib/caio-attention/schedule";
import {
  authorizeCaioAttentionOperation, type CaioAttentionActor, type CaioAttentionOperation, type CaioAttentionStatus,
} from "@/lib/caio-attention/state-machine";

/**
 * Binds the page-service contract (features/caio-attention/service-contract.ts) to the lifecycle service and its
 * authorized loader. Reads go only through the loader; commands only through the lifecycle operations, which re-check
 * everything in their own transaction. Without a registered tenant policy every command fails closed.
 */
export type CaioAttentionPageServiceDeps = Readonly<{
  db: PrismaClient;
  getPolicy: () => CaioAttentionPolicy | null;
  resolveEnterpriseScope?: CaioAttentionLifecycleDeps["resolveEnterpriseScope"];
}>;

const PAGE_OPERATIONS: readonly CaioAttentionOperation[] = [
  "confirm", "defer", "dismiss", "cancel", "reissue", "assignReviewers", "ack", "note", "submitDisposition", "reviewAccept", "reviewReturn",
];

function viewerRoles(row: CaioAttentionCase, actor: CaioAttentionActor): CaioAttentionViewerRole[] {
  const roles: CaioAttentionViewerRole[] = [];
  if (actor.role === "OWNER") roles.push("owner");
  if (actor.role === "ADMIN") roles.push("admin");
  if (row.confirmedByUserId === null) return roles;
  const parties = caioAttentionParties(row);
  if (parties.primaryUserId === actor.userId) roles.push("primary");
  if (parties.ccUserIds.includes(actor.userId)) roles.push("cc");
  if (parties.escalationUserId === actor.userId) roles.push("escalation");
  if (parties.reviewerUserIds.includes(actor.userId)) roles.push("reviewer");
  return roles;
}

async function actorOf(db: PrismaClient, workspaceId: string, userId: string): Promise<CaioAttentionActor> {
  const member = await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { role: true, status: true, accessScope: true } });
  return caioAttentionActor(userId, member ? { role: member.role, active: member.status === "ACTIVE" && member.accessScope === null } : undefined);
}

function failure(result: Extract<CaioAttentionLifecycleResult, { ok: false }>): CaioAttentionCommandFailure {
  switch (result.reason) {
    case "input_invalid": case "command_invalid": case "evidence_invalid": case "not_due": return "validation_failed";
    case "client_request_conflict": return "conflict";
    default: return result.reason;
  }
}

const date = (value: unknown) => (typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : null);

export function createCaioAttentionLifecyclePageService(deps: CaioAttentionPageServiceDeps): CaioAttentionPageService {
  const { db } = deps;
  return {
    async listCases(input) {
      const pageSize = Math.min(Math.max(1, Math.trunc(input.pageSize)), 50);
      const page = Math.max(1, Math.trunc(input.page));
      const { rows, total } = await listCaioAttentionCasesForViewer(db, {
        workspaceId: input.viewer.workspaceId, viewerUserId: input.viewer.actor.userId, scope: input.scope, take: pageSize, skip: (page - 1) * pageSize,
      });
      const actor = await actorOf(db, input.viewer.workspaceId, input.viewer.actor.userId);
      return {
        page, pageSize, total,
        items: rows.map((row) => ({
          caseId: row.id, shortNo: row.shortNo, status: row.status as CaioAttentionStatus, category: row.category as CaioAttentionCategory,
          effectiveSeverity: row.effectiveSeverity as CaioAttentionSeverity, detectorId: row.detectorId, routingBlocked: row.routingBlocked,
          createdAt: row.createdAt, dispatchedAt: row.dispatchedAt, committedDueAt: row.committedDueAt, viewerRoles: viewerRoles(row, actor),
        })),
      };
    },

    async loadCase(input) {
      const loaded = await loadCaioAttentionCaseForViewer(db, {
        workspaceId: input.viewer.workspaceId, caseId: input.caseId, viewerUserId: input.viewer.actor.userId, entry: input.sourcePage,
      });
      if (!loaded.ok) return loaded;
      const { case: row, events, dispositions, reviews } = loaded.detail;
      const actor = await actorOf(db, row.workspaceId, input.viewer.actor.userId);
      const parties = caioAttentionParties(row);
      const superseded = new Set(events.filter((e) => e.kind === "DISPOSITION_SUPERSEDED").map((e) => (JSON.parse(e.payloadJson) as { dispositionId?: string }).dispositionId));
      const reviewed = new Set(reviews.map((r) => r.dispositionId));
      const dispositionViews = dispositions.map((d) => ({
        id: d.id, commandVersion: d.commandVersion, sequence: d.sequence, submittedByUserId: d.submittedByUserId, disposedAt: d.disposedAt,
        outcome: d.outcome, actionTaken: d.actionTaken, note: d.note, evidenceRefs: parseCaioAttentionIdList(d.evidenceRefsJson), superseded: superseded.has(d.id),
      }));
      const latest = dispositionViews.at(-1) ?? null;
      const currentDisposition = latest && row.status === "DISPOSITION_SUBMITTED" && latest.commandVersion === row.commandVersion
        && !latest.superseded && !reviewed.has(latest.id) ? latest : null;
      const suggested = events.find((e) => e.kind === "SUGGESTED");
      const prefillPayload = suggested ? (JSON.parse(suggested.payloadJson) as { prefill?: Record<string, unknown> }).prefill ?? {} : null;
      const ids = (value: unknown) => parseCaioAttentionIdList(JSON.stringify(Array.isArray(value) ? value : []));
      const prefill: CaioAttentionCommandFields = prefillPayload ? {
        primaryUserId: typeof prefillPayload.primaryUserId === "string" ? prefillPayload.primaryUserId : null, ccUserIds: ids(prefillPayload.ccUserIds),
        escalationUserId: typeof prefillPayload.escalationUserId === "string" ? prefillPayload.escalationUserId : null,
        reviewerUserIds: ids(prefillPayload.reviewerUserIds), committedDueAt: date(prefillPayload.suggestedDueAt),
      } : row.confirmedByUserId === null ? {
        primaryUserId: row.primaryUserId, ccUserIds: parties.ccUserIds, escalationUserId: row.escalationUserId,
        reviewerUserIds: parties.reviewerUserIds, committedDueAt: null,
      } : { primaryUserId: null, ccUserIds: [], escalationUserId: null, reviewerUserIds: [], committedDueAt: null };
      const command: CaioAttentionCommandFields | null = row.confirmedByUserId === null ? null : {
        primaryUserId: row.primaryUserId, ccUserIds: parties.ccUserIds, escalationUserId: row.escalationUserId,
        reviewerUserIds: parties.reviewerUserIds, committedDueAt: row.committedDueAt,
      };
      const assignable = actor.role === "OWNER" ? (await db.membership.findMany({
        where: { workspaceId: row.workspaceId, status: "ACTIVE", accessScope: null }, select: { userId: true }, orderBy: { userId: "asc" }, take: 500,
      })).map((m) => m.userId) : [];
      const named = new Set([...assignable, ...[prefill, command].flatMap((c) => (c ? [c.primaryUserId, c.escalationUserId, ...c.ccUserIds, ...c.reviewerUserIds] : [])),
        ...dispositions.map((d) => d.submittedByUserId), ...reviews.map((r) => r.reviewerUserId), ...events.map((e) => e.actorUserId)]);
      named.delete(null);
      const users = await db.user.findMany({ where: { id: { in: [...named] as string[] } }, select: { id: true, name: true } });
      const allowedOperations = PAGE_OPERATIONS.filter((op) => authorizeCaioAttentionOperation({
        op: op as Exclude<CaioAttentionOperation, "resumeDeferred">, actor, parties, expectedCommandVersion: row.commandVersion, reviewerVersion: row.reviewerVersion,
        disposition: currentDisposition ? { commandVersion: currentDisposition.commandVersion, superseded: false, isLatestInVersion: true, submittedByUserId: currentDisposition.submittedByUserId } : undefined,
      }).ok);
      const view: CaioAttentionCaseView = {
        caseId: row.id, shortNo: row.shortNo, status: row.status as CaioAttentionStatus, category: row.category as CaioAttentionCategory,
        severityAtSuggest: row.severityAtSuggest as CaioAttentionSeverity, effectiveSeverity: row.effectiveSeverity as CaioAttentionSeverity,
        detectorId: row.detectorId, objectKey: row.objectKey, enterpriseSlug: row.enterpriseSlug, createdAt: row.createdAt, dispatchedAt: row.dispatchedAt,
        deferredUntil: row.deferredUntil, closedAt: row.closedAt, commandVersion: row.commandVersion, reviewerVersion: row.reviewerVersion,
        routingBlocked: row.routingBlocked, routingBlockedReasons: parseCaioAttentionIdList(row.routingBlockedReasonsJson ?? "[]"), prefill, command,
        people: Object.fromEntries(users.map((u) => [u.id, u.name ?? u.id])), assignableUserIds: assignable, allowedOperations,
        viewerRoles: viewerRoles(row, actor), currentDisposition, dispositions: dispositionViews,
        reviews: reviews.map((r) => ({
          id: r.id, dispositionId: r.dispositionId, reviewerUserId: r.reviewerUserId, decision: r.decision as "ACCEPT" | "RETURN", note: r.note,
          attestedExternalRefs: parseCaioAttentionIdList(r.attestedExternalRefsJson), createdAt: r.createdAt,
        })),
        events: events.map(({ id, kind, commandVersion, actorUserId, createdAt }) => ({ id, kind, commandVersion, actorUserId, createdAt })),
      };
      return { ok: true, view };
    },

    async runCommand(input: CaioAttentionCommandInput) {
      const policy = deps.getPolicy();
      if (!policy) return { ok: false, reason: "service_unavailable" };
      const lifecycle: CaioAttentionLifecycleDeps = { db, policy, resolveEnterpriseScope: deps.resolveEnterpriseScope };
      const base = {
        workspaceId: input.viewer.workspaceId, caseId: input.caseId, actorUserId: input.viewer.actor.userId,
        clientRequestId: input.clientRequestId, expectedCommandVersion: input.expectedCommandVersion,
      };
      let result: CaioAttentionLifecycleResult;
      switch (input.op) {
        case "confirm": result = await confirmCaioAttentionCase(lifecycle, { ...base, command: input.command }); break;
        case "reissue": result = await reissueCaioAttentionCase(lifecycle, { ...base, command: input.command }); break;
        case "defer": result = await deferCaioAttentionCase(lifecycle, { ...base, deferredUntil: input.deferredUntil, note: input.reason ?? undefined }); break;
        case "dismiss": result = await dismissCaioAttentionCase(lifecycle, { ...base, note: input.reason }); break;
        case "cancel": result = await cancelCaioAttentionCase(lifecycle, { ...base, note: input.reason }); break;
        case "assignReviewers":
          result = await assignCaioAttentionReviewers(lifecycle, { ...base, reviewerUserIds: input.reviewerUserIds, expectedReviewerVersion: input.reviewerVersion });
          break;
        case "ack": result = await ackCaioAttentionCase(lifecycle, base); break;
        case "note": result = await noteCaioAttentionCase(lifecycle, { ...base, note: input.text }); break;
        case "submitDisposition":
          if (!(CAIO_ATTENTION_DISPOSITION_OUTCOMES as readonly string[]).includes(input.outcome)) return { ok: false, reason: "validation_failed" };
          result = await submitCaioAttentionDisposition(lifecycle, { ...base, disposition: {
            disposedAt: input.disposedAt, outcome: input.outcome, actionTaken: input.actionTaken, note: input.note ?? undefined, evidenceRefs: input.evidenceRefs,
          } });
          break;
        default:
          result = await reviewCaioAttentionDisposition(lifecycle, {
            ...base, decision: input.op === "reviewAccept" ? "ACCEPT" : "RETURN", dispositionId: input.dispositionId,
            reviewerVersion: input.reviewerVersion, attestedExternalRefs: input.attestedExternalRefs, note: input.note,
          });
      }
      return result.ok ? { ok: true, status: result.status } : { ok: false, reason: failure(result) };
    },
  };
}
