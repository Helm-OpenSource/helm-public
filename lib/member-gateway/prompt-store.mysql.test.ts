// lib/member-gateway/prompt-store.mysql.test.ts
// Isolated-MySQL coverage for the prompt-queue store (spec §6.3; M3a
// as-built #5-9): the full create/deliver/respond chain, optimistic
// version conflicts, quiet-hours/do-not-disturb holds (no state change, no
// receipt), the critical-severity bypass, the expiry sweep, terminal-state
// rejection, snooze/unsnooze, missing-field rejections, duplicate create,
// and the append-only database boundary. Gated on
// MEMBER_PROMPT_STORE_DATABASE_URL — same pattern as the work-signal
// store's isolated suite.

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import type { MemberPrompt } from "@/lib/member-gateway/prompt";
import {
  MemberPromptStoreError,
  createMemberPrompt,
  getMemberPrompt,
  listMemberPromptTransitionReceipts,
  transitionMemberPrompt,
} from "@/lib/member-gateway/prompt-store.service";

const integrationDatabaseUrl = process.env.MEMBER_PROMPT_STORE_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;

// Most MemberPromptStoreError throws carry `reason` in the structured
// `reasons` array; a few guard-clause throws (e.g. prompt_version_conflict)
// pass only a bare message with no reasons array, in which case the
// constructor uses that message as-is (see MemberPromptStoreError). Either
// shape satisfies this assertion.
async function expectStoreError(
  promise: Promise<unknown>,
  reason: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(MemberPromptStoreError);
  await promise.catch((error: unknown) => {
    expect(error).toBeInstanceOf(MemberPromptStoreError);
    const storeError = error as MemberPromptStoreError;
    const matchesReason =
      storeError.reasons.includes(reason) ||
      storeError.message.includes(reason);
    expect(matchesReason).toBe(true);
  });
}

