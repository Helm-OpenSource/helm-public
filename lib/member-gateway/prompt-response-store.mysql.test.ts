// lib/member-gateway/prompt-response-store.mysql.test.ts
// Isolated-MySQL coverage for the prompt-response store (spec §5/§6.3/§7;
// M3c): the full acknowledge/refuse/pause/commitment_confirm chains,
// governance-response persistence and re-verification, the authority
// triple binding, protected-route gating, the candidate-write redirect,
// challenge replay, the expiry sweep, the append-only database boundary,
// and the respondWithWorkSignal composition function. Gated on
// MEMBER_PROMPT_RESPONSE_STORE_DATABASE_URL — same pattern as the
// prompt-queue and work-signal stores' isolated suites.

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateHumanResponse } from "@/lib/caio-governance/contract";
import { db } from "@/lib/db";
import type { MemberPrompt } from "@/lib/member-gateway/prompt";
import {
  createMemberPrompt,
  getMemberPrompt,
  listMemberPromptTransitionReceipts,
  transitionMemberPrompt,
} from "@/lib/member-gateway/prompt-store.service";
import {
  MemberPromptResponseStoreError,
  getMemberPromptResponseReceipt,
  issueMemberPromptResponseChallenge,
  recordMemberPromptResponse,
  respondWithWorkSignal,
} from "@/lib/member-gateway/prompt-response-store.service";
import type { MemberWorkSignalPayload } from "@/lib/member-gateway/signal";
import { issueMemberWorkSignalChallenge } from "@/lib/member-gateway/signal-store.service";
import type {
  MemberPrincipal,
  MemberReadSurfaceDecision,
} from "@/lib/member-gateway/types";

const integrationDatabaseUrl =
  process.env.MEMBER_PROMPT_RESPONSE_STORE_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;

const ALLOWED_SURFACE: MemberReadSurfaceDecision = {
  allowed: true,
  deniedDimensions: [],
};

const POLICY_REF = "signal-policy-1";
const POLICY_VERSION = 1;

const CLEAR_CONTEXT = { inQuietHours: false, doNotDisturb: false };

// Most MemberPromptResponseStoreError throws carry `reason` in the
// structured `reasons` array; a few guard-clause throws pass only a bare
// message with no reasons array (see MemberPromptStoreError /
// MemberSignalStoreError precedent). Either shape satisfies this
// assertion.
async function expectResponseStoreError(
  promise: Promise<unknown>,
  reason: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(MemberPromptResponseStoreError);
  await promise.catch((error: unknown) => {
    expect(error).toBeInstanceOf(MemberPromptResponseStoreError);
    const storeError = error as MemberPromptResponseStoreError;
    const matchesReason =
      storeError.reasons.includes(reason) ||
      storeError.message.includes(reason);
    expect(matchesReason).toBe(true);
  });
}

