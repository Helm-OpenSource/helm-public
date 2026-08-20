// lib/member-gateway/prompt-response-store.service.ts
// Member Gateway M3c: prompt response persistence (spec §5/§6.3/§7).
//
// candidate_write responses (progress_report/free_text_answer) are
// deliberately NOT handled by recordMemberPromptResponse: they reuse the M2
// work-signal machine wholesale (M3c Architecture #1) via the
// respondWithWorkSignal composition function below. Everything else
// (acknowledge/refuse/pause/appeal/commitment_confirm) lands in the new
// MemberPromptResponseReceipt table via recordMemberPromptResponse.
//
// CAS-gate-forced mechanical inlining (M3c Architecture #4, binding): the
// expiry sweep and the "respond" transition inside recordMemberPromptResponse
// copy the CAS-transition mechanics (state+version predicate updateMany,
// transition receipt insert) from prompt-store.service.ts's
// transitionMemberPrompt BY HAND rather than calling it or extracting a
// shared helper. scripts/check-conditional-update-cas.ts only certifies a
// conditional updateMany as sound when its client is bound LEXICALLY inside
// the enclosing $transaction callback with a provable Serializable isolation
// level ("client-from-parameter" is a hard finding otherwise); calling
// transitionMemberPrompt would open its OWN transaction nested inside this
// one, and extracting a `(tx, ...) => ...` helper hands `tx` in as a
// parameter, which is exactly the pattern the guard cannot certify. The
// judgment stays centralized in prompt.ts (judgeMemberPromptTransition) —
// only the persistence mechanics are duplicated, and only because the CAS
// gate leaves no other lexically-provable shape.
import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { validateHumanResponse } from "@/lib/caio-governance/contract";
import type { CaioHumanResponse } from "@/lib/caio-governance/types";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import { validateMemberPrincipal } from "@/lib/member-gateway/contract";
import { parseInstant } from "@/lib/time/strict-instant";
import {
  bridgeProtectedHumanResponse,
  classifyMemberPromptResponse,
  judgeAuthorityBearingAction,
  judgeMemberPromptTransition,
  judgeProtectedResponseRoute,
  type MemberPromptResponseKind,
  type MemberPromptState,
  type MemberResponseClass,
} from "@/lib/member-gateway/prompt";
import {
  transitionMemberPrompt,
  type TransitionMemberPromptResult,
} from "@/lib/member-gateway/prompt-store.service";
import {
  MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS,
  judgeMemberWorkSignalChallenge,
  type MemberWorkSignalChallenge,
  type MemberWorkSignalPayload,
  type MemberWorkSignalReceipt,
} from "@/lib/member-gateway/signal";
import {
  submitMemberWorkSignal,
  type SubmitMemberWorkSignalResult,
} from "@/lib/member-gateway/signal-store.service";
import type {
  MemberPrincipal,
  MemberReadSurfaceDecision,
} from "@/lib/member-gateway/types";
import { safeParseJson } from "@/lib/utils";

type Tx = Prisma.TransactionClient;
type ResponseReceiptRow = Prisma.MemberPromptResponseReceiptGetPayload<object>;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

// Mirrored from prompt-store.service.ts (not imported: it is a private
// module-local constant there). Duplicated for the same CAS-gate reason as
// the transition mechanics themselves — see the file header.
const TERMINAL_PROMPT_STATES: ReadonlySet<MemberPromptState> = new Set([
  "responded",
  "withdrawn",
  "expired",
  "suppressed",
]);

// The action leg of the authority triple is derived from the response
// kind — the caller can never supply both sides of the comparison
// judgeAuthorityBearingAction performs (review fix, M3c as-built #7): an
// authorityInput.actionRef field would let a caller assert a match against
// its own authorizedActionRef, which defeats the binding entirely. Frozen
// here, not caller-suppliable.
const AUTHORITY_ACTION_REF_BY_KIND = {
  commitment_confirm: "member_prompt_response:commitment_confirm",
} as const;

function authorityActionRefForKind(kind: MemberPromptResponseKind): string {
  const derived = (
    AUTHORITY_ACTION_REF_BY_KIND as Partial<Record<MemberPromptResponseKind, string>>
  )[kind];
  if (!derived) {
    // Unreachable while classifyMemberPromptResponse's authority_bearing_
    // action mapping stays single-kind (commitment_confirm only); guards
    // fail loud instead of silently comparing against undefined if a
    // future kind is added to that class without updating this map.
    throw new MemberPromptResponseStoreError(
      "authority_action_ref_undefined_for_kind",
      ["authority_action_ref_undefined_for_kind"],
    );
  }
  return derived;
}

