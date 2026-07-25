import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  computeContextAgentScopeHash,
  type ContextAgentScope,
} from "./context-agent-contracts";
import {
  getContextAgentParticipationStatus,
  inviteContextAgentParticipation,
  pauseContextAgentParticipation,
  recordContextAgentCollection,
  recordContextAgentConsent,
  recordContextAgentDeletionOutcome,
  resumeContextAgentParticipation,
  reviseContextAgentScope,
  revokeContextAgentConsent,
} from "./context-agent-store.service";

const integrationDatabaseUrl = process.env.CONTEXT_AGENT_STORE_DATABASE_URL;
const confirmedIntegrationDatabaseName =
  process.env.CONTEXT_AGENT_STORE_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_p1e_";
const DIGEST = `sha256:${"d".repeat(64)}`;

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal CONTEXT_AGENT_STORE_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  } catch {
    throw new Error(
      "CONTEXT_AGENT_STORE_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== confirmedIntegrationDatabaseName
  ) {
    throw new Error(
      "Refusing Context Agent integration test: confirm the isolated database name with CONTEXT_AGENT_STORE_TEST_DATABASE_NAME and use the helm_caio_p1e_ prefix.",
    );
  }
}

function scope(
  overrides: Partial<ContextAgentScope> = {},
): ContextAgentScope {
  return {
    deviceRefs: [`device:laptop-${suffix}`],
    directoryRefs: ["dir:projects", "dir:notes"],
    enterpriseAppRefs: ["app:crm"],
    purposes: ["company_memory_candidates"],
    ...overrides,
  };
}

function zeroCounts() {
  return {
    indicesDeleted: 0,
    cachesDeleted: 0,
    derivedVectorsDeleted: 0,
    memoryCandidatesDeleted: 0,
    observedFactsDeleted: 0,
    observedFactsEvidenceInvalidated: 0,
    multiSourceRecomputed: 0,
  };
}