describeMysql(
  "member prompt response store with an isolated MySQL database",
  () => {
    let workspaceId = "";
    let ownerUserId = "";
    let caseCounter = 0;

    beforeAll(async () => {
      if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
        throw new Error(
          "DATABASE_URL must equal MEMBER_PROMPT_RESPONSE_STORE_DATABASE_URL for the isolated integration test.",
        );
      }
      const workspace = await db.workspace.create({
        data: {
          name: `Member prompt response store integration ${suffix}`,
          slug: `member-prompt-response-store-integration-${suffix}`,
        },
      });
      workspaceId = workspace.id;
      const owner = await db.user.create({
        data: {
          email: `member-prompt-response-owner-${suffix}@example.com`,
          name: "Member prompt response store owner",
        },
      });
      ownerUserId = owner.id;
      await db.membership.create({
        data: {
          workspaceId,
          userId: ownerUserId,
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });
    });

    afterAll(async () => {
      // This suite targets a disposable, suffix-guarded database. The
      // MemberPromptResponseReceipt and MemberPromptTransitionReceipt rows
      // this suite creates are append-only (blocked by database triggers)
      // and the workspace row cannot be deleted while prompt/receipt rows
      // still reference it (onDelete: Restrict), so teardown only
      // disconnects.
      await db.$disconnect();
    });

    function nextId(prefix: string): string {
      caseCounter += 1;
      return `${prefix}-${suffix}-${caseCounter}`;
    }

    function principal(
      overrides: Partial<MemberPrincipal> = {},
    ): MemberPrincipal {
      return {
        workspaceRef: workspaceId,
        memberRef: `member-${suffix}`,
        sessionRef: `session-${suffix}`,
        deviceRegistrationRef: `device-${suffix}`,
        clientId: "workbuddy-desktop",
        ...overrides,
      };
    }

    function buildPrompt(overrides: Partial<MemberPrompt> = {}): MemberPrompt {
      const now = Date.now();
      return {
        promptRef: nextId("prompt"),
        workspaceRef: workspaceId,
        memberRef: `member-${suffix}`,
        severity: "normal",
        severityRuleRef: null,
        subjectObjectRef: nextId("case"),
        projectedSummary: "需要您确认还款计划",
        evidenceRefs: [],
        issuedAt: new Date(now - 1_000).toISOString(),
        expiresAt: new Date(now + 5 * 60_000).toISOString(),
        ...overrides,
      };
    }

    // MemberPrompt carries no append-only trigger; push both issuedAt and
    // expiresAt into the past while keeping the window valid
    // (MWPrompt_window_check requires expiresAt > issuedAt) so the row is
    // already past its window by the time a call runs. Dates are computed
    // in JS and bound as parameters rather than using SQL NOW(): the MySQL
    // session clock is not UTC, while Prisma reads/writes DATETIME columns
    // as UTC (mirrors prompt-store.mysql.test.ts).
    async function pushPromptWindowIntoThePast(promptRef: string): Promise<void> {
      const base = Date.now();
      await db.$executeRaw`
        UPDATE MemberPrompt
        SET issuedAt = ${new Date(base - 10 * 60_000)},
            expiresAt = ${new Date(base - 5 * 60_000)}
        WHERE id = ${promptRef} AND workspaceId = ${workspaceId}
      `;
    }

    async function createAndDeliverPrompt(
      overrides: Partial<MemberPrompt> = {},
    ): Promise<{ prompt: MemberPrompt; version: number }> {
      const prompt = buildPrompt(overrides);
      await createMemberPrompt({ prompt });
      const deliver = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "deliver",
        expectedVersion: 1,
        receiptId: nextId("deliver-receipt"),
        now: new Date().toISOString(),
        deliveryContext: CLEAR_CONTEXT,
      });
      expect(deliver.outcome).toBe("transitioned");
      return { prompt, version: deliver.receipt.version };
    }

    function responsePayload(
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> {
      return { note: "响应内容", ...overrides };
    }

    async function issueResponseChallenge(
      promptRef: string,
      promptVersion: number,
      payload: unknown,
      ttlMs = 60_000,
    ) {
      return issueMemberPromptResponseChallenge({
        principal: principal(),
        promptRef,
        promptVersion,
        responsePayload: payload,
        ttlMs,
      });
    }

    it("runs the acknowledge chain: challenge issue -> record, no transition, challenge consumed", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "ack" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      const receiptId = nextId("receipt");
      const result = await recordMemberPromptResponse({
        principal: principal(),
        promptRef: prompt.promptRef,
        expectedVersion: version,
        challengeRef: challenge.challengeRef,
        responsePayload: payload,
        kind: "acknowledge",
        receiptId,
        transitionReceiptId: nextId("transition-receipt"),
        now: new Date().toISOString(),
      });

      expect(result.outcome).toBe("recorded");
      expect(result.promptTransitioned).toBe(false);
      expect(result.receipt.responseClass).toBe("interaction_receipt");
      expect(result.receipt.responseKind).toBe("acknowledge");
      expect(result.receipt.evaluationUseProhibited).toBe(true);

      // acknowledge does not transition the prompt: it stays delivered.
      const afterAck = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterAck?.state).toBe("delivered");
      expect(afterAck?.version).toBe(version);

      const challengeRow = await db.memberWorkSignalChallenge.findUniqueOrThrow(
        { where: { id: challenge.challengeRef } },
      );
      expect(challengeRow.consumedAt).not.toBeNull();
      expect(challengeRow.consumptionReceiptRef).toBe(receiptId);
    });

    it("runs the refuse chain: protected route + governed response persistence and read-back", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "refuse" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      const receiptId = nextId("receipt");
      const mandateRef = nextId("mandate");
      const result = await recordMemberPromptResponse({
        principal: principal(),
        promptRef: prompt.promptRef,
        expectedVersion: version,
        challengeRef: challenge.challengeRef,
        responsePayload: payload,
        kind: "refuse",
        receiptId,
        transitionReceiptId: nextId("transition-receipt"),
        now: new Date().toISOString(),
        protectedInput: {
          userPresenceAvailable: false,
          localFallbackAvailable: true,
          routePath: "local_fallback",
          mandateRef,
          reason: "范围超出授权",
          auditRefs: [nextId("audit")],
          governanceResponseId: nextId("governance-response"),
        },
      });

      expect(result.outcome).toBe("recorded");
      expect(result.promptTransitioned).toBe(true);
      expect(result.receipt.responseClass).toBe("protected_human_response");
      expect(result.receipt.responseKind).toBe("refuse");
      expect(result.receipt.mandateRef).toBe(mandateRef);
      expect(result.receipt.routePath).toBe("local_fallback");
      expect(result.receipt.governedResponseHash).toMatch(/^sha256:[0-9a-f]{64}$/u);

      const afterRefuse = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterRefuse?.state).toBe("responded");
      expect(afterRefuse?.version).toBe(version + 1);
      const row = await db.memberPrompt.findUniqueOrThrow({
        where: { id_workspaceId: { id: prompt.promptRef, workspaceId } },
      });
      expect(row.responseRef).toBe(receiptId);

      const fetched = await getMemberPromptResponseReceipt(
        workspaceId,
        receiptId,
      );
      expect(fetched).not.toBeNull();
      expect(fetched?.governedResponse).not.toBeNull();
      expect(validateHumanResponse(fetched!.governedResponse!)).toEqual({
        valid: true,
        errors: [],
      });
      expect(fetched?.governedResponse?.retaliationProhibited).toBe(true);
      expect(fetched?.governedResponse?.responseType).toBe("refuse");
      expect(fetched?.mandateRef).toBe(mandateRef);
      expect(fetched?.routePath).toBe("local_fallback");
    });

    it("runs the pause chain over the user_presence route", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "pause" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      const receiptId = nextId("receipt");
      const result = await recordMemberPromptResponse({
        principal: principal(),
        promptRef: prompt.promptRef,
        expectedVersion: version,
        challengeRef: challenge.challengeRef,
        responsePayload: payload,
        kind: "pause",
        receiptId,
        transitionReceiptId: nextId("transition-receipt"),
        now: new Date().toISOString(),
        protectedInput: {
          userPresenceAvailable: true,
          localFallbackAvailable: false,
          routePath: "user_presence",
          mandateRef: nextId("mandate"),
          reason: "需要暂停以核实客户身份",
          auditRefs: [nextId("audit")],
          governanceResponseId: nextId("governance-response"),
        },
      });

      expect(result.outcome).toBe("recorded");
      expect(result.promptTransitioned).toBe(true);
      expect(result.receipt.responseClass).toBe("protected_human_response");
      expect(result.receipt.responseKind).toBe("pause");
      expect(result.receipt.routePath).toBe("user_presence");
    });

    it("runs the commitment_confirm chain with a matching authority triple", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "commit" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      const receiptId = nextId("receipt");
      const externalAuthorizationRef = nextId("authz");
      const result = await recordMemberPromptResponse({
        principal: principal(),
        promptRef: prompt.promptRef,
        expectedVersion: version,
        challengeRef: challenge.challengeRef,
        responsePayload: payload,
        kind: "commitment_confirm",
        receiptId,
        transitionReceiptId: nextId("transition-receipt"),
        now: new Date().toISOString(),
        authorityInput: {
          externalAuthorizationRef,
          userPresenceVerified: true,
          authorizedMemberRef: principal().memberRef,
          authorizedObjectRef: prompt.subjectObjectRef,
          authorizedActionRef: "member_prompt_response:commitment_confirm",
        },
      });

      expect(result.outcome).toBe("recorded");
      expect(result.promptTransitioned).toBe(true);
      expect(result.receipt.responseClass).toBe("authority_bearing_action");
      expect(result.receipt.responseKind).toBe("commitment_confirm");
      expect(result.receipt.externalAuthorizationRef).toBe(
        externalAuthorizationRef,
      );
      expect(result.receipt.authorizedMemberRef).toBe(principal().memberRef);
      expect(result.receipt.authorizedObjectRef).toBe(prompt.subjectObjectRef);
      expect(result.receipt.authorizedActionRef).toBe(
        "member_prompt_response:commitment_confirm",
      );

      const afterConfirm = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterConfirm?.state).toBe("responded");
      expect(afterConfirm?.version).toBe(version + 1);
    });

    it("rejects a commitment_confirm whose authorizedObjectRef does not match the prompt's subject", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "commit-mismatch" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: version,
          challengeRef: challenge.challengeRef,
          responsePayload: payload,
          kind: "commitment_confirm",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
          authorityInput: {
            externalAuthorizationRef: nextId("authz"),
            userPresenceVerified: true,
            authorizedMemberRef: principal().memberRef,
            authorizedObjectRef: nextId("wrong-case"),
            authorizedActionRef: "member_prompt_response:commitment_confirm",
          },
        }),
        "authority_binding_mismatch",
      );
    });

    it("rejects a commitment_confirm whose authorizedActionRef does not match the kind-derived action", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "commit-action-mismatch" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: version,
          challengeRef: challenge.challengeRef,
          responsePayload: payload,
          kind: "commitment_confirm",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
          authorityInput: {
            externalAuthorizationRef: nextId("authz"),
            userPresenceVerified: true,
            authorizedMemberRef: principal().memberRef,
            authorizedObjectRef: prompt.subjectObjectRef,
            // The store derives the true actionRef from `kind` internally
            // (AUTHORITY_ACTION_REF_BY_KIND); a caller can never supply
            // both sides of that comparison. Any authorizedActionRef other
            // than the derived literal is a mismatch, including the bare
            // kind name a caller might naively guess.
            authorizedActionRef: "commitment_confirm",
          },
        }),
        "authority_binding_mismatch",
      );
    });

    it("rejects a commitment_confirm missing its external authorization ref", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "commit-no-authz" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: version,
          challengeRef: challenge.challengeRef,
          responsePayload: payload,
          kind: "commitment_confirm",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
          authorityInput: {
            externalAuthorizationRef: "",
            userPresenceVerified: true,
            authorizedMemberRef: principal().memberRef,
            authorizedObjectRef: prompt.subjectObjectRef,
            authorizedActionRef: "member_prompt_response:commitment_confirm",
          },
        }),
        "authority_missing",
      );
    });

    it("rejects a protected response when neither route is available", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "refuse-no-route" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: version,
          challengeRef: challenge.challengeRef,
          responsePayload: payload,
          kind: "refuse",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
          protectedInput: {
            userPresenceAvailable: false,
            localFallbackAvailable: false,
            routePath: "local_fallback",
            mandateRef: nextId("mandate"),
            reason: "两条通道都不可用",
            auditRefs: [nextId("audit")],
            governanceResponseId: nextId("governance-response"),
          },
        }),
        "protected_response_path_unavailable",
      );
    });

    it("rejects a protected response whose chosen routePath is not among the available paths", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "refuse-bad-route" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: version,
          challengeRef: challenge.challengeRef,
          responsePayload: payload,
          kind: "refuse",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
          protectedInput: {
            userPresenceAvailable: true,
            localFallbackAvailable: false,
            routePath: "local_fallback",
            mandateRef: nextId("mandate"),
            reason: "选择了不可用的通道",
            auditRefs: [nextId("audit")],
            governanceResponseId: nextId("governance-response"),
          },
        }),
        "protected_route_path_invalid",
      );
    });

    it("redirects a candidate_write kind to the signal path instead of recording it here", async () => {
      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: nextId("prompt-unused"),
          expectedVersion: 1,
          challengeRef: nextId("challenge-unused"),
          responsePayload: responsePayload(),
          kind: "progress_report",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
        }),
        "candidate_response_uses_signal_path",
      );
    });

    it("rejects a replayed challenge and the unique (workspaceId, challengeRef) backstop holds at the DB layer", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "ack-replay" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      const firstReceiptId = nextId("receipt");
      const first = await recordMemberPromptResponse({
        principal: principal(),
        promptRef: prompt.promptRef,
        expectedVersion: version,
        challengeRef: challenge.challengeRef,
        responsePayload: payload,
        kind: "acknowledge",
        receiptId: firstReceiptId,
        transitionReceiptId: nextId("transition-receipt"),
        now: new Date().toISOString(),
      });
      expect(first.outcome).toBe("recorded");

      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: version,
          challengeRef: challenge.challengeRef,
          responsePayload: payload,
          kind: "acknowledge",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
        }),
        "challenge_already_consumed",
      );

      // DB-layer backstop: a second response receipt row naming the SAME
      // challengeRef is rejected by the unique index even if some future
      // code path skipped the store's own judgment.
      let raised: unknown = null;
      try {
        await db.memberPromptResponseReceipt.create({
          data: {
            id: nextId("receipt-raw"),
            workspaceId,
            promptRef: prompt.promptRef,
            memberRef: principal().memberRef,
            deviceRegistrationRef: principal().deviceRegistrationRef,
            clientId: principal().clientId,
            responseKind: "acknowledge",
            responseClass: "interaction_receipt",
            challengeRef: challenge.challengeRef,
            occurredAt: new Date(),
            evaluationUseProhibited: true,
          },
        });
      } catch (error) {
        raised = error;
      }
      expect((raised as { code?: string } | null)?.code).toBe("P2002");
    });

    it("sweeps an expired prompt ahead of the response and does not record it", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });
      await pushPromptWindowIntoThePast(prompt.promptRef);

      const receiptId = nextId("receipt");
      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: 1,
          challengeRef: nextId("challenge-unused"),
          responsePayload: responsePayload(),
          kind: "acknowledge",
          receiptId,
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
        }),
        "prompt_expired_swept",
      );

      const afterSweep = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterSweep?.state).toBe("expired");
      expect(afterSweep?.version).toBe(2);

      const receipts = await listMemberPromptTransitionReceipts(
        workspaceId,
        prompt.promptRef,
      );
      expect(receipts).toHaveLength(1);
      expect(receipts[0]?.cause).toBe("expire");

      const fetched = await getMemberPromptResponseReceipt(
        workspaceId,
        receiptId,
      );
      expect(fetched).toBeNull();
    });

    it("blocks direct UPDATE and DELETE against a response receipt row at the database boundary", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "ack-append-only" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );
      const receiptId = nextId("receipt");
      const recorded = await recordMemberPromptResponse({
        principal: principal(),
        promptRef: prompt.promptRef,
        expectedVersion: version,
        challengeRef: challenge.challengeRef,
        responsePayload: payload,
        kind: "acknowledge",
        receiptId,
        transitionReceiptId: nextId("transition-receipt"),
        now: new Date().toISOString(),
      });
      expect(recorded.outcome).toBe("recorded");

      await expect(
        db.$executeRaw`
          UPDATE MemberPromptResponseReceipt
          SET responseKind = 'refuse'
          WHERE id = ${receiptId}
        `,
      ).rejects.toThrow(/append-only/u);

      await expect(
        db.$executeRaw`
          DELETE FROM MemberPromptResponseReceipt
          WHERE id = ${receiptId}
        `,
      ).rejects.toThrow(/append-only/u);

      const persisted = await db.memberPromptResponseReceipt.findUniqueOrThrow(
        {
          where: { id: receiptId },
          select: { responseKind: true },
        },
      );
      expect(persisted.responseKind).toBe("acknowledge");
    });

    it("respondWithWorkSignal composes signal submission then prompt transition", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const signalPayload: MemberWorkSignalPayload = {
        kind: "progress",
        summary: "客户已确认还款意向",
        detail: "电话沟通 20 分钟,确认周五前处理。",
        relatedEvidenceRefs: [],
      };
      const challenge = await issueMemberWorkSignalChallenge({
        draft: {
          principal: principal(),
          objectRef: prompt.subjectObjectRef,
          objectVersion: 1,
          payload: signalPayload,
        },
        ttlMs: 60_000,
      });

      const signalReceiptId = nextId("signal-receipt");
      const result = await respondWithWorkSignal({
        principal: principal(),
        challengeRef: challenge.challengeRef,
        payload: signalPayload,
        surface: ALLOWED_SURFACE,
        evidenceSurfaces: new Map(),
        policyRef: POLICY_REF,
        policyVersion: POLICY_VERSION,
        receiptId: signalReceiptId,
        promptRef: prompt.promptRef,
        expectedVersion: version,
        transitionReceiptId: nextId("transition-receipt"),
        now: new Date().toISOString(),
      });

      expect(result.signalOutcome).toBe("recorded");
      expect(result.receipt.receiptId).toBe(signalReceiptId);
      expect(result.transitioned).toBe(true);
      expect(result.transitionError).toBeNull();
      expect(result.transition?.outcome).toBe("transitioned");
      expect(result.transition?.receipt.responseRef).toBe(signalReceiptId);

      const row = await db.memberPrompt.findUniqueOrThrow({
        where: { id_workspaceId: { id: prompt.promptRef, workspaceId } },
      });
      expect(row.state).toBe("responded");
      expect(row.version).toBe(version + 1);
      expect(row.responseRef).toBe(signalReceiptId);
    });

    it("rejects a challenge issued by, and a response recorded by, a member the prompt is not addressed to", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const otherPrincipal = principal({
        memberRef: `member-${suffix}-other`,
        sessionRef: `session-${suffix}-other`,
        deviceRegistrationRef: `device-${suffix}-other`,
      });

      await expectResponseStoreError(
        issueMemberPromptResponseChallenge({
          principal: otherPrincipal,
          promptRef: prompt.promptRef,
          promptVersion: version,
          responsePayload: responsePayload(),
          ttlMs: 60_000,
        }),
        "prompt_member_binding_mismatch",
      );

      // Record path: even a challenge minted for the real addressee must
      // still be rejected if a different member attempts to record
      // against it — the binding check runs against the prompt row
      // itself, not only at issue time.
      const payload = responsePayload({ kind: "ack-wrong-member" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );
      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: otherPrincipal,
          promptRef: prompt.promptRef,
          expectedVersion: version,
          challengeRef: challenge.challengeRef,
          responsePayload: payload,
          kind: "acknowledge",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
        }),
        "prompt_member_binding_mismatch",
      );
    });

    it("rejects an acknowledge attempted against a prompt that is not delivered", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });
      const payload = responsePayload({ kind: "ack-not-delivered" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        1,
        payload,
      );

      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: 1,
          challengeRef: challenge.challengeRef,
          responsePayload: payload,
          kind: "acknowledge",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
        }),
        "acknowledge_state_invalid",
      );
    });

    it("rejects a response redeeming a challenge issued against a stale prompt version, and succeeds once re-issued at the current version", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });
      const payload = responsePayload({ kind: "ack-version-pin" });

      // Issued at v1, before delivery bumps the prompt to v2.
      const staleChallenge = await issueResponseChallenge(
        prompt.promptRef,
        1,
        payload,
      );

      const deliver = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "deliver",
        expectedVersion: 1,
        receiptId: nextId("deliver-receipt"),
        now: new Date().toISOString(),
        deliveryContext: CLEAR_CONTEXT,
      });
      expect(deliver.outcome).toBe("transitioned");
      const version = deliver.receipt.version;
      expect(version).toBe(2);

      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: version,
          challengeRef: staleChallenge.challengeRef,
          responsePayload: payload,
          kind: "acknowledge",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
        }),
        "challenge_prompt_version_mismatch",
      );

      const freshChallenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );
      const result = await recordMemberPromptResponse({
        principal: principal(),
        promptRef: prompt.promptRef,
        expectedVersion: version,
        challengeRef: freshChallenge.challengeRef,
        responsePayload: payload,
        kind: "acknowledge",
        receiptId: nextId("receipt"),
        transitionReceiptId: nextId("transition-receipt"),
        now: new Date().toISOString(),
      });
      expect(result.outcome).toBe("recorded");
    });

    it("rejects a response whose payload has drifted from the challenge hash", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "ack-drift" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: version,
          challengeRef: challenge.challengeRef,
          responsePayload: responsePayload({
            kind: "ack-drift",
            drifted: true,
          }),
          kind: "acknowledge",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
        }),
        "challenge_payload_hash_mismatch",
      );
    });

    it("rejects a response against an expired challenge", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const payload = responsePayload({ kind: "ack-expired-challenge" });
      const challenge = await issueResponseChallenge(
        prompt.promptRef,
        version,
        payload,
      );

      // MemberWorkSignalChallenge carries no append-only trigger; push
      // expiresAt to just after issuedAt (still satisfying the
      // MWSignalChallenge_window_check CHECK constraint) so it is already
      // in the past by the time record runs (mirrors
      // signal-store.mysql.test.ts).
      await db.$executeRaw`
        UPDATE MemberWorkSignalChallenge
        SET expiresAt = DATE_ADD(issuedAt, INTERVAL 1000 MICROSECOND)
        WHERE id = ${challenge.challengeRef} AND workspaceId = ${workspaceId}
      `;

      await expectResponseStoreError(
        recordMemberPromptResponse({
          principal: principal(),
          promptRef: prompt.promptRef,
          expectedVersion: version,
          challengeRef: challenge.challengeRef,
          responsePayload: payload,
          kind: "acknowledge",
          receiptId: nextId("receipt"),
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
        }),
        "challenge_expired",
      );
    });

    it("rejects respondWithWorkSignal when the signal's objectRef does not match the prompt's subject object", async () => {
      const { prompt, version } = await createAndDeliverPrompt();
      const signalPayload: MemberWorkSignalPayload = {
        kind: "progress",
        summary: "与本 prompt 主题对象无关的信号",
        detail: "objectRef 指向另一个案例",
        relatedEvidenceRefs: [],
      };
      const wrongObjectRef = nextId("case-unrelated");
      const challenge = await issueMemberWorkSignalChallenge({
        draft: {
          principal: principal(),
          objectRef: wrongObjectRef,
          objectVersion: 1,
          payload: signalPayload,
        },
        ttlMs: 60_000,
      });

      await expectResponseStoreError(
        respondWithWorkSignal({
          principal: principal(),
          challengeRef: challenge.challengeRef,
          payload: signalPayload,
          surface: ALLOWED_SURFACE,
          evidenceSurfaces: new Map(),
          policyRef: POLICY_REF,
          policyVersion: POLICY_VERSION,
          receiptId: nextId("signal-receipt"),
          promptRef: prompt.promptRef,
          expectedVersion: version,
          transitionReceiptId: nextId("transition-receipt"),
          now: new Date().toISOString(),
        }),
        "signal_object_prompt_mismatch",
      );

      const row = await db.memberPrompt.findUniqueOrThrow({
        where: { id_workspaceId: { id: prompt.promptRef, workspaceId } },
      });
      expect(row.state).toBe("delivered");
      expect(row.version).toBe(version);
    });
  },
);
