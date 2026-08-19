// lib/member-gateway/signal-store.mysql.test.ts
// Isolated-MySQL coverage for the work-signal store (spec §5/§6.2/§9):
// one-time consumption, replay, evidence-ref authorization, the
// superseding chain, and the append-only database boundary. Gated on
// MEMBER_SIGNAL_STORE_DATABASE_URL — see the mandate-store isolated suite
// for the same pattern.

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS,
  type MemberWorkSignalDraft,
  type MemberWorkSignalPayload,
} from "@/lib/member-gateway/signal";
import {
  MemberSignalStoreError,
  getMemberWorkSignalReceipt,
  issueMemberWorkSignalChallenge,
  submitMemberWorkSignal,
} from "@/lib/member-gateway/signal-store.service";
import type {
  MemberPrincipal,
  MemberReadSurfaceDecision,
} from "@/lib/member-gateway/types";

const integrationDatabaseUrl = process.env.MEMBER_SIGNAL_STORE_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;

const ALLOWED_SURFACE: MemberReadSurfaceDecision = {
  allowed: true,
  deniedDimensions: [],
};

const POLICY_REF = "signal-policy-1";
const POLICY_VERSION = 1;

async function expectStoreError(
  promise: Promise<unknown>,
  reason: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(MemberSignalStoreError);
  await promise.catch((error: unknown) => {
    expect(error).toBeInstanceOf(MemberSignalStoreError);
    expect((error as MemberSignalStoreError).reasons).toContain(reason);
  });
}