describeMysql(
  "member prompt store with an isolated MySQL database",
  () => {
    let workspaceId = "";
    let ownerUserId = "";
    let caseCounter = 0;

    beforeAll(async () => {
      if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
        throw new Error(
          "DATABASE_URL must equal MEMBER_PROMPT_STORE_DATABASE_URL for the isolated integration test.",
        );
      }
      const workspace = await db.workspace.create({
        data: {
          name: `Member prompt store integration ${suffix}`,
          slug: `member-prompt-store-integration-${suffix}`,
        },
      });
      workspaceId = workspace.id;
      const owner = await db.user.create({
        data: {
          email: `member-prompt-owner-${suffix}@example.com`,
          name: "Member prompt store owner",
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
      // MemberPromptTransitionReceipt rows this suite creates are
      // append-only (blocked by database triggers) and the workspace row
      // cannot be deleted while prompt/receipt rows still reference it
      // (onDelete: Restrict), so teardown only disconnects.
      await db.$disconnect();
    });

    function nextId(prefix: string): string {
      caseCounter += 1;
      return `${prefix}-${suffix}-${caseCounter}`;
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

    const CLEAR_CONTEXT = { inQuietHours: false, doNotDisturb: false };
    const QUIET_HOURS_CONTEXT = { inQuietHours: true, doNotDisturb: false };

    // MemberPrompt carries no append-only trigger; push both issuedAt and
    // expiresAt into the past while keeping the window valid
    // (MWPrompt_window_check requires expiresAt > issuedAt) so the row is
    // already past its window by the time a transition runs. Dates are
    // computed in JS and bound as parameters rather than using SQL NOW():
    // the MySQL session clock is not UTC, while Prisma reads/writes
    // DATETIME columns as UTC, so DATE_SUB(NOW(3), ...) round-trips with a
    // multi-hour skew relative to the application clock used elsewhere in
    // this suite.
    async function pushPromptWindowIntoThePast(promptRef: string): Promise<void> {
      const base = Date.now();
      await db.$executeRaw`
        UPDATE MemberPrompt
        SET issuedAt = ${new Date(base - 10 * 60_000)},
            expiresAt = ${new Date(base - 5 * 60_000)}
        WHERE id = ${promptRef} AND workspaceId = ${workspaceId}
      `;
    }

    it("runs the full create -> deliver -> respond chain with version and receipt bookkeeping", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });

      const afterCreate = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterCreate?.state).toBe("pending");
      expect(afterCreate?.version).toBe(1);

      const deliverReceiptId = nextId("receipt-deliver");
      const deliverResult = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "deliver",
        expectedVersion: 1,
        receiptId: deliverReceiptId,
        now: new Date().toISOString(),
        deliveryContext: CLEAR_CONTEXT,
      });
      expect(deliverResult.outcome).toBe("transitioned");
      expect(deliverResult.receipt.version).toBe(2);
      expect(deliverResult.receipt.fromState).toBe("pending");
      expect(deliverResult.receipt.toState).toBe("delivered");
      expect(deliverResult.receipt.deliverDecision).toBe("deliver");
      expect(deliverResult.receipt.heldReason).toBeNull();
      expect(deliverResult.receipt.evaluationUseProhibited).toBe(true);

      const afterDeliver = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterDeliver?.state).toBe("delivered");
      expect(afterDeliver?.version).toBe(2);

      const responseRef = nextId("response");
      const respondReceiptId = nextId("receipt-respond");
      const respondResult = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "respond",
        expectedVersion: 2,
        receiptId: respondReceiptId,
        now: new Date().toISOString(),
        responseRef,
      });
      expect(respondResult.outcome).toBe("transitioned");
      expect(respondResult.receipt.version).toBe(3);
      expect(respondResult.receipt.fromState).toBe("delivered");
      expect(respondResult.receipt.toState).toBe("responded");
      expect(respondResult.receipt.responseRef).toBe(responseRef);
      expect(respondResult.receipt.evaluationUseProhibited).toBe(true);

      const afterRespond = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterRespond?.state).toBe("responded");
      expect(afterRespond?.version).toBe(3);

      const receipts = await listMemberPromptTransitionReceipts(
        workspaceId,
        prompt.promptRef,
      );
      expect(receipts.map((receipt) => receipt.version)).toEqual([2, 3]);
      expect(receipts[0]?.receiptId).toBe(deliverReceiptId);
      expect(receipts[1]?.receiptId).toBe(respondReceiptId);
    });

    it("rejects a transition against a stale expectedVersion", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });

      await expectStoreError(
        transitionMemberPrompt({
          workspaceRef: workspaceId,
          promptRef: prompt.promptRef,
          cause: "deliver",
          expectedVersion: 99,
          receiptId: nextId("receipt"),
          now: new Date().toISOString(),
          deliveryContext: CLEAR_CONTEXT,
        }),
        "prompt_version_conflict",
      );
    });

    it("holds delivery during quiet hours for a normal prompt with no state change and no receipt", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });

      await expectStoreError(
        transitionMemberPrompt({
          workspaceRef: workspaceId,
          promptRef: prompt.promptRef,
          cause: "deliver",
          expectedVersion: 1,
          receiptId: nextId("receipt"),
          now: new Date().toISOString(),
          deliveryContext: QUIET_HOURS_CONTEXT,
        }),
        "prompt_delivery_held:held_quiet_hours",
      );

      const afterHold = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterHold?.state).toBe("pending");
      expect(afterHold?.version).toBe(1);

      const receipts = await listMemberPromptTransitionReceipts(
        workspaceId,
        prompt.promptRef,
      );
      expect(receipts).toHaveLength(0);
    });

    it("delivers a critical prompt with a rule ref through quiet hours", async () => {
      const prompt = buildPrompt({
        severity: "critical",
        severityRuleRef: nextId("rule"),
      });
      await createMemberPrompt({ prompt });

      const result = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "deliver",
        expectedVersion: 1,
        receiptId: nextId("receipt"),
        now: new Date().toISOString(),
        deliveryContext: QUIET_HOURS_CONTEXT,
      });
      expect(result.outcome).toBe("transitioned");
      expect(result.receipt.toState).toBe("delivered");
      expect(result.receipt.deliverDecision).toBe("deliver");

      const afterDeliver = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterDeliver?.state).toBe("delivered");
    });

    it("sweeps an expired prompt ahead of the requested cause", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });
      await pushPromptWindowIntoThePast(prompt.promptRef);

      const result = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "respond",
        expectedVersion: 1,
        receiptId: nextId("receipt-sweep"),
        now: new Date().toISOString(),
        responseRef: nextId("response"),
      });
      expect(result.outcome).toBe("expired_swept");
      expect(result.receipt.cause).toBe("expire");
      expect(result.receipt.fromState).toBe("pending");
      expect(result.receipt.toState).toBe("expired");

      const afterSweep = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterSweep?.state).toBe("expired");
      expect(afterSweep?.version).toBe(2);

      const receipts = await listMemberPromptTransitionReceipts(
        workspaceId,
        prompt.promptRef,
      );
      expect(receipts).toHaveLength(1);
      expect(receipts[0]?.cause).toBe("expire");
    });

    it("rejects a directly requested expire before the window closes", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });
      await expectStoreError(
        transitionMemberPrompt({
          workspaceRef: workspaceId,
          promptRef: prompt.promptRef,
          cause: "expire",
          expectedVersion: 1,
          receiptId: nextId("receipt"),
          now: new Date().toISOString(),
        }),
        "prompt_expire_premature",
      );
      const row = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(row.state).toBe("pending");
      expect(row.version).toBe(1);
    });

    it("rejects a transition attempted from a terminal state", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });
      await pushPromptWindowIntoThePast(prompt.promptRef);
      const swept = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "withdraw",
        expectedVersion: 1,
        receiptId: nextId("receipt-sweep"),
        now: new Date().toISOString(),
      });
      expect(swept.outcome).toBe("expired_swept");

      await expectStoreError(
        transitionMemberPrompt({
          workspaceRef: workspaceId,
          promptRef: prompt.promptRef,
          cause: "withdraw",
          expectedVersion: 2,
          receiptId: nextId("receipt"),
          now: new Date().toISOString(),
        }),
        "prompt_transition_invalid",
      );
    });

    it("rejects an invalid snoozeUntil, accepts a valid snooze, and unsnoozes back to delivered", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });
      const deliver = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "deliver",
        expectedVersion: 1,
        receiptId: nextId("receipt"),
        now: new Date().toISOString(),
        deliveryContext: CLEAR_CONTEXT,
      });
      expect(deliver.outcome).toBe("transitioned");

      await expectStoreError(
        transitionMemberPrompt({
          workspaceRef: workspaceId,
          promptRef: prompt.promptRef,
          cause: "snooze",
          expectedVersion: 2,
          receiptId: nextId("receipt"),
          now: new Date().toISOString(),
          snoozeUntil: new Date(Date.now() - 60_000).toISOString(),
        }),
        "snooze_until_invalid",
      );

      const validSnoozeUntil = new Date(Date.now() + 2 * 60_000).toISOString();
      const snoozeResult = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "snooze",
        expectedVersion: 2,
        receiptId: nextId("receipt"),
        now: new Date().toISOString(),
        snoozeUntil: validSnoozeUntil,
      });
      expect(snoozeResult.outcome).toBe("transitioned");
      expect(snoozeResult.receipt.toState).toBe("snoozed");

      const snoozedRow = await db.memberPrompt.findUniqueOrThrow({
        where: { id_workspaceId: { id: prompt.promptRef, workspaceId } },
      });
      expect(snoozedRow.snoozeUntil?.toISOString()).toBe(validSnoozeUntil);

      const unsnoozeResult = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "unsnooze",
        expectedVersion: 3,
        receiptId: nextId("receipt"),
        now: new Date().toISOString(),
        deliveryContext: CLEAR_CONTEXT,
      });
      expect(unsnoozeResult.outcome).toBe("transitioned");
      expect(unsnoozeResult.receipt.toState).toBe("delivered");
      // Obligation #6 applies to unsnooze too: the re-delivery receipt
      // embeds the delivery decision.
      expect(unsnoozeResult.receipt.deliverDecision).toBe("deliver");
      expect(unsnoozeResult.receipt.heldReason).toBeNull();

      const afterUnsnooze = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(afterUnsnooze?.state).toBe("delivered");
      expect(afterUnsnooze?.version).toBe(4);
    });

    it("rejects a respond transition missing responseRef", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });
      await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "deliver",
        expectedVersion: 1,
        receiptId: nextId("receipt"),
        now: new Date().toISOString(),
        deliveryContext: CLEAR_CONTEXT,
      });

      await expectStoreError(
        transitionMemberPrompt({
          workspaceRef: workspaceId,
          promptRef: prompt.promptRef,
          cause: "respond",
          expectedVersion: 2,
          receiptId: nextId("receipt"),
          now: new Date().toISOString(),
        }),
        "response_ref_missing",
      );
    });

    it("blocks direct UPDATE and DELETE against a transition receipt row at the database boundary", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });
      const deliverReceiptId = nextId("receipt");
      const deliverResult = await transitionMemberPrompt({
        workspaceRef: workspaceId,
        promptRef: prompt.promptRef,
        cause: "deliver",
        expectedVersion: 1,
        receiptId: deliverReceiptId,
        now: new Date().toISOString(),
        deliveryContext: CLEAR_CONTEXT,
      });
      expect(deliverResult.outcome).toBe("transitioned");

      await expect(
        db.$executeRaw`
          UPDATE MemberPromptTransitionReceipt
          SET heldReason = 'tampered'
          WHERE id = ${deliverReceiptId}
        `,
      ).rejects.toThrow(/append-only/u);

      await expect(
        db.$executeRaw`
          DELETE FROM MemberPromptTransitionReceipt
          WHERE id = ${deliverReceiptId}
        `,
      ).rejects.toThrow(/append-only/u);

      const persisted =
        await db.memberPromptTransitionReceipt.findUniqueOrThrow({
          where: { id: deliverReceiptId },
          select: { heldReason: true },
        });
      expect(persisted.heldReason).toBeNull();
    });

    it("rejects creating a rule-less critical prompt at the store boundary", async () => {
      const prompt = buildPrompt({
        severity: "critical",
        severityRuleRef: null,
      });

      await expectStoreError(
        createMemberPrompt({ prompt }),
        "critical_severity_without_rule",
      );

      const notCreated = await getMemberPrompt(workspaceId, prompt.promptRef);
      expect(notCreated).toBeNull();
    });

    it("rejects creating a second prompt with an already-used promptRef", async () => {
      const prompt = buildPrompt();
      await createMemberPrompt({ prompt });

      await expectStoreError(
        createMemberPrompt({ prompt: { ...prompt } }),
        "prompt_already_exists",
      );
    });
  },
);
