import type { CaioAttentionCategory, CaioAttentionSeverity } from "@/lib/caio-attention/contracts";
import type { CaioAttentionOwnerCommandPeople } from "@/lib/caio-attention/routing";
import type { CaioAttentionActor, CaioAttentionAuthorization, CaioAttentionOperation, CaioAttentionStatus } from "@/lib/caio-attention/state-machine";

/**
 * The only door between the attention pages and case data. The pages never import the database; the lifecycle
 * service and its authorized loader implement this contract. Every read is filtered by
 * `canReadCaioAttentionCase` inside the loader: an unauthorized, inactive or cross-workspace viewer gets
 * `not_found` (detail) or no row (lists), never a hint that a case exists. ADMIN supervisory reads write their
 * READ audit event in the loader, not in the page. Every command re-checks authorization, the intake gate and
 * the CAS on (id, status, commandVersion) inside its own transaction; the page-side checks are display only.
 */

export type CaioAttentionViewer = Readonly<{ workspaceId: string; actor: CaioAttentionActor }>;

/**
 * How the viewer relates to a case, as returned by the loader:
 * - "owner": the viewer holds the workspace OWNER role (mirrors `actor.role`). It is not "the person who confirmed
 *   this case": every workspace OWNER may confirm, defer, dismiss, cancel, reissue and change reviewers.
 * - "primary" / "cc" / "escalation" / "reviewer": a participant of the current confirmed command.
 * - "admin": supervisory read only; it never grants an operation.
 */
export type CaioAttentionViewerRole = "owner" | "primary" | "cc" | "escalation" | "reviewer" | "admin";

/** Proposed closed set for the disposition outcome; the service validates the same values. */
export const CAIO_ATTENTION_DISPOSITION_OUTCOMES = ["handled", "mitigated", "not_actionable"] as const;
export type CaioAttentionDispositionOutcome = (typeof CAIO_ATTENTION_DISPOSITION_OUTCOMES)[number];

export type CaioAttentionQueueItem = Readonly<{
  caseId: string;
  shortNo: number;
  status: CaioAttentionStatus;
  category: CaioAttentionCategory;
  effectiveSeverity: CaioAttentionSeverity;
  detectorId: string;
  routingBlocked: boolean;
  createdAt: Date;
  dispatchedAt: Date | null;
  committedDueAt: Date | null;
  viewerRoles: readonly CaioAttentionViewerRole[];
}>;

/**
 * `queue`: every case the viewer may read. `mine`: cases where the viewer is the primary, a cc, the escalation
 * person or in the reviewer set of the current confirmed command (prefilled people are not participants).
 * Ordering is the loader's job so pagination stays correct: non-terminal cases first, then critical before
 * warning, then newest first.
 */
export type CaioAttentionListInput = Readonly<{
  viewer: CaioAttentionViewer;
  scope: "queue" | "mine";
  page: number;
  pageSize: number;
}>;

export type CaioAttentionListResult = Readonly<{ items: readonly CaioAttentionQueueItem[]; page: number; pageSize: number; total: number }>;

/** People and due date of one command (S1 shape). The prefill is a system suggestion and authorizes nobody. */
export type CaioAttentionCommandFields = CaioAttentionOwnerCommandPeople;

export type CaioAttentionDispositionView = Readonly<{
  id: string;
  commandVersion: number;
  sequence: number;
  submittedByUserId: string;
  disposedAt: Date;
  outcome: string;
  actionTaken: string;
  note: string | null;
  evidenceRefs: readonly string[];
  superseded: boolean;
}>;

export type CaioAttentionReviewView = Readonly<{
  id: string;
  dispositionId: string;
  reviewerUserId: string;
  decision: "ACCEPT" | "RETURN";
  note: string;
  attestedExternalRefs: readonly string[];
  createdAt: Date;
}>;

/** Event payloads stay in the service; the page shows kind, actor, version and time only. */
export type CaioAttentionEventView = Readonly<{
  id: string;
  kind: string;
  commandVersion: number | null;
  actorUserId: string | null;
  createdAt: Date;
}>;