export class MemberPromptResponseStoreError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "MemberPromptResponseStoreError";
    this.reasons = reasons;
  }
}

function hasRef(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) throw new MemberPromptResponseStoreError(reason);
  return normalized;
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
    throw new MemberPromptResponseStoreError("workspace_not_found");
  }
}

// Contract-shaped response receipt. governedResponse is reconstructed (and
// re-verified against governedResponseHash, then re-validated with
// validateHumanResponse) on every read, protected row or not — a receipt is
// never trusted on the strength of its stored columns alone (mirrors
// contractReceiptFromRow in signal-store.service.ts).
export type MemberPromptResponseRecord = {
  receiptId: string;
  workspaceRef: string;
  promptRef: string;
  memberRef: string;
  deviceRegistrationRef: string;
  clientId: string;
  responseKind: MemberPromptResponseKind;
  responseClass: MemberResponseClass;
  challengeRef: string;
  occurredAt: string;
  evaluationUseProhibited: true;
  governedResponse: CaioHumanResponse | null;
  governedResponseHash: string | null;
  governanceResponseId: string | null;
  mandateRef: string | null;
  routePath: "user_presence" | "local_fallback" | null;
  externalAuthorizationRef: string | null;
  authorizedMemberRef: string | null;
  authorizedObjectRef: string | null;
  authorizedActionRef: string | null;
};

function contractResponseFromRow(
  row: ResponseReceiptRow,
): MemberPromptResponseRecord {
  let governedResponse: CaioHumanResponse | null = null;
  if (row.governedResponseJson !== null) {
    if (
      row.governedResponseHash === null ||
      sha256(row.governedResponseJson) !== row.governedResponseHash
    ) {
      throw new MemberPromptResponseStoreError("response_receipt_corrupt");
    }
    const parsed = safeParseJson<CaioHumanResponse | null>(
      row.governedResponseJson,
      null,
    );
    if (!parsed || !validateHumanResponse(parsed).valid) {
      throw new MemberPromptResponseStoreError("response_receipt_corrupt");
    }
    governedResponse = parsed;
  }
  return Object.freeze({
    receiptId: row.id,
    workspaceRef: row.workspaceId,
    promptRef: row.promptRef,
    memberRef: row.memberRef,
    deviceRegistrationRef: row.deviceRegistrationRef,
    clientId: row.clientId,
    responseKind: row.responseKind as MemberPromptResponseKind,
    responseClass: row.responseClass as MemberResponseClass,
    challengeRef: row.challengeRef,
    occurredAt: row.occurredAt.toISOString(),
    evaluationUseProhibited: true as const,
    governedResponse,
    governedResponseHash: row.governedResponseHash,
    governanceResponseId: row.governanceResponseId,
    mandateRef: row.mandateRef,
    routePath: row.routePath as "user_presence" | "local_fallback" | null,
    externalAuthorizationRef: row.externalAuthorizationRef,
    authorizedMemberRef: row.authorizedMemberRef,
    authorizedObjectRef: row.authorizedObjectRef,
    authorizedActionRef: row.authorizedActionRef,
  });
}

export type IssueMemberPromptResponseChallengeInput = {
  principal: MemberPrincipal;
  promptRef: string;
  promptVersion: number;
  // Hashed with canonicalJson+sha256 into payloadHash; the same payload
  // must be resent verbatim to recordMemberPromptResponse for the hash to
  // match (mirrors the M2 work-signal challenge/submit binding).
  responsePayload: unknown;
  ttlMs: number;
};

