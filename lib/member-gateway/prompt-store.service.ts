import "server-only";

import { Prisma } from "@prisma/client";

import { parseInstant } from "@/lib/time/strict-instant";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { canonicalJson } from "@/lib/expert-capability/hashing";
import {
  decideMemberPromptDelivery,
  judgeMemberPromptTransition,
  validateMemberPrompt,
  type MemberPrompt,
  type MemberPromptSeverity,
  type MemberPromptState,
  type MemberPromptTransitionCause,
} from "@/lib/member-gateway/prompt";
import { safeParseJson } from "@/lib/utils";

type Tx = Prisma.TransactionClient;
type PromptRow = Prisma.MemberPromptGetPayload<object>;
type ReceiptRow = Prisma.MemberPromptTransitionReceiptGetPayload<object>;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

// cause -> toState is a static lookup (spec §6.3); the row's current state
// is supplied as `from` to judgeMemberPromptTransition, which is the sole
// authority on whether the (from, cause, to) triple is a legal edge.
const CAUSE_TO_STATE: Record<MemberPromptTransitionCause, MemberPromptState> =
  {
    deliver: "delivered",
    snooze: "snoozed",
    unsnooze: "delivered",
    respond: "responded",
    withdraw: "withdrawn",
    expire: "expired",
    suppress: "suppressed",
  };

// Terminal states never appear as `from` in prompt.ts's transition table
// (see the comment above MEMBER_PROMPT_TRANSITIONS); mirrored here only to
// decide whether the expiry sweep applies, not to re-implement any
// transition judgment.
const TERMINAL_PROMPT_STATES: ReadonlySet<MemberPromptState> = new Set([
  "responded",
  "withdrawn",
  "expired",
  "suppressed",
]);

export class MemberPromptStoreError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "MemberPromptStoreError";
    this.reasons = reasons;
  }
}

function nonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) throw new MemberPromptStoreError(reason);
  return normalized;
}

function hasRef(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUniqueConstraintViolation(
  error: unknown,
  constraintName?: string,
): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    (error as { code?: string }).code !== "P2002"
  ) {
    return false;
  }
  if (!constraintName) return true;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (typeof target === "string") return target.includes(constraintName);
  if (Array.isArray(target)) return target.includes(constraintName);
  return false;
}

async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new MemberPromptStoreError("workspace_not_found");
  }
}

// Reconstructs the M3a contract prompt from its stored row. evidenceRefsJson
// is canonical JSON written by createMemberPrompt; a row whose JSON does not
// parse to an array of strings is corrupt and must never be handed to
// pure-judgment functions as if it were valid input.
function contractPromptFromRow(row: PromptRow): MemberPrompt {
  const parsed = safeParseJson<unknown>(row.evidenceRefsJson, null);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((item): item is string => typeof item === "string")
  ) {
    throw new MemberPromptStoreError("prompt_row_corrupt");
  }
  return Object.freeze({
    promptRef: row.id,
    workspaceRef: row.workspaceId,
    memberRef: row.memberRef,
    severity: row.severity as MemberPromptSeverity,
    severityRuleRef: row.severityRuleRef,
    subjectObjectRef: row.subjectObjectRef,
    projectedSummary: row.projectedSummary,
    evidenceRefs: parsed,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  });
}

// Contract-shaped transition receipt returned to callers. `deliverDecision`
// is only ever "deliver" here: a `deliver:false` decision is a hold, not a
// transition, and never reaches receipt persistence (see
// transitionMemberPrompt step 4). evaluationUseProhibited is the frozen
// non-performance literal (spec §12).
export type MemberPromptTransitionRecord = {
  receiptId: string;
  workspaceRef: string;
  promptRef: string;
  fromState: MemberPromptState;
  toState: MemberPromptState;
  cause: MemberPromptTransitionCause;
  version: number;
  deliverDecision: "deliver" | null;
  heldReason: string | null;
  responseRef: string | null;
  occurredAt: string;
  evaluationUseProhibited: true;
};

function contractReceiptFromRow(row: ReceiptRow): MemberPromptTransitionRecord {
  return Object.freeze({
    receiptId: row.id,
    workspaceRef: row.workspaceId,
    promptRef: row.promptRef,
    fromState: row.fromState as MemberPromptState,
    toState: row.toState as MemberPromptState,
    cause: row.cause as MemberPromptTransitionCause,
    version: row.version,
    deliverDecision: row.deliverDecision as "deliver" | null,
    heldReason: row.heldReason,
    responseRef: row.responseRef,
    occurredAt: row.occurredAt.toISOString(),
    evaluationUseProhibited: true as const,
  });
}

export type CreateMemberPromptInput = {
  prompt: MemberPrompt;
};