describeMysql(
  "member work signal store with an isolated MySQL database",
  () => {
    let workspaceId = "";
    let ownerUserId = "";

    beforeAll(async () => {
      if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
        throw new Error(
          "DATABASE_URL must equal MEMBER_SIGNAL_STORE_DATABASE_URL for the isolated integration test.",
        );
      }
      const workspace = await db.workspace.create({
        data: {
          name: `Member signal store integration ${suffix}`,
          slug: `member-signal-store-integration-${suffix}`,
        },
      });
      workspaceId = workspace.id;
      const owner = await db.user.create({
        data: {
          email: `member-signal-owner-${suffix}@example.com`,
          name: "Member signal store owner",
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
      // MemberWorkSignalReceipt rows this suite creates are append-only
      // (blocked by database triggers) and the workspace row cannot be
      // deleted while challenge/receipt rows still reference it (onDelete:
      // Restrict), so teardown only disconnects.
      await db.$disconnect();
    });

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

    function payload(
      overrides: Partial<MemberWorkSignalPayload> = {},
    ): MemberWorkSignalPayload {
      return {
        kind: "progress",
        summary: "客户已确认还款意向",
        detail: "电话沟通 20 分钟,确认周五前处理。",
        relatedEvidenceRefs: [],
        ...overrides,
      };
    }

    async function issueAndDraft(
      objectRef: string,
      overrides: Partial<MemberWorkSignalPayload> = {},
      ttlMs = 60_000,
    ) {
      const draft: MemberWorkSignalDraft = {
        principal: principal(),
        objectRef,
        objectVersion: 1,
        payload: payload(overrides),
      };
      const challenge = await issueMemberWorkSignalChallenge({
        draft,
        ttlMs,
      });
      return { draft, challenge };
    }

    it("issues a challenge and records a receipt on submit", async () => {
      const objectRef = `case-${suffix}-1`;
      const { draft, challenge } = await issueAndDraft(objectRef);
      const receiptId = `receipt-${suffix}-1`;

      const result = await submitMemberWorkSignal({
        principal: draft.principal,
        challengeRef: challenge.challengeRef,
        payload: draft.payload,
        surface: ALLOWED_SURFACE,
        evidenceSurfaces: new Map(),
        policyRef: POLICY_REF,
        policyVersion: POLICY_VERSION,
        receiptId,
      });

      expect(result.outcome).toBe("recorded");
      expect(result.receipt.receiptId).toBe(receiptId);
      expect(result.receipt.candidate).toBe(true);
      expect(result.receipt.taint).toBe("untrusted");

      const challengeRow =
        await db.memberWorkSignalChallenge.findUniqueOrThrow({
          where: { id: challenge.challengeRef },
        });
      expect(challengeRow.consumedAt).not.toBeNull();
      expect(challengeRow.consumptionReceiptRef).toBe(receiptId);

      const fetched = await getMemberWorkSignalReceipt(
        workspaceId,
        receiptId,
      );
      expect(fetched).not.toBeNull();
      expect(fetched?.payloadHash).toBe(result.receipt.payloadHash);
    });

    it("rejects a second submission against an already-consumed challenge", async () => {
      const objectRef = `case-${suffix}-2`;
      const { draft, challenge } = await issueAndDraft(objectRef);

      await submitMemberWorkSignal({
        principal: draft.principal,
        challengeRef: challenge.challengeRef,
        payload: draft.payload,
        surface: ALLOWED_SURFACE,
        evidenceSurfaces: new Map(),
        policyRef: POLICY_REF,
        policyVersion: POLICY_VERSION,
        receiptId: `receipt-${suffix}-2a`,
      });

      await expectStoreError(
        submitMemberWorkSignal({
          principal: draft.principal,
          challengeRef: challenge.challengeRef,
          payload: draft.payload,
          surface: ALLOWED_SURFACE,
          evidenceSurfaces: new Map(),
          policyRef: POLICY_REF,
          policyVersion: POLICY_VERSION,
          receiptId: `receipt-${suffix}-2b`,
        }),
        "challenge_already_consumed",
      );
    });

    it("replays an identical resubmission of the same receiptId and payload", async () => {
      const objectRef = `case-${suffix}-3`;
      const { draft, challenge } = await issueAndDraft(objectRef);
      const receiptId = `receipt-${suffix}-3`;
      const submitInput = {
        principal: draft.principal,
        challengeRef: challenge.challengeRef,
        payload: draft.payload,
        surface: ALLOWED_SURFACE,
        evidenceSurfaces: new Map<string, MemberReadSurfaceDecision>(),
        policyRef: POLICY_REF,
        policyVersion: POLICY_VERSION,
        receiptId,
      };

      const first = await submitMemberWorkSignal(submitInput);
      expect(first.outcome).toBe("recorded");

      const second = await submitMemberWorkSignal(submitInput);
      expect(second.outcome).toBe("replayed");
      expect(second.receipt.receiptId).toBe(first.receipt.receiptId);
      expect(second.receipt.payloadHash).toBe(first.receipt.payloadHash);
    });

    it("rejects a replay attempt by a different member", async () => {
      const objectRef = `case-${suffix}-3b`;
      const { draft, challenge } = await issueAndDraft(objectRef);
      const receiptId = `receipt-${suffix}-3b`;

      const recorded = await submitMemberWorkSignal({
        principal: draft.principal,
        challengeRef: challenge.challengeRef,
        payload: draft.payload,
        surface: ALLOWED_SURFACE,
        evidenceSurfaces: new Map(),
        policyRef: POLICY_REF,
        policyVersion: POLICY_VERSION,
        receiptId,
      });
      expect(recorded.outcome).toBe("recorded");

      const otherMemberPrincipal = principal({
        memberRef: `member-${suffix}-other`,
        sessionRef: `session-${suffix}-other`,
        deviceRegistrationRef: `device-${suffix}-other`,
      });

      await expectStoreError(
        submitMemberWorkSignal({
          principal: otherMemberPrincipal,
          challengeRef: challenge.challengeRef,
          payload: draft.payload,
          surface: ALLOWED_SURFACE,
          evidenceSurfaces: new Map(),
          policyRef: POLICY_REF,
          policyVersion: POLICY_VERSION,
          receiptId,
        }),
        "challenge_binding_mismatch",
      );
    });

    it("rejects submission against an expired challenge", async () => {
      const objectRef = `case-${suffix}-4`;
      const { draft, challenge } = await issueAndDraft(objectRef);

      // MemberWorkSignalChallenge carries no append-only trigger; push
      // expiresAt to just after issuedAt (still satisfying the
      // MWSignalChallenge_window_check CHECK constraint) so it is already
      // in the past by the time submit runs.
      await db.$executeRaw`
        UPDATE MemberWorkSignalChallenge
        SET expiresAt = DATE_ADD(issuedAt, INTERVAL 1000 MICROSECOND)
        WHERE id = ${challenge.challengeRef} AND workspaceId = ${workspaceId}
      `;

      await expectStoreError(
        submitMemberWorkSignal({
          principal: draft.principal,
          challengeRef: challenge.challengeRef,
          payload: draft.payload,
          surface: ALLOWED_SURFACE,
          evidenceSurfaces: new Map(),
          policyRef: POLICY_REF,
          policyVersion: POLICY_VERSION,
          receiptId: `receipt-${suffix}-4`,
        }),
        "challenge_expired",
      );
    });

    it("rejects a submission whose payload has drifted from the challenge hash", async () => {
      const objectRef = `case-${suffix}-5`;
      const { draft, challenge } = await issueAndDraft(objectRef);

      await expectStoreError(
        submitMemberWorkSignal({
          principal: draft.principal,
          challengeRef: challenge.challengeRef,
          payload: payload({
            summary: "漂移后的摘要,与挑战哈希不再一致",
          }),
          surface: ALLOWED_SURFACE,
          evidenceSurfaces: new Map(),
          policyRef: POLICY_REF,
          policyVersion: POLICY_VERSION,
          receiptId: `receipt-${suffix}-5`,
        }),
        "challenge_payload_hash_mismatch",
      );
    });

    it("rejects related evidence refs that are missing or not authorized", async () => {
      const objectRef = `case-${suffix}-6`;
      const evidenceRef = `evidence-${suffix}-6`;
      const { draft, challenge } = await issueAndDraft(objectRef, {
        relatedEvidenceRefs: [evidenceRef],
      });

      await expectStoreError(
        submitMemberWorkSignal({
          principal: draft.principal,
          challengeRef: challenge.challengeRef,
          payload: draft.payload,
          surface: ALLOWED_SURFACE,
          evidenceSurfaces: new Map(),
          policyRef: POLICY_REF,
          policyVersion: POLICY_VERSION,
          receiptId: `receipt-${suffix}-6a`,
        }),
        `evidence_ref_not_authorized:${evidenceRef}`,
      );

      const { draft: draft2, challenge: challenge2 } = await issueAndDraft(
        objectRef,
        { relatedEvidenceRefs: [evidenceRef] },
      );
      await expectStoreError(
        submitMemberWorkSignal({
          principal: draft2.principal,
          challengeRef: challenge2.challengeRef,
          payload: draft2.payload,
          surface: ALLOWED_SURFACE,
          evidenceSurfaces: new Map([
            [
              evidenceRef,
              {
                allowed: false,
                deniedDimensions: ["tool_scope"],
              } as MemberReadSurfaceDecision,
            ],
          ]),
          policyRef: POLICY_REF,
          policyVersion: POLICY_VERSION,
          receiptId: `receipt-${suffix}-6b`,
        }),
        `evidence_ref_not_authorized:${evidenceRef}`,
      );
    });

    it("supersedes a prior receipt once and rejects a second supersede of the same prior", async () => {
      const objectRef = `case-${suffix}-7`;
      const { draft: draft1, challenge: challenge1 } =
        await issueAndDraft(objectRef);
      const priorReceiptId = `receipt-${suffix}-7-prior`;
      const prior = await submitMemberWorkSignal({
        principal: draft1.principal,
        challengeRef: challenge1.challengeRef,
        payload: draft1.payload,
        surface: ALLOWED_SURFACE,
        evidenceSurfaces: new Map(),
        policyRef: POLICY_REF,
        policyVersion: POLICY_VERSION,
        receiptId: priorReceiptId,
      });

      const { draft: draft2, challenge: challenge2 } = await issueAndDraft(
        objectRef,
        { summary: "更正:客户已还清欠款" },
      );
      const correctionReceiptId = `receipt-${suffix}-7-correction`;
      const correction = await submitMemberWorkSignal({
        principal: draft2.principal,
        challengeRef: challenge2.challengeRef,
        payload: draft2.payload,
        surface: ALLOWED_SURFACE,
        evidenceSurfaces: new Map(),
        policyRef: POLICY_REF,
        policyVersion: POLICY_VERSION,
        receiptId: correctionReceiptId,
        supersedesReceiptRef: prior.receipt.receiptId,
      });
      expect(correction.receipt.supersedesReceiptRef).toBe(priorReceiptId);

      const { draft: draft3, challenge: challenge3 } = await issueAndDraft(
        objectRef,
        { summary: "第二次更正尝试,应被拒绝" },
      );
      await expectStoreError(
        submitMemberWorkSignal({
          principal: draft3.principal,
          challengeRef: challenge3.challengeRef,
          payload: draft3.payload,
          surface: ALLOWED_SURFACE,
          evidenceSurfaces: new Map(),
          policyRef: POLICY_REF,
          policyVersion: POLICY_VERSION,
          receiptId: `receipt-${suffix}-7-second-correction`,
          supersedesReceiptRef: prior.receipt.receiptId,
        }),
        "receipt_already_superseded",
      );
    });

    it("blocks direct UPDATE and DELETE against a receipt row at the database boundary", async () => {
      const objectRef = `case-${suffix}-8`;
      const { draft, challenge } = await issueAndDraft(objectRef);
      const receiptId = `receipt-${suffix}-8`;

      const recorded = await submitMemberWorkSignal({
        principal: draft.principal,
        challengeRef: challenge.challengeRef,
        payload: draft.payload,
        surface: ALLOWED_SURFACE,
        evidenceSurfaces: new Map(),
        policyRef: POLICY_REF,
        policyVersion: POLICY_VERSION,
        receiptId,
      });
      expect(recorded.outcome).toBe("recorded");

      await expect(
        db.$executeRaw`
          UPDATE MemberWorkSignalReceipt
          SET policyVersion = 2
          WHERE id = ${receiptId}
        `,
      ).rejects.toThrow(/append-only/u);

      await expect(
        db.$executeRaw`
          DELETE FROM MemberWorkSignalReceipt
          WHERE id = ${receiptId}
        `,
      ).rejects.toThrow(/append-only/u);

      const persisted = await db.memberWorkSignalReceipt.findUniqueOrThrow({
        where: { id: receiptId },
        select: { policyVersion: true },
      });
      expect(persisted.policyVersion).toBe(POLICY_VERSION);
    });

    it("rejects issuing a challenge whose ttl exceeds the five-minute cap", async () => {
      expect(MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS).toBe(5 * 60_000);
      const draft: MemberWorkSignalDraft = {
        principal: principal(),
        objectRef: `case-${suffix}-9`,
        objectVersion: 1,
        payload: payload(),
      };

      await expectStoreError(
        issueMemberWorkSignalChallenge({ draft, ttlMs: 6 * 60_000 }),
        "challenge_ttl_exceeds_cap",
      );
    });
  },
);