// Issues a one-time prompt-response challenge (spec §6.3, mirroring §6.2).
// Persisted into the EXISTING MemberWorkSignalChallenge table: the table's
// "signal" name prefix is historical (it predates this slice); its shape —
// objectRef/objectVersion/payloadHash/one-time window — is the GENERIC
// one-time member-write challenge store, and M3c Architecture #3 reuses it
// deliberately rather than adding a parallel table. objectRef is bound to
// promptRef and objectVersion to promptVersion.
export async function issueMemberPromptResponseChallenge(
  input: IssueMemberPromptResponseChallengeInput,
): Promise<MemberWorkSignalChallenge> {
  const principalValidation = validateMemberPrincipal(input.principal);
  if (!principalValidation.valid) {
    throw new MemberPromptResponseStoreError(
      "principal_invalid",
      principalValidation.errors,
    );
  }
  if (
    !Number.isFinite(input.ttlMs) ||
    input.ttlMs <= 0 ||
    input.ttlMs > MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS
  ) {
    throw new MemberPromptResponseStoreError("challenge_ttl_invalid", [
      "challenge_ttl_invalid",
    ]);
  }
  const workspaceId = nonEmpty(
    input.principal.workspaceRef,
    "workspace_ref_required",
  );
  const promptRef = nonEmpty(input.promptRef, "prompt_ref_required");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + input.ttlMs);
  const payloadHash = sha256(canonicalJson(input.responsePayload));
  const candidate: MemberWorkSignalChallenge = {
    challengeRef: randomUUID(),
    workspaceRef: workspaceId,
    memberRef: input.principal.memberRef,
    objectRef: promptRef,
    objectVersion: input.promptVersion,
    payloadHash,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  // Backstop judgment (window/TTL-cap/shape), same as
  // issueMemberWorkSignalChallenge.
  const challengeJudgment = judgeMemberWorkSignalChallenge(candidate);
  if (!challengeJudgment.valid) {
    throw new MemberPromptResponseStoreError(
      "challenge_invalid",
      challengeJudgment.errors,
    );
  }

  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, workspaceId);

        // Addressee binding (review fix, M3c as-built #7): a prompt-
        // response challenge may only ever be issued to the member the
        // prompt is actually addressed to — never to whoever happens to
        // ask. Loading the prompt row here also gives issue-time
        // existence validation for free.
        const promptRow = await tx.memberPrompt.findUnique({
          where: { id_workspaceId: { id: promptRef, workspaceId } },
        });
        if (!promptRow) {
          throw new MemberPromptResponseStoreError("prompt_not_found");
        }
        if (promptRow.memberRef !== input.principal.memberRef) {
          throw new MemberPromptResponseStoreError(
            "prompt_member_binding_mismatch",
            ["prompt_member_binding_mismatch"],
          );
        }

        await tx.memberWorkSignalChallenge.create({
          data: {
            id: candidate.challengeRef,
            workspaceId,
            memberRef: candidate.memberRef,
            deviceRegistrationRef: input.principal.deviceRegistrationRef,
            clientId: input.principal.clientId,
            objectRef: candidate.objectRef,
            objectVersion: candidate.objectVersion,
            payloadHash,
            issuedAt,
            expiresAt,
          },
        });
        return Object.freeze({ ...candidate });
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export type RecordMemberPromptResponseInput = {
  principal: MemberPrincipal;
  promptRef: string;
  expectedVersion: number;
  challengeRef: string;
  // Must hash (canonicalJson+sha256) to the challenge's payloadHash.
  responsePayload: unknown;
  // Deliberately the FULL response-kind union, not just the five kinds this
  // table persists: a candidate_write kind reaching this function is a
  // caller error this store must reject with a clear redirect
  // (candidate_response_uses_signal_path), not a type error that hides the
  // failure mode from a caller that mis-routed at runtime (e.g. from an
  // untyped request body).
  kind: MemberPromptResponseKind;
  receiptId: string;
  // Consumed only when this call actually writes a transition receipt: the
  // expiry sweep (any kind) or the "respond" transition (non-acknowledge).
  transitionReceiptId: string;
  now: string;
  protectedInput?: {
    userPresenceAvailable: boolean;
    localFallbackAvailable: boolean;
    routePath: "user_presence" | "local_fallback";
    mandateRef: string;
    reason: string;
    auditRefs: readonly string[];
    governanceResponseId: string;
  };
  authorityInput?: {
    externalAuthorizationRef: string;
    userPresenceVerified: boolean;
    authorizedMemberRef: string;
    authorizedObjectRef: string;
    authorizedActionRef: string;
  };
};

export type RecordMemberPromptResponseResult = {
  outcome: "recorded";
  receipt: MemberPromptResponseRecord;
  promptTransitioned: boolean;
};