describeMysql(
  "Context Agent consent chain with an isolated MySQL database",
  () => {
    let workspaceId = "";
    let otherWorkspaceId = "";
    let ownerUserId = "";
    let otherOwnerUserId = "";
    let employeeUserId = "";
    let baseAt = new Date(0);
    let consentReceiptId = "";
    let effectiveScopeHash = "";
    let revocationReceiptId = "";

    function at(offsetMs: number): Date {
      return new Date(baseAt.getTime() + offsetMs);
    }

    async function collect(input: {
      label: string;
      scopeHash: string;
      offsetMs: number;
      consentId?: string;
      actorUserId?: string;
      workspaceIdOverride?: string;
    }) {
      return recordContextAgentCollection({
        workspaceId: input.workspaceIdOverride ?? workspaceId,
        actorUserId: input.actorUserId ?? ownerUserId,
        consentReceiptId: input.consentId ?? consentReceiptId,
        collectionKind: "local_snapshot",
        consentScopeHash: input.scopeHash,
        itemCount: 2,
        digestHashes: [DIGEST],
        evidenceRefs: [`evidence:collection:${input.label}:${suffix}`],
        collectedAt: at(input.offsetMs - 1_000),
        idempotencyKey: `collection-${input.label}-${suffix}`,
        now: at(input.offsetMs),
      });
    }

    beforeAll(async () => {
      assertIsolatedDatabaseTarget();
      baseAt = new Date(Math.floor(Date.now() / 1_000) * 1_000);
      const workspace = await db.workspace.create({
        data: {
          name: `Context Agent integration ${suffix}`,
          slug: `context-agent-p1e-${suffix}`,
        },
      });
      const otherWorkspace = await db.workspace.create({
        data: {
          name: `Context Agent isolation ${suffix}`,
          slug: `context-agent-p1e-other-${suffix}`,
        },
      });
      workspaceId = workspace.id;
      otherWorkspaceId = otherWorkspace.id;
      const [owner, otherOwner, employee] = await Promise.all([
        db.user.create({
          data: {
            name: "Context Agent Owner",
            email: `context-agent-owner-${suffix}@example.test`,
          },
        }),
        db.user.create({
          data: {
            name: "Context Agent Other Owner",
            email: `context-agent-other-owner-${suffix}@example.test`,
          },
        }),
        db.user.create({
          data: {
            name: "Context Agent Employee",
            email: `context-agent-employee-${suffix}@example.test`,
          },
        }),
      ]);
      ownerUserId = owner.id;
      otherOwnerUserId = otherOwner.id;
      employeeUserId = employee.id;
      await db.membership.createMany({
        data: [
          {
            workspaceId,
            userId: ownerUserId,
            role: WorkspaceRole.OWNER,
            status: MembershipStatus.ACTIVE,
          },
          {
            workspaceId,
            userId: employeeUserId,
            role: WorkspaceRole.MEMBER,
            status: MembershipStatus.ACTIVE,
          },
          {
            workspaceId: otherWorkspaceId,
            userId: otherOwnerUserId,
            role: WorkspaceRole.OWNER,
            status: MembershipStatus.ACTIVE,
          },
        ],
      });
    }, 120_000);

    afterAll(async () => {
      await db.$disconnect();
    });

    it("defaults to not participating and refuses collection without consent", async () => {
      const status = await getContextAgentParticipationStatus({
        workspaceId,
        actorUserId: employeeUserId,
        memberUserId: employeeUserId,
      });
      expect(status.participationStatus).toBe("not_participating");
      await expect(
        collect({
          label: "no-consent",
          scopeHash: computeContextAgentScopeHash(scope()),
          offsetMs: 1_000,
          consentId: "missing-consent",
        }),
      ).rejects.toThrow("consent_not_found");
    });

    it("invites, refuses admin proxy consent, and accepts self-consent", async () => {
      const { invitation } = await inviteContextAgentParticipation({
        workspaceId,
        actorUserId: ownerUserId,
        memberUserId: employeeUserId,
        scope: scope(),
        evidenceRefs: [`evidence:invite:${suffix}`],
        idempotencyKey: `invite-1-${suffix}`,
        now: at(2_000),
      });
      await expect(
        recordContextAgentConsent({
          workspaceId,
          actorUserId: ownerUserId,
          invitationId: invitation.invitationId,
          evidenceRefs: [`evidence:consent-ui:${suffix}`],
          idempotencyKey: `consent-proxy-${suffix}`,
          now: at(3_000),
        }),
      ).rejects.toThrow("context_agent_self_consent_required");
      const { receipt, replayed } = await recordContextAgentConsent({
        workspaceId,
        actorUserId: employeeUserId,
        invitationId: invitation.invitationId,
        evidenceRefs: [`evidence:consent-ui:${suffix}`],
        idempotencyKey: `consent-1-${suffix}`,
        now: at(4_000),
      });
      expect(replayed).toBe(false);
      expect(receipt.consentVersion).toBe(1);
      expect(receipt.performanceInputProhibited).toBe(true);
      consentReceiptId = receipt.receiptId;
      effectiveScopeHash = receipt.scopeHash;
      const replay = await recordContextAgentConsent({
        workspaceId,
        actorUserId: employeeUserId,
        invitationId: invitation.invitationId,
        evidenceRefs: [`evidence:consent-ui:${suffix}`],
        idempotencyKey: `consent-1-${suffix}`,
        now: at(5_000),
      });
      expect(replay.replayed).toBe(true);
      expect(replay.receipt.receiptId).toBe(consentReceiptId);
    });

    it("records collection only against the live effective scope hash", async () => {
      const { receipt } = await collect({
        label: "first",
        scopeHash: effectiveScopeHash,
        offsetMs: 6_000,
      });
      expect(receipt.consentRef).toBe(consentReceiptId);
      expect(receipt.performanceInputProhibited).toBe(true);
      const auditRows = await db.auditLog.count({
        where: {
          workspaceId,
          actionType: "CONTEXT_AGENT_COLLECTION_RECORDED",
          targetId: receipt.receiptId,
        },
      });
      expect(auditRows).toBe(1);
    });

    it("refuses an idempotent replay whose payload diverges (reviewer probe)", async () => {
      // Same idempotency key as the "first" collection, different
      // itemCount: silently returning the old receipt would fork the
      // governance evidence from the caller's belief.
      await expect(
        recordContextAgentCollection({
          workspaceId,
          actorUserId: ownerUserId,
          consentReceiptId,
          collectionKind: "local_snapshot",
          consentScopeHash: effectiveScopeHash,
          itemCount: 99,
          digestHashes: [DIGEST],
          evidenceRefs: [`evidence:collection:first:${suffix}`],
          collectedAt: at(5_000),
          idempotencyKey: `collection-first-${suffix}`,
          now: at(6_500),
        }),
      ).rejects.toThrow("idempotency_key_payload_conflict");
      // Identical payload still replays cleanly.
      const replay = await collect({
        label: "first",
        scopeHash: effectiveScopeHash,
        offsetMs: 6_000,
      });
      expect(replay.replayed).toBe(true);
    });

    it("refuses widening, applies narrowing, and rebinds the scope hash", async () => {
      await expect(
        reviseContextAgentScope({
          workspaceId,
          actorUserId: employeeUserId,
          consentReceiptId,
          newScope: scope({
            enterpriseAppRefs: ["app:crm", "app:mail"],
          }),
          idempotencyKey: `revision-widen-${suffix}`,
          now: at(7_000),
        }),
      ).rejects.toThrow("scope_expansion_requires_new_consent");
      await expect(
        reviseContextAgentScope({
          workspaceId,
          actorUserId: ownerUserId,
          consentReceiptId,
          newScope: scope({ directoryRefs: ["dir:projects"] }),
          idempotencyKey: `revision-proxy-${suffix}`,
          now: at(7_500),
        }),
      ).rejects.toThrow("context_agent_self_scope_revision_required");
      const narrowed = scope({ directoryRefs: ["dir:projects"] });
      const { revision } = await reviseContextAgentScope({
        workspaceId,
        actorUserId: employeeUserId,
        consentReceiptId,
        newScope: narrowed,
        idempotencyKey: `revision-narrow-${suffix}`,
        now: at(8_000),
      });
      expect(revision.revisionKind).toBe("narrowing");
      await expect(
        collect({
          label: "stale-hash",
          scopeHash: effectiveScopeHash,
          offsetMs: 9_000,
        }),
      ).rejects.toThrow("collection_scope_hash_stale");
      effectiveScopeHash = revision.newScopeHash;
      const { receipt } = await collect({
        label: "narrowed",
        scopeHash: effectiveScopeHash,
        offsetMs: 10_000,
      });
      expect(receipt.consentScopeHash).toBe(effectiveScopeHash);
    });

    it("pause blocks collection immediately; only the employee resumes", async () => {
      await pauseContextAgentParticipation({
        workspaceId,
        actorUserId: ownerUserId,
        consentReceiptId,
        reasonCodes: ["admin_protective_pause"],
        idempotencyKey: `pause-1-${suffix}`,
        now: at(11_000),
      });
      await expect(
        collect({
          label: "while-paused",
          scopeHash: effectiveScopeHash,
          offsetMs: 12_000,
        }),
      ).rejects.toThrow("collection_requires_active_consent");
      await expect(
        resumeContextAgentParticipation({
          workspaceId,
          actorUserId: ownerUserId,
          consentReceiptId,
          reasonCodes: ["admin_attempt"],
          idempotencyKey: `resume-admin-${suffix}`,
          now: at(13_000),
        }),
      ).rejects.toThrow("context_agent_self_resume_required");
      await resumeContextAgentParticipation({
        workspaceId,
        actorUserId: employeeUserId,
        consentReceiptId,
        reasonCodes: ["member_back"],
        idempotencyKey: `resume-1-${suffix}`,
        now: at(14_000),
      });
      const { receipt } = await collect({
        label: "after-resume",
        scopeHash: effectiveScopeHash,
        offsetMs: 15_000,
      });
      expect(receipt.consentRef).toBe(consentReceiptId);
    });

    it("keeps other workspaces fully isolated", async () => {
      await expect(
        revokeContextAgentConsent({
          workspaceId: otherWorkspaceId,
          actorUserId: otherOwnerUserId,
          consentReceiptId,
          reasonCodes: ["cross_workspace_attempt"],
          evidenceRefs: [`evidence:cross:${suffix}`],
          idempotencyKey: `revoke-cross-${suffix}`,
          now: at(16_000),
        }),
      ).rejects.toThrow("consent_not_found");
      await expect(
        inviteContextAgentParticipation({
          workspaceId: otherWorkspaceId,
          actorUserId: otherOwnerUserId,
          memberUserId: employeeUserId,
          scope: scope(),
          evidenceRefs: [`evidence:cross-invite:${suffix}`],
          idempotencyKey: `invite-cross-${suffix}`,
          now: at(17_000),
        }),
      ).rejects.toThrow("invited_member_active_membership_required");
      await expect(
        collect({
          label: "cross-workspace",
          scopeHash: effectiveScopeHash,
          offsetMs: 18_000,
          actorUserId: otherOwnerUserId,
          workspaceIdOverride: otherWorkspaceId,
        }),
      ).rejects.toThrow("consent_not_found");
    });

    it("serializes concurrent pause attempts to exactly one winner", async () => {
      const results = await Promise.allSettled([
        pauseContextAgentParticipation({
          workspaceId,
          actorUserId: employeeUserId,
          consentReceiptId,
          reasonCodes: ["race_member"],
          idempotencyKey: `pause-race-a-${suffix}`,
          now: at(19_000),
        }),
        pauseContextAgentParticipation({
          workspaceId,
          actorUserId: ownerUserId,
          consentReceiptId,
          reasonCodes: ["race_admin"],
          idempotencyKey: `pause-race-b-${suffix}`,
          now: at(19_000),
        }),
      ]);
      const fulfilled = results.filter(
        (result) => result.status === "fulfilled",
      );
      expect(fulfilled).toHaveLength(1);
      const consentRow = await db.contextAgentConsentReceipt.findUnique({
        where: { id: consentReceiptId },
        select: { participationStatus: true },
      });
      expect(consentRow?.participationStatus).toBe("PAUSED");
      await resumeContextAgentParticipation({
        workspaceId,
        actorUserId: employeeUserId,
        consentReceiptId,
        reasonCodes: ["member_back_after_race"],
        idempotencyKey: `resume-2-${suffix}`,
        now: at(20_000),
      });
    });

    it("revokes terminally and opens the deletion work item", async () => {
      const { receipt } = await revokeContextAgentConsent({
        workspaceId,
        actorUserId: employeeUserId,
        consentReceiptId,
        reasonCodes: ["member_revoked"],
        evidenceRefs: [`evidence:revocation:${suffix}`],
        idempotencyKey: `revoke-1-${suffix}`,
        now: at(21_000),
      });
      revocationReceiptId = receipt.receiptId;
      expect(receipt.deletionWorkItemRef).toMatch(
        /^context-agent-deletion-work:/,
      );
      await expect(
        collect({
          label: "after-revoke",
          scopeHash: effectiveScopeHash,
          offsetMs: 22_000,
        }),
      ).rejects.toThrow("collection_requires_active_consent");
      await expect(
        resumeContextAgentParticipation({
          workspaceId,
          actorUserId: employeeUserId,
          consentReceiptId,
          reasonCodes: ["member_back"],
          idempotencyKey: `resume-after-revoke-${suffix}`,
          now: at(23_000),
        }),
      ).rejects.toThrow("resume_requires_paused_consent");
      await expect(
        reviseContextAgentScope({
          workspaceId,
          actorUserId: employeeUserId,
          consentReceiptId,
          newScope: scope({ directoryRefs: [] }),
          idempotencyKey: `revision-after-revoke-${suffix}`,
          now: at(24_000),
        }),
      ).rejects.toThrow("scope_revision_requires_live_consent");
      const status = await getContextAgentParticipationStatus({
        workspaceId,
        actorUserId: employeeUserId,
        memberUserId: employeeUserId,
      });
      expect(status.participationStatus).toBe("revoked");
      expect(status.openDeletionWorkItemRef).toBe(
        receipt.deletionWorkItemRef,
      );
    });

    it("records deletion outcomes with structured counts until success closes the item", async () => {
      const partial = await recordContextAgentDeletionOutcome({
        workspaceId,
        actorUserId: ownerUserId,
        revocationReceiptId,
        outcome: "partial",
        counts: {
          ...zeroCounts(),
          indicesDeleted: 4,
          cachesDeleted: 2,
          memoryCandidatesDeleted: 1,
        },
        failureCodes: ["vector_store_timeout"],
        evidenceRefs: [`evidence:deletion-partial:${suffix}`],
        idempotencyKey: `deletion-partial-${suffix}`,
        now: at(25_000),
      });
      expect(partial.receipt.attempt).toBe(1);
      // Reviewer probe: same idempotency key, divergent counts — the
      // deletion executor claiming "999 deleted" must not be silently
      // answered with the old attempt's receipt.
      await expect(
        recordContextAgentDeletionOutcome({
          workspaceId,
          actorUserId: ownerUserId,
          revocationReceiptId,
          outcome: "partial",
          counts: {
            ...zeroCounts(),
            indicesDeleted: 999,
            cachesDeleted: 999,
          },
          failureCodes: ["totally_different_failure"],
          evidenceRefs: [`evidence:deletion-partial:${suffix}`],
          idempotencyKey: `deletion-partial-${suffix}`,
          now: at(25_500),
        }),
      ).rejects.toThrow("idempotency_key_payload_conflict");
      const success = await recordContextAgentDeletionOutcome({
        workspaceId,
        actorUserId: ownerUserId,
        revocationReceiptId,
        outcome: "success",
        counts: {
          ...zeroCounts(),
          derivedVectorsDeleted: 7,
          observedFactsDeleted: 2,
          observedFactsEvidenceInvalidated: 3,
          multiSourceRecomputed: 5,
        },
        failureCodes: [],
        evidenceRefs: [`evidence:deletion-success:${suffix}`],
        idempotencyKey: `deletion-success-${suffix}`,
        now: at(26_000),
      });
      expect(success.receipt.attempt).toBe(2);
      await expect(
        recordContextAgentDeletionOutcome({
          workspaceId,
          actorUserId: ownerUserId,
          revocationReceiptId,
          outcome: "success",
          counts: zeroCounts(),
          failureCodes: [],
          evidenceRefs: [`evidence:deletion-extra:${suffix}`],
          idempotencyKey: `deletion-extra-${suffix}`,
          now: at(27_000),
        }),
      ).rejects.toThrow("deletion_already_succeeded");
      const status = await getContextAgentParticipationStatus({
        workspaceId,
        actorUserId: ownerUserId,
        memberUserId: employeeUserId,
      });
      expect(status.participationStatus).toBe("revoked");
      expect(status.openDeletionWorkItemRef).toBeNull();
    });

    it("re-participation needs a fresh invitation and self-consent (version 2)", async () => {
      const { invitation } = await inviteContextAgentParticipation({
        workspaceId,
        actorUserId: ownerUserId,
        memberUserId: employeeUserId,
        scope: scope({
          enterpriseAppRefs: ["app:crm", "app:mail"],
        }),
        evidenceRefs: [`evidence:invite-2:${suffix}`],
        idempotencyKey: `invite-2-${suffix}`,
        now: at(28_000),
      });
      const { receipt } = await recordContextAgentConsent({
        workspaceId,
        actorUserId: employeeUserId,
        invitationId: invitation.invitationId,
        evidenceRefs: [`evidence:consent-ui-2:${suffix}`],
        idempotencyKey: `consent-2-${suffix}`,
        now: at(29_000),
      });
      expect(receipt.consentVersion).toBe(2);
      expect(receipt.previousConsentRef).toBe(consentReceiptId);
      // The wider scope is valid because it is a fresh consent bound to the
      // new scope hash, not a revision of the revoked one.
      expect(receipt.scopeHash).toBe(
        computeContextAgentScopeHash(
          scope({ enterpriseAppRefs: ["app:crm", "app:mail"] }),
        ),
      );
      const { receipt: collection } = await collect({
        label: "v2",
        scopeHash: receipt.scopeHash,
        offsetMs: 30_000,
        consentId: receipt.receiptId,
      });
      expect(collection.consentRef).toBe(receipt.receiptId);
      const auditActions = await db.auditLog.groupBy({
        by: ["actionType"],
        where: {
          workspaceId,
          actionType: { startsWith: "CONTEXT_AGENT_" },
        },
      });
      expect(
        auditActions.map((row) => row.actionType).sort(),
      ).toEqual([
        "CONTEXT_AGENT_COLLECTION_RECORDED",
        "CONTEXT_AGENT_CONSENT_RECORDED",
        "CONTEXT_AGENT_CONSENT_REVOKED",
        "CONTEXT_AGENT_DELETION_OUTCOME_RECORDED",
        "CONTEXT_AGENT_INVITED",
        "CONTEXT_AGENT_PAUSED",
        "CONTEXT_AGENT_RESUMED",
        "CONTEXT_AGENT_SCOPE_NARROWED",
      ]);
    });
  },
);