// Creates a new prompt queue row (spec §6.3). Creation is not a transition:
// the row starts at state='pending', version=1, and no receipt is written.
// validateMemberPrompt is the sole judgment authority on prompt shape; this
// function only serializes evidenceRefs and persists.
export async function createMemberPrompt(
  input: CreateMemberPromptInput,
): Promise<void> {
  const validation = validateMemberPrompt(input.prompt);
  if (!validation.valid) {
    throw new MemberPromptStoreError("prompt_invalid", validation.errors);
  }
  const workspaceId = nonEmpty(
    input.prompt.workspaceRef,
    "workspace_ref_required",
  );
  const promptRef = nonEmpty(input.prompt.promptRef, "prompt_ref_required");
  const evidenceRefsJson = canonicalJson(input.prompt.evidenceRefs);

  await runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, workspaceId);
        try {
          await tx.memberPrompt.create({
            data: {
              id: promptRef,
              workspaceId,
              memberRef: input.prompt.memberRef,
              severity: input.prompt.severity,
              severityRuleRef: input.prompt.severityRuleRef,
              subjectObjectRef: input.prompt.subjectObjectRef,
              projectedSummary: input.prompt.projectedSummary,
              evidenceRefsJson,
              state: "pending",
              version: 1,
              issuedAt: new Date(input.prompt.issuedAt),
              expiresAt: new Date(input.prompt.expiresAt),
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new MemberPromptStoreError("prompt_already_exists", [
              "prompt_already_exists",
            ]);
          }
          throw error;
        }
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export type TransitionMemberPromptInput = {
  workspaceRef: string;
  promptRef: string;
  cause: MemberPromptTransitionCause;
  expectedVersion: number;
  receiptId: string;
  // Caller's clock, strict instant (spec §6.3).
  now: string;
  // Required for deliver/unsnooze.
  deliveryContext?: { inQuietHours: boolean; doNotDisturb: boolean };
  // Required for snooze.
  snoozeUntil?: string | null;
  // Required for respond.
  responseRef?: string | null;
};

export type TransitionMemberPromptResult = {
  outcome: "transitioned" | "expired_swept";
  receipt: MemberPromptTransitionRecord;
};

// Transitions a prompt row through its CAS state machine (spec §6.3; M3a
// as-built #5-9). All judgment is delegated to prompt.ts
// (judgeMemberPromptTransition, decideMemberPromptDelivery); this function
// only loads truth, runs the expiry sweep, calls those judgments, and
// persists atomically. Steps below match the M3b plan's numbered
// transaction-body semantics.
export async function transitionMemberPrompt(
  input: TransitionMemberPromptInput,
): Promise<TransitionMemberPromptResult> {
  const workspaceId = nonEmpty(input.workspaceRef, "workspace_ref_required");
  const promptRef = nonEmpty(input.promptRef, "prompt_ref_required");
  const receiptId = nonEmpty(input.receiptId, "receipt_id_required");
  const nowMs = parseInstant(input.now);
  if (nowMs === null) {
    throw new MemberPromptStoreError("prompt_now_invalid");
  }

  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, workspaceId);

        // 1. Load the prompt row (id + workspaceId); check expectedVersion.
        const row = await tx.memberPrompt.findUnique({
          where: { id_workspaceId: { id: promptRef, workspaceId } },
        });
        if (!row) {
          throw new MemberPromptStoreError("prompt_not_found");
        }
        if (row.version !== input.expectedVersion) {
          throw new MemberPromptStoreError("prompt_version_conflict");
        }
        const fromState = row.state as MemberPromptState;
        const expiresAtMs = row.expiresAt.getTime();

        // 2. Expiry sweep before the requested cause (M3a as-built #6): a
        // non-terminal row past its window is expired first, and the
        // caller's original cause is not executed. `cause: 'expire'`
        // requested directly skips the sweep and takes the normal path
        // below (it already maps to toState 'expired').
        const sweeping =
          nowMs >= expiresAtMs &&
          !TERMINAL_PROMPT_STATES.has(fromState) &&
          input.cause !== "expire";
        // A directly requested expire may not shorten a member's live
        // response window: it is only legal once the window has closed.
        if (input.cause === "expire" && nowMs < expiresAtMs) {
          throw new MemberPromptStoreError("prompt_expire_premature");
        }
        const effectiveCause: MemberPromptTransitionCause = sweeping
          ? "expire"
          : input.cause;
        const toState = CAUSE_TO_STATE[effectiveCause];

        // 3. Transition judgment; reasons pass through unchanged.
        const transitionJudgment = judgeMemberPromptTransition({
          from: fromState,
          to: toState,
          cause: effectiveCause,
        });
        if (!transitionJudgment.valid) {
          throw new MemberPromptStoreError(
            "prompt_transition_rejected",
            transitionJudgment.errors,
          );
        }

        // 4. Delivery-context requirement + decision (deliver/unsnooze
        // only). A hold (deliver:false) is NOT a state transition: no CAS,
        // no receipt, no state change.
        let deliverDecision: "deliver" | null = null;
        const heldReasonValue: string | null = null;
        if (effectiveCause === "deliver" || effectiveCause === "unsnooze") {
          if (!input.deliveryContext) {
            throw new MemberPromptStoreError("delivery_context_missing", [
              "delivery_context_missing",
            ]);
          }
          const contractPrompt = contractPromptFromRow(row);
          const decision = decideMemberPromptDelivery(contractPrompt, {
            now: input.now,
            inQuietHours: input.deliveryContext.inQuietHours,
            doNotDisturb: input.deliveryContext.doNotDisturb,
          });
          if (!decision.deliver) {
            throw new MemberPromptStoreError(
              `prompt_delivery_held:${decision.heldReason}`,
              [`prompt_delivery_held:${decision.heldReason}`],
            );
          }
          deliverDecision = "deliver";
        }

        // 5. respond requires responseRef; snooze requires a strict-instant
        // snoozeUntil strictly between now and expiresAt.
        let snoozeUntilDate: Date | null = null;
        let responseRefValue: string | null = null;
        if (effectiveCause === "respond") {
          if (!hasRef(input.responseRef)) {
            throw new MemberPromptStoreError("response_ref_missing", [
              "response_ref_missing",
            ]);
          }
          responseRefValue = input.responseRef;
        }
        if (effectiveCause === "snooze") {
          const snoozeUntilMs = hasRef(input.snoozeUntil)
            ? parseInstant(input.snoozeUntil)
            : null;
          if (
            snoozeUntilMs === null ||
            !(nowMs < snoozeUntilMs && snoozeUntilMs < expiresAtMs)
          ) {
            throw new MemberPromptStoreError("snooze_until_invalid", [
              "snooze_until_invalid",
            ]);
          }
          snoozeUntilDate = new Date(input.snoozeUntil as string);
        }

        // 6. CAS transition: the state + version predicate makes this a
        // compare-and-swap, lexically inside this serializable tx on the
        // tx client (check:conditional-update-cas).
        const nextVersion = input.expectedVersion + 1;
        const casResult = await tx.memberPrompt.updateMany({
          where: {
            id: promptRef,
            workspaceId,
            state: fromState,
            version: input.expectedVersion,
          },
          data: {
            state: toState,
            version: nextVersion,
            snoozeUntil: snoozeUntilDate,
            responseRef: responseRefValue,
          },
        });
        if (casResult.count !== 1) {
          throw new MemberPromptStoreError("prompt_transition_conflict", [
            "prompt_transition_conflict",
          ]);
        }

        // 7. Append-only receipt insert.
        const occurredAt = new Date(input.now);
        try {
          await tx.memberPromptTransitionReceipt.create({
            data: {
              id: receiptId,
              workspaceId,
              promptRef,
              fromState,
              toState,
              cause: effectiveCause,
              version: nextVersion,
              deliverDecision,
              heldReason: heldReasonValue,
              responseRef: responseRefValue,
              occurredAt,
              evaluationUseProhibited: true,
            },
          });
        } catch (error) {
          if (
            isUniqueConstraintViolation(
              error,
              "MWPromptReceipt_prompt_version_key",
            )
          ) {
            throw new MemberPromptStoreError(
              "prompt_receipt_conflict_concurrent",
              ["prompt_receipt_conflict_concurrent"],
            );
          }
          throw error;
        }

        const receipt: MemberPromptTransitionRecord = Object.freeze({
          receiptId,
          workspaceRef: workspaceId,
          promptRef,
          fromState,
          toState,
          cause: effectiveCause,
          version: nextVersion,
          deliverDecision,
          heldReason: heldReasonValue,
          responseRef: responseRefValue,
          occurredAt: occurredAt.toISOString(),
          evaluationUseProhibited: true as const,
        });

        return {
          outcome: sweeping
            ? ("expired_swept" as const)
            : ("transitioned" as const),
          receipt,
        };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export type MemberPromptRecord = {
  prompt: MemberPrompt;
  state: MemberPromptState;
  version: number;
};

// Read-only lookup. Reconstructs the M3a contract prompt object alongside
// the store-owned state/version (see contractPromptFromRow for the
// evidenceRefsJson corruption guard).
export async function getMemberPrompt(
  workspaceId: string,
  promptRef: string,
): Promise<MemberPromptRecord | null> {
  const row = await db.memberPrompt.findUnique({
    where: { id_workspaceId: { id: promptRef, workspaceId } },
  });
  if (!row) return null;
  return Object.freeze({
    prompt: contractPromptFromRow(row),
    state: row.state as MemberPromptState,
    version: row.version,
  });
}

// Read-only lookup, version ascending — the natural order of an append-only
// transition history.
export async function listMemberPromptTransitionReceipts(
  workspaceId: string,
  promptRef: string,
): Promise<readonly MemberPromptTransitionRecord[]> {
  const rows = await db.memberPromptTransitionReceipt.findMany({
    where: { workspaceId, promptRef },
    orderBy: { version: "asc" },
  });
  return Object.freeze(rows.map((row) => contractReceiptFromRow(row)));
}