type TxOutcome =
  | { outcome: "expired_swept" }
  | {
      outcome: "recorded";
      receipt: MemberPromptResponseRecord;
      promptTransitioned: boolean;
    };

// Records a prompt response for the four non-candidate write kinds (spec
// §5/§6.3/§7). ONE lexical serializable $transaction, per M3c Architecture
// #4 (see file header): prompt CAS load -> expiry sweep -> challenge
// judgment -> class-specific judgment -> challenge CAS consumption ->
// non-acknowledge "respond" transition -> response receipt insert. All
// judgment is delegated to prompt.ts; only the transition persistence
// mechanics are hand-copied from prompt-store.service.ts.
export async function recordMemberPromptResponse(
  input: RecordMemberPromptResponseInput,
): Promise<RecordMemberPromptResponseResult> {
  const principalValidation = validateMemberPrincipal(input.principal);
  if (!principalValidation.valid) {
    throw new MemberPromptResponseStoreError(
      "principal_invalid",
      principalValidation.errors,
    );
  }
  const workspaceId = nonEmpty(
    input.principal.workspaceRef,
    "workspace_ref_required",
  );
  const promptRef = nonEmpty(input.promptRef, "prompt_ref_required");
  const challengeRef = nonEmpty(input.challengeRef, "challenge_ref_required");
  const receiptId = nonEmpty(input.receiptId, "receipt_id_required");
  const nowMs = parseInstant(input.now);
  if (nowMs === null) {
    throw new MemberPromptResponseStoreError("response_now_invalid");
  }
  const responseClass = classifyMemberPromptResponse(input.kind);
  if (responseClass === "candidate_write") {
    throw new MemberPromptResponseStoreError(
      "candidate_response_uses_signal_path",
      ["candidate_response_uses_signal_path"],
    );
  }

  function requireTransitionReceiptId(): string {
    if (!hasRef(input.transitionReceiptId)) {
      throw new MemberPromptResponseStoreError("transition_receipt_id_required", [
        "transition_receipt_id_required",
      ]);
    }
    return input.transitionReceiptId;
  }

  const txResult = await runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx): Promise<TxOutcome> => {
        await lockWorkspace(tx, workspaceId);

        // 1. Load the prompt row; version CAS check (same error codes as
        // prompt-store.service.ts's transitionMemberPrompt).
        const row = await tx.memberPrompt.findUnique({
          where: { id_workspaceId: { id: promptRef, workspaceId } },
        });
        if (!row) {
          throw new MemberPromptResponseStoreError("prompt_not_found");
        }
        // Addressee binding (review fix, M3c as-built #7): only the member
        // a prompt is addressed to may ever respond to it, mirroring the
        // same check at challenge-issue time.
        if (row.memberRef !== input.principal.memberRef) {
          throw new MemberPromptResponseStoreError(
            "prompt_member_binding_mismatch",
            ["prompt_member_binding_mismatch"],
          );
        }
        if (row.version !== input.expectedVersion) {
          throw new MemberPromptResponseStoreError("prompt_version_conflict");
        }
        const fromState = row.state as MemberPromptState;
        const expiresAtMs = row.expiresAt.getTime();

        // 2. Expiry sweep (mirrors transitionMemberPrompt step 2), except
        // there is no "requested cause" to fall back to here: recording a
        // response against a window that has already closed is never
        // legal, so a sweeping row expires and the CALL is rejected
        // outright — but the expire transition it produces is a real,
        // committed fact (the transaction still returns normally so that
        // write survives); only the response is not recorded.
        const sweeping =
          nowMs >= expiresAtMs && !TERMINAL_PROMPT_STATES.has(fromState);
        if (sweeping) {
          const transitionReceiptId = requireTransitionReceiptId();
          const transitionJudgment = judgeMemberPromptTransition({
            from: fromState,
            to: "expired",
            cause: "expire",
          });
          if (!transitionJudgment.valid) {
            throw new MemberPromptResponseStoreError(
              "prompt_transition_rejected",
              transitionJudgment.errors,
            );
          }
          const nextVersion = row.version + 1;
          const casResult = await tx.memberPrompt.updateMany({
            where: {
              id: promptRef,
              workspaceId,
              state: fromState,
              version: row.version,
            },
            data: {
              state: "expired",
              version: nextVersion,
              snoozeUntil: null,
              responseRef: null,
            },
          });
          if (casResult.count !== 1) {
            throw new MemberPromptResponseStoreError(
              "prompt_transition_conflict",
              ["prompt_transition_conflict"],
            );
          }
          const occurredAt = new Date(input.now);
          try {
            await tx.memberPromptTransitionReceipt.create({
              data: {
                id: transitionReceiptId,
                workspaceId,
                promptRef,
                fromState,
                toState: "expired",
                cause: "expire",
                version: nextVersion,
                deliverDecision: null,
                heldReason: null,
                responseRef: null,
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
              throw new MemberPromptResponseStoreError(
                "prompt_receipt_conflict_concurrent",
                ["prompt_receipt_conflict_concurrent"],
              );
            }
            throw error;
          }
          return { outcome: "expired_swept" };
        }

        // 2b. acknowledge is an interaction receipt against a live,
        // delivered prompt only (review fix, minor hardening) — it is not
        // a way to leave a receipt against a prompt still pending
        // delivery or already terminal by some path other than the sweep
        // above.
        if (input.kind === "acknowledge" && fromState !== "delivered") {
          throw new MemberPromptResponseStoreError(
            "acknowledge_state_invalid",
            ["acknowledge_state_invalid"],
          );
        }

        // 3. Load the challenge row and judge binding/window/replay.
        // judgeMemberWorkSignalChallenge (signal.ts) is reused verbatim for
        // the challenge's own shape/window/TTL-cap backstop. The
        // submission-side rules below (binding, payload hash, submission
        // window, replay) mirror signal.ts's judgeMemberWorkSignalSubmission
        // rule-for-rule and reuse its exact error vocabulary, but are NOT a
        // call to that function: it also validates the payload against
        // MemberWorkSignalPayload's kind/summary/detail/relatedEvidenceRefs
        // shape via validateMemberWorkSignalDraft, which does not apply to
        // a prompt response payload (an arbitrary, kind-dependent JSON
        // value — refuse reasons, commitment details, etc. have no signal
        // shape). There is no payload-shape-agnostic export to call
        // instead, and this file may not modify signal.ts (Task 3 scope).
        const challengeRow = await tx.memberWorkSignalChallenge.findUnique({
          where: { id_workspaceId: { id: challengeRef, workspaceId } },
        });
        if (!challengeRow) {
          throw new MemberPromptResponseStoreError("challenge_not_found");
        }
        const challengeCandidate: MemberWorkSignalChallenge = {
          challengeRef: challengeRow.id,
          workspaceRef: challengeRow.workspaceId,
          memberRef: challengeRow.memberRef,
          objectRef: challengeRow.objectRef,
          objectVersion: challengeRow.objectVersion,
          payloadHash: challengeRow.payloadHash,
          issuedAt: challengeRow.issuedAt.toISOString(),
          expiresAt: challengeRow.expiresAt.toISOString(),
        };
        const submittedAt = new Date(input.now);
        const payloadHash = sha256(canonicalJson(input.responsePayload));
        const challengeReasons = [
          ...judgeMemberWorkSignalChallenge(challengeCandidate).errors,
        ];
        if (
          challengeRow.memberRef !== input.principal.memberRef ||
          challengeRow.objectRef !== promptRef
        ) {
          challengeReasons.push("challenge_binding_mismatch");
        }
        // Issue-time version pin (review fix, minor hardening): the
        // challenge's objectVersion was captured at issueMemberPrompt
        // ResponseChallenge time. Since step 1 already proved
        // input.expectedVersion === row.version, this is really asserting
        // "the challenge was issued against the prompt's CURRENT version,
        // not a version the prompt has since moved past" — a challenge
        // minted before an intervening transition (e.g. deliver bumping
        // the version) must not be redeemable after that transition; the
        // caller must re-issue against the new version.
        if (challengeRow.objectVersion !== input.expectedVersion) {
          challengeReasons.push("challenge_prompt_version_mismatch");
        }
        if (payloadHash !== challengeRow.payloadHash) {
          challengeReasons.push("challenge_payload_hash_mismatch");
        }
        if (nowMs < challengeRow.issuedAt.getTime()) {
          challengeReasons.push("submission_before_issue");
        } else if (nowMs >= challengeRow.expiresAt.getTime()) {
          challengeReasons.push("challenge_expired");
        }
        if (challengeRow.consumedAt !== null) {
          challengeReasons.push("challenge_already_consumed");
        }
        if (challengeReasons.length > 0) {
          throw new MemberPromptResponseStoreError(
            "challenge_submission_rejected",
            challengeReasons,
          );
        }

        // 4. Class-specific judgment. classifyMemberPromptResponse already
        // ruled out candidate_write above.
        let governedResponseJson: string | null = null;
        let governedResponseHash: string | null = null;
        let governanceResponseId: string | null = null;
        let mandateRef: string | null = null;
        let routePath: "user_presence" | "local_fallback" | null = null;
        let externalAuthorizationRef: string | null = null;
        let authorizedMemberRef: string | null = null;
        let authorizedObjectRef: string | null = null;
        let authorizedActionRef: string | null = null;

        if (responseClass === "protected_human_response") {
          if (!input.protectedInput) {
            throw new MemberPromptResponseStoreError(
              "protected_input_required",
              ["protected_input_required"],
            );
          }
          const protectedInput = input.protectedInput;
          const routeJudgment = judgeProtectedResponseRoute({
            userPresenceAvailable: protectedInput.userPresenceAvailable,
            localFallbackAvailable: protectedInput.localFallbackAvailable,
          });
          if (!routeJudgment.valid) {
            throw new MemberPromptResponseStoreError(
              "protected_response_route_rejected",
              routeJudgment.errors,
            );
          }
          const routeAvailable =
            (protectedInput.routePath === "user_presence" &&
              protectedInput.userPresenceAvailable) ||
            (protectedInput.routePath === "local_fallback" &&
              protectedInput.localFallbackAvailable);
          if (!routeAvailable) {
            throw new MemberPromptResponseStoreError(
              "protected_route_path_invalid",
              ["protected_route_path_invalid"],
            );
          }
          // classifyMemberPromptResponse already narrowed input.kind to
          // refuse/pause/appeal for this class.
          const { response, validation } = bridgeProtectedHumanResponse({
            responseId: receiptId,
            mandateRef: protectedInput.mandateRef,
            responderRef: input.principal.memberRef,
            responseType: input.kind as "refuse" | "pause" | "appeal",
            subjectPromptRef: promptRef,
            reason: protectedInput.reason,
            auditRefs: protectedInput.auditRefs,
          });
          if (!validation.valid) {
            // This rejects THIS recording call's completeness only — never
            // the response right itself (spec §7). Fix the inputs
            // (mandateRef, reason, auditRefs, ...) and resubmit;
            // refuse/pause/appeal remain always legitimate to raise.
            throw new MemberPromptResponseStoreError(
              "protected_response_invalid",
              validation.errors,
            );
          }
          governedResponseJson = canonicalJson(response);
          governedResponseHash = sha256(governedResponseJson);
          governanceResponseId = protectedInput.governanceResponseId;
          mandateRef = protectedInput.mandateRef;
          routePath = protectedInput.routePath;
        } else if (responseClass === "authority_bearing_action") {
          if (!input.authorityInput) {
            throw new MemberPromptResponseStoreError(
              "authority_input_required",
              ["authority_input_required"],
            );
          }
          const authorityInput = input.authorityInput;
          const authorityJudgment = judgeAuthorityBearingAction({
            externalAuthorizationRef: authorityInput.externalAuthorizationRef,
            challengeRef,
            userPresenceVerified: authorityInput.userPresenceVerified,
            authorizedMemberRef: authorityInput.authorizedMemberRef,
            authorizedObjectRef: authorityInput.authorizedObjectRef,
            authorizedActionRef: authorityInput.authorizedActionRef,
            submittingMemberRef: input.principal.memberRef,
            subjectObjectRef: row.subjectObjectRef,
            actionRef: authorityActionRefForKind(input.kind),
          });
          if (!authorityJudgment.valid) {
            throw new MemberPromptResponseStoreError(
              "authority_bearing_action_rejected",
              authorityJudgment.errors,
            );
          }
          externalAuthorizationRef = authorityInput.externalAuthorizationRef;
          authorizedMemberRef = authorityInput.authorizedMemberRef;
          authorizedObjectRef = authorityInput.authorizedObjectRef;
          authorizedActionRef = authorityInput.authorizedActionRef;
        }
        // interaction_receipt (acknowledge) needs no class-specific
        // judgment beyond the challenge check above.

        // 5. Challenge CAS consumption — the only permitted mutation on
        // MemberWorkSignalChallenge (mirrors submitMemberWorkSignal step 6).
        // Applies to every kind reaching this point, acknowledge included:
        // every non-candidate response is challenge-gated.
        const consumeResult = await tx.memberWorkSignalChallenge.updateMany({
          where: { id: challengeRef, workspaceId, consumedAt: null },
          data: { consumedAt: submittedAt, consumptionReceiptRef: receiptId },
        });
        if (consumeResult.count !== 1) {
          throw new MemberPromptResponseStoreError(
            "challenge_consumption_conflict",
          );
        }

        // 6. Non-acknowledge kinds trigger the inline "respond" transition
        // (M3c Architecture #4 — hand-copied CAS + receipt mechanics, see
        // file header). acknowledge deliberately does not transition the
        // prompt at all.
        let promptTransitioned = false;
        if (input.kind !== "acknowledge") {
          const transitionReceiptId = requireTransitionReceiptId();
          const transitionJudgment = judgeMemberPromptTransition({
            from: fromState,
            to: "responded",
            cause: "respond",
          });
          if (!transitionJudgment.valid) {
            throw new MemberPromptResponseStoreError(
              "prompt_transition_rejected",
              transitionJudgment.errors,
            );
          }
          const nextVersion = row.version + 1;
          const casResult = await tx.memberPrompt.updateMany({
            where: {
              id: promptRef,
              workspaceId,
              state: fromState,
              version: row.version,
            },
            data: {
              state: "responded",
              version: nextVersion,
              snoozeUntil: null,
              responseRef: receiptId,
            },
          });
          if (casResult.count !== 1) {
            throw new MemberPromptResponseStoreError(
              "prompt_transition_conflict",
              ["prompt_transition_conflict"],
            );
          }
          const occurredAt = new Date(input.now);
          try {
            await tx.memberPromptTransitionReceipt.create({
              data: {
                id: transitionReceiptId,
                workspaceId,
                promptRef,
                fromState,
                toState: "responded",
                cause: "respond",
                version: nextVersion,
                deliverDecision: null,
                heldReason: null,
                responseRef: receiptId,
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
              throw new MemberPromptResponseStoreError(
                "prompt_receipt_conflict_concurrent",
                ["prompt_receipt_conflict_concurrent"],
              );
            }
            throw error;
          }
          promptTransitioned = true;
        }

        // 7. Append-only response receipt insert.
        try {
          const created = await tx.memberPromptResponseReceipt.create({
            data: {
              id: receiptId,
              workspaceId,
              promptRef,
              memberRef: input.principal.memberRef,
              deviceRegistrationRef: input.principal.deviceRegistrationRef,
              clientId: input.principal.clientId,
              responseKind: input.kind,
              responseClass,
              challengeRef,
              occurredAt: submittedAt,
              evaluationUseProhibited: true,
              governedResponseJson,
              governedResponseHash,
              governanceResponseId,
              mandateRef,
              routePath,
              externalAuthorizationRef,
              authorizedMemberRef,
              authorizedObjectRef,
              authorizedActionRef,
            },
          });
          return {
            outcome: "recorded",
            receipt: contractResponseFromRow(created),
            promptTransitioned,
          };
        } catch (error) {
          if (
            isUniqueConstraintViolation(
              error,
              "MWPromptRespReceipt_workspace_challenge_key",
            )
          ) {
            throw new MemberPromptResponseStoreError(
              "response_receipt_already_recorded",
            );
          }
          if (isUniqueConstraintViolation(error)) {
            throw new MemberPromptResponseStoreError(
              "response_receipt_unique_conflict",
            );
          }
          throw error;
        }
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );

  if (txResult.outcome === "expired_swept") {
    // The sweep's expire transition committed (a real, durable fact); only
    // the response recording this call asked for did not happen.
    throw new MemberPromptResponseStoreError("prompt_expired_swept", [
      "prompt_expired_swept",
    ]);
  }
  return txResult;
}

// Read-only lookup. Re-verifies governedResponseJson/Hash and re-runs
// validateHumanResponse on every read (see contractResponseFromRow) rather
// than trusting the stored columns.
export async function getMemberPromptResponseReceipt(
  workspaceId: string,
  receiptId: string,
): Promise<MemberPromptResponseRecord | null> {
  const row = await db.memberPromptResponseReceipt.findUnique({
    where: { id_workspaceId: { id: receiptId, workspaceId } },
  });
  return row ? contractResponseFromRow(row) : null;
}

export type RespondWithWorkSignalInput = {
  principal: MemberPrincipal;
  challengeRef: string;
  payload: MemberWorkSignalPayload;
  surface: MemberReadSurfaceDecision;
  evidenceSurfaces: ReadonlyMap<string, MemberReadSurfaceDecision>;
  policyRef: string;
  policyVersion: number;
  receiptId: string;
  supersedesReceiptRef?: string | null;
  promptRef: string;
  expectedVersion: number;
  transitionReceiptId: string;
  now: string;
};

export type RespondWithWorkSignalResult = {
  signalOutcome: SubmitMemberWorkSignalResult["outcome"];
  receipt: MemberWorkSignalReceipt;
  transitioned: boolean;
  transition: TransitionMemberPromptResult | null;
  // Set only when transitioned is false because the transition step
  // itself failed (as opposed to never being attempted).
  transitionError: string | null;
};

// candidate_write composition function (M3c Architecture #1): a
// progress_report/free_text_answer response IS a work signal bound to the
// prompt's subject object — there is no dedicated response table for it.
// Deliberately TWO transactions, not one: submitMemberWorkSignal commits
// first (its own serializable tx), then transitionMemberPrompt runs
// separately (its own serializable tx) with cause 'respond' and
// responseRef = the just-recorded signal receipt id. This is NOT a
// candidate for the M3c Architecture #4 single-transaction treatment:
// unlike the non-candidate response classes, the signal write is already a
// complete, independently valid piece of durable evidence the instant it
// commits (M2 as-built), so there is no CAS invariant across the two writes
// to protect — only a best-effort sequencing. A transition failure AFTER
// the signal commits (version conflict, prompt already responded, etc.)
// does NOT undo or invalidate the signal; the caller can retry
// transitionMemberPrompt directly with the SAME responseRef
// (signal.receipt.receiptId) without resubmitting. This function reports
// which step completed by returning rather than throwing on a
// transition-step failure.
export async function respondWithWorkSignal(
  input: RespondWithWorkSignalInput,
): Promise<RespondWithWorkSignalResult> {
  const signal = await submitMemberWorkSignal({
    principal: input.principal,
    challengeRef: input.challengeRef,
    payload: input.payload,
    surface: input.surface,
    evidenceSurfaces: input.evidenceSurfaces,
    policyRef: input.policyRef,
    policyVersion: input.policyVersion,
    receiptId: input.receiptId,
    supersedesReceiptRef: input.supersedesReceiptRef ?? null,
  });

  // Subject-object binding (review fix, M3c as-built #7):
  // submitMemberWorkSignal has no notion of "which prompt is this meant to
  // answer" — it only knows the signal's own objectRef (from the challenge
  // it was issued against). That binding is checked here, AFTER the signal
  // is already durable evidence and BEFORE the prompt is touched: a
  // mismatch never unwinds the signal (it stays valid, independently
  // recorded evidence, exactly like a downstream transition failure would
  // leave it); only the prompt transition this call additionally asked for
  // does not happen.
  const promptRow = await db.memberPrompt.findUnique({
    where: {
      id_workspaceId: {
        id: input.promptRef,
        workspaceId: input.principal.workspaceRef,
      },
    },
  });
  if (!promptRow) {
    throw new MemberPromptResponseStoreError("prompt_not_found");
  }
  if (signal.receipt.objectRef !== promptRow.subjectObjectRef) {
    throw new MemberPromptResponseStoreError("signal_object_prompt_mismatch", [
      "signal_object_prompt_mismatch",
    ]);
  }

  try {
    const transition = await transitionMemberPrompt({
      workspaceRef: input.principal.workspaceRef,
      promptRef: input.promptRef,
      cause: "respond",
      expectedVersion: input.expectedVersion,
      receiptId: input.transitionReceiptId,
      now: input.now,
      responseRef: signal.receipt.receiptId,
    });
    return {
      signalOutcome: signal.outcome,
      receipt: signal.receipt,
      transitioned: true,
      transition,
      transitionError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      signalOutcome: signal.outcome,
      receipt: signal.receipt,
      transitioned: false,
      transition: null,
      transitionError: message,
    };
  }
}