export type CaioAttentionCaseView = Readonly<{
  caseId: string;
  shortNo: number;
  status: CaioAttentionStatus;
  category: CaioAttentionCategory;
  severityAtSuggest: CaioAttentionSeverity;
  effectiveSeverity: CaioAttentionSeverity;
  detectorId: string;
  objectKey: string;
  enterpriseSlug: string | null;
  createdAt: Date;
  dispatchedAt: Date | null;
  deferredUntil: Date | null;
  closedAt: Date | null;
  commandVersion: number;
  reviewerVersion: number;
  routingBlocked: boolean;
  routingBlockedReasons: readonly string[];
  prefill: CaioAttentionCommandFields;
  /** Null until the OWNER confirms. */
  command: CaioAttentionCommandFields | null;
  /** Display labels for every user id on this case and in `assignableUserIds`. */
  people: Readonly<Record<string, string>>;
  /** Active members the OWNER may pick on the confirm, reissue and reviewer forms; empty for everyone else. */
  assignableUserIds: readonly string[];
  /** Computed by the loader with `authorizeCaioAttentionOperation`; the command re-checks in its transaction. */
  allowedOperations: readonly CaioAttentionOperation[];
  viewerRoles: readonly CaioAttentionViewerRole[];
  /** Current-version, unsuperseded, highest-sequence disposition; the only one a reviewer may judge. */
  currentDisposition: CaioAttentionDispositionView | null;
  dispositions: readonly CaioAttentionDispositionView[];
  reviews: readonly CaioAttentionReviewView[];
  events: readonly CaioAttentionEventView[];
}>;

export type CaioAttentionLoadInput = Readonly<{ viewer: CaioAttentionViewer; caseId: string; sourcePage: string }>;
export type CaioAttentionLoadResult = { ok: true; view: CaioAttentionCaseView } | { ok: false; reason: "not_found" };

type CommandBase = Readonly<{ viewer: CaioAttentionViewer; caseId: string; expectedCommandVersion: number; clientRequestId: string }>;

export type CaioAttentionCommandInput =
  // OWNER only: confirm a suggestion, or issue a new command version (commandVersion + 1) while in progress.
  | (CommandBase & { op: "confirm" | "reissue"; command: CaioAttentionCommandFields })
  // OWNER only, SUGGESTED only. The deferral ends on its own; resumeDeferred stays system-driven.
  | (CommandBase & { op: "defer"; deferredUntil: Date; reason: string | null })
  // OWNER only: dismiss on SUGGESTED; cancel on DISPATCHED / DISPOSITION_SUBMITTED. The reason goes on the event.
  | (CommandBase & { op: "dismiss" | "cancel"; reason: string })
  // OWNER only: replaces the reviewer set, bumps reviewerVersion, keeps commandVersion and the current receipt.
  | (CommandBase & { op: "assignReviewers"; reviewerVersion: number; reviewerUserIds: readonly string[] })
  | (CommandBase & { op: "ack" })
  | (CommandBase & { op: "note"; text: string })
  | (CommandBase & {
    op: "submitDisposition";
    disposedAt: Date;
    outcome: CaioAttentionDispositionOutcome;
    actionTaken: string;
    note: string | null;
    evidenceRefs: readonly string[];
  })
  | (CommandBase & {
    op: "reviewAccept" | "reviewReturn";
    dispositionId: string;
    reviewerVersion: number;
    attestedExternalRefs: readonly string[];
    note: string;
  });

export type CaioAttentionCommandFailure = Exclude<CaioAttentionAuthorization, { ok: true }>["reason"]
  | "validation_failed" | "intake_closed" | "conflict" | "service_unavailable";

export type CaioAttentionCommandResult = { ok: true; status: CaioAttentionStatus } | { ok: false; reason: CaioAttentionCommandFailure };

export interface CaioAttentionPageService {
  listCases(input: CaioAttentionListInput): Promise<CaioAttentionListResult>;
  loadCase(input: CaioAttentionLoadInput): Promise<CaioAttentionLoadResult>;
  runCommand(input: CaioAttentionCommandInput): Promise<CaioAttentionCommandResult>;
}
