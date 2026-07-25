import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, auditMock, policyAccessMock, membershipDirectory } =
  vi.hoisted(() => {
    const client = {
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
      membership: { findUnique: vi.fn() },
      contextAgentInvitation: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      contextAgentConsentReceipt: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      contextAgentScopeRevision: {
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      contextAgentCollectionReceipt: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      contextAgentPauseReceipt: {
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      contextAgentRevocationReceipt: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      contextAgentDeletionReceipt: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
    };
    return {
      dbMock: client,
      auditMock: { writeAuditLog: vi.fn() },
      policyAccessMock: { assertWorkspacePolicyServiceAccess: vi.fn() },
      membershipDirectory: new Map<
        string,
        { role: string; status: string }
      >(),
    };
  });

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));
vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspacePolicyServiceAccess:
    policyAccessMock.assertWorkspacePolicyServiceAccess,
}));

import {
  computeContextAgentScopeHash,
  createContextAgentConsentReceipt,
  createContextAgentInvitation,
  createContextAgentRevocationReceipt,
  type ContextAgentConsentReceipt,
  type ContextAgentInvitation,
  type ContextAgentRevocationReceipt,
  type ContextAgentScope,
} from "./context-agent-contracts";
import {
  ContextAgentStoreError,
  inviteContextAgentParticipation,
  pauseContextAgentParticipation,
  recordContextAgentCollection,
  recordContextAgentConsent,
  recordContextAgentDeletionOutcome,
  resumeContextAgentParticipation,
  reviseContextAgentScope,
  revokeContextAgentConsent,
} from "./context-agent-store.service";

const NOW = new Date("2026-07-25T08:00:00.000Z");
const WORKSPACE_ID = "workspace-1";
const MEMBER_ID = "member-1";
const OWNER_ID = "owner-1";
const DIGEST = `sha256:${"d".repeat(64)}`;

function scope(
  overrides: Partial<ContextAgentScope> = {},
): ContextAgentScope {
  return {
    deviceRefs: ["device:laptop-1"],
    directoryRefs: ["dir:projects", "dir:notes"],
    enterpriseAppRefs: ["app:crm"],
    purposes: ["company_memory_candidates"],
    ...overrides,
  };
}

function invitation(memberUserRef = MEMBER_ID): ContextAgentInvitation {
  return createContextAgentInvitation({
    workspaceRef: `workspace:${WORKSPACE_ID}`,
    memberUserRef,
    invitedByUserRef: OWNER_ID,
    scope: scope(),
    evidenceRefs: ["evidence:invite:1"],
    idempotencyKey: "invite-1",
    recordedAt: NOW.toISOString(),
  });
}

function invitationRow(artifact: ContextAgentInvitation) {
  return {
    id: artifact.invitationId,
    workspaceId: WORKSPACE_ID,
    memberUserId: artifact.memberUserRef,
    invitedByUserId: artifact.invitedByUserRef,
    scopeJson: JSON.stringify(artifact.scope),
    scopeHash: artifact.scopeHash,
    status: "PENDING",
    idempotencyKey: artifact.idempotencyKey,
    evidenceRefs: JSON.stringify(artifact.evidenceRefs),
    invitationJson: JSON.stringify(artifact),
    contentHash: artifact.contentHash,
    recordedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function consent(memberUserRef = MEMBER_ID): ContextAgentConsentReceipt {
  return createContextAgentConsentReceipt({
    workspaceRef: `workspace:${WORKSPACE_ID}`,
    invitationRef: invitation(memberUserRef).invitationId,
    memberUserRef,
    actorUserRef: memberUserRef,
    consentVersion: 1,
    previousConsentRef: null,
    scope: scope(),
    evidenceRefs: ["evidence:consent-ui:1"],
    idempotencyKey: "consent-1",
    recordedAt: NOW.toISOString(),
  });
}

function consentRow(
  receipt: ContextAgentConsentReceipt,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: receipt.receiptId,
    workspaceId: WORKSPACE_ID,
    invitationId: receipt.invitationRef,
    memberUserId: receipt.memberUserRef,
    actorUserId: receipt.actorUserRef,
    consentVersion: receipt.consentVersion,
    previousConsentId: receipt.previousConsentRef,
    scopeJson: JSON.stringify(receipt.scope),
    scopeHash: receipt.scopeHash,
    effectiveScopeJson: JSON.stringify(receipt.scope),
    effectiveScopeHash: receipt.scopeHash,
    participationStatus: "ACTIVE",
    stateVersion: 1,
    performanceInputProhibited: true,
    idempotencyKey: receipt.idempotencyKey,
    evidenceRefs: JSON.stringify(receipt.evidenceRefs),
    receiptJson: JSON.stringify(receipt),
    contentHash: receipt.contentHash,
    recordedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function revocation(
  consentReceipt: ContextAgentConsentReceipt,
): ContextAgentRevocationReceipt {
  return createContextAgentRevocationReceipt({
    workspaceRef: `workspace:${WORKSPACE_ID}`,
    consentRef: consentReceipt.receiptId,
    memberUserRef: consentReceipt.memberUserRef,
    actorUserRef: consentReceipt.memberUserRef,
    consentScopeHash: consentReceipt.scopeHash,
    reasonCodes: ["member_revoked"],
    evidenceRefs: ["evidence:revocation:1"],
    idempotencyKey: "revoke-1",
    recordedAt: NOW.toISOString(),
  });
}

function revocationRow(receipt: ContextAgentRevocationReceipt) {
  return {
    id: receipt.receiptId,
    workspaceId: WORKSPACE_ID,
    consentReceiptId: receipt.consentRef,
    memberUserId: receipt.memberUserRef,
    actorUserId: receipt.actorUserRef,
    consentScopeHash: receipt.consentScopeHash,
    deletionWorkItemRef: receipt.deletionWorkItemRef,
    reasonCodes: JSON.stringify(receipt.reasonCodes),
    evidenceRefs: JSON.stringify(receipt.evidenceRefs),
    idempotencyKey: receipt.idempotencyKey,
    receiptJson: JSON.stringify(receipt),
    contentHash: receipt.contentHash,
    recordedAt: NOW,
    createdAt: NOW,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  membershipDirectory.clear();
  membershipDirectory.set(MEMBER_ID, { role: "MEMBER", status: "ACTIVE" });
  membershipDirectory.set(OWNER_ID, { role: "OWNER", status: "ACTIVE" });
  dbMock.$transaction.mockImplementation(
    async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
      callback(dbMock),
  );
  dbMock.$queryRaw.mockImplementation(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes("FROM Workspace")) {
        return values[0] === WORKSPACE_ID ? [{ id: WORKSPACE_ID }] : [];
      }
      if (sql.includes("FROM Membership")) {
        const membership = membershipDirectory.get(String(values[1]));
        return membership && values[0] === WORKSPACE_ID
          ? [membership]
          : [];
      }
      throw new Error("unexpected_query");
    },
  );
  policyAccessMock.assertWorkspacePolicyServiceAccess.mockResolvedValue(
    null,
  );
  auditMock.writeAuditLog.mockResolvedValue({});
  for (const model of [
    dbMock.contextAgentInvitation,
    dbMock.contextAgentConsentReceipt,
    dbMock.contextAgentScopeRevision,
    dbMock.contextAgentCollectionReceipt,
    dbMock.contextAgentPauseReceipt,
    dbMock.contextAgentRevocationReceipt,
    dbMock.contextAgentDeletionReceipt,
  ]) {
    for (const [name, fn] of Object.entries(model)) {
      if (name === "count") (fn as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      else if (name === "findMany")
        (fn as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      else if (name === "updateMany")
        (fn as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      else if (name === "create")
        (fn as ReturnType<typeof vi.fn>).mockResolvedValue({});
      else (fn as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    }
  }
});

describe("context agent store (mock layer)", () => {
  it("default not-participating: refuses collection with no consent row", async () => {
    await expect(
      recordContextAgentCollection({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_ID,
        consentReceiptId: "missing-consent",
        collectionKind: "local_snapshot",
        consentScopeHash: computeContextAgentScopeHash(scope()),
        itemCount: 1,
        digestHashes: [DIGEST],
        evidenceRefs: ["evidence:collection:1"],
        collectedAt: NOW,
        idempotencyKey: "collection-1",
        now: NOW,
      }),
    ).rejects.toThrow("consent_not_found");
    expect(dbMock.contextAgentCollectionReceipt.create).not.toHaveBeenCalled();
  });

  it("refuses admin/OWNER proxy consent on the server-side identity", async () => {
    const artifact = invitation(MEMBER_ID);
    dbMock.contextAgentInvitation.findFirst.mockResolvedValue(
      invitationRow(artifact),
    );
    await expect(
      recordContextAgentConsent({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_ID,
        invitationId: artifact.invitationId,
        evidenceRefs: ["evidence:consent-ui:1"],
        idempotencyKey: "consent-1",
        now: NOW,
      }),
    ).rejects.toThrow("context_agent_self_consent_required");
    expect(dbMock.contextAgentConsentReceipt.create).not.toHaveBeenCalled();
  });

  it("records self-consent, supersedes the previous live consent, and audits in-transaction", async () => {
    const artifact = invitation(MEMBER_ID);
    dbMock.contextAgentInvitation.findFirst.mockResolvedValue(
      invitationRow(artifact),
    );
    const previous = consent(MEMBER_ID);
    dbMock.contextAgentConsentReceipt.findFirst
      .mockResolvedValueOnce(consentRow(previous))
      .mockResolvedValueOnce({
        id: previous.receiptId,
        consentVersion: previous.consentVersion,
      });
    const { receipt, replayed } = await recordContextAgentConsent({
      workspaceId: WORKSPACE_ID,
      actorUserId: MEMBER_ID,
      invitationId: artifact.invitationId,
      evidenceRefs: ["evidence:consent-ui:2"],
      idempotencyKey: "consent-2",
      now: NOW,
    });
    expect(replayed).toBe(false);
    expect(receipt.consentVersion).toBe(2);
    expect(receipt.previousConsentRef).toBe(previous.receiptId);
    expect(receipt.performanceInputProhibited).toBe(true);
    const supersede =
      dbMock.contextAgentConsentReceipt.updateMany.mock.calls[0][0];
    expect(supersede.where).toMatchObject({
      id: previous.receiptId,
      participationStatus: "ACTIVE",
      stateVersion: 1,
    });
    expect(supersede.data.participationStatus).toBe("SUPERSEDED");
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "CONTEXT_AGENT_CONSENT_RECORDED",
      }),
      { client: dbMock },
    );
  });

  it("refuses a widening scope revision in the store", async () => {
    const live = consent(MEMBER_ID);
    dbMock.contextAgentConsentReceipt.findFirst.mockResolvedValue(
      consentRow(live),
    );
    await expect(
      reviseContextAgentScope({
        workspaceId: WORKSPACE_ID,
        actorUserId: MEMBER_ID,
        consentReceiptId: live.receiptId,
        newScope: scope({
          enterpriseAppRefs: ["app:crm", "app:mail"],
        }),
        idempotencyKey: "revision-1",
        now: NOW,
      }),
    ).rejects.toThrow("scope_expansion_requires_new_consent");
    expect(dbMock.contextAgentScopeRevision.create).not.toHaveBeenCalled();
  });

  it("blocks collection on a paused consent fail-closed at record time", async () => {
    const live = consent(MEMBER_ID);
    dbMock.contextAgentConsentReceipt.findFirst.mockResolvedValue(
      consentRow(live, { participationStatus: "PAUSED" }),
    );
    await expect(
      recordContextAgentCollection({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_ID,
        consentReceiptId: live.receiptId,
        collectionKind: "local_snapshot",
        consentScopeHash: live.scopeHash,
        itemCount: 1,
        digestHashes: [DIGEST],
        evidenceRefs: ["evidence:collection:1"],
        collectedAt: NOW,
        idempotencyKey: "collection-1",
        now: NOW,
      }),
    ).rejects.toThrow("collection_requires_active_consent");
    expect(dbMock.contextAgentCollectionReceipt.create).not.toHaveBeenCalled();
  });

  it("refuses collection bound to a stale scope hash", async () => {
    const live = consent(MEMBER_ID);
    const narrowed = scope({ directoryRefs: ["dir:projects"] });
    dbMock.contextAgentConsentReceipt.findFirst.mockResolvedValue(
      consentRow(live, {
        effectiveScopeJson: JSON.stringify(narrowed),
        effectiveScopeHash: computeContextAgentScopeHash(narrowed),
      }),
    );
    await expect(
      recordContextAgentCollection({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_ID,
        consentReceiptId: live.receiptId,
        collectionKind: "local_snapshot",
        consentScopeHash: live.scopeHash,
        itemCount: 1,
        digestHashes: [DIGEST],
        evidenceRefs: ["evidence:collection:1"],
        collectedAt: NOW,
        idempotencyKey: "collection-1",
        now: NOW,
      }),
    ).rejects.toThrow("collection_scope_hash_stale");
  });

  it("only the employee themself can resume; revoked consent cannot resume", async () => {
    const live = consent(MEMBER_ID);
    dbMock.contextAgentConsentReceipt.findFirst.mockResolvedValue(
      consentRow(live, { participationStatus: "PAUSED" }),
    );
    await expect(
      resumeContextAgentParticipation({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_ID,
        consentReceiptId: live.receiptId,
        reasonCodes: ["admin_attempt"],
        idempotencyKey: "resume-1",
        now: NOW,
      }),
    ).rejects.toThrow("context_agent_self_resume_required");
    dbMock.contextAgentConsentReceipt.findFirst.mockResolvedValue(
      consentRow(live, { participationStatus: "REVOKED" }),
    );
    await expect(
      resumeContextAgentParticipation({
        workspaceId: WORKSPACE_ID,
        actorUserId: MEMBER_ID,
        consentReceiptId: live.receiptId,
        reasonCodes: ["member_back"],
        idempotencyKey: "resume-2",
        now: NOW,
      }),
    ).rejects.toThrow("resume_requires_paused_consent");
  });

  it("revocation is terminal and derives the deletion work item", async () => {
    const live = consent(MEMBER_ID);
    dbMock.contextAgentConsentReceipt.findFirst.mockResolvedValue(
      consentRow(live),
    );
    const { receipt } = await revokeContextAgentConsent({
      workspaceId: WORKSPACE_ID,
      actorUserId: MEMBER_ID,
      consentReceiptId: live.receiptId,
      reasonCodes: ["member_revoked"],
      evidenceRefs: ["evidence:revocation:1"],
      idempotencyKey: "revoke-1",
      now: NOW,
    });
    expect(receipt.deletionWorkItemRef).toMatch(
      /^context-agent-deletion-work:/,
    );
    const transition =
      dbMock.contextAgentConsentReceipt.updateMany.mock.calls[0][0];
    expect(transition.data.participationStatus).toBe("REVOKED");
    dbMock.contextAgentConsentReceipt.findFirst.mockResolvedValue(
      consentRow(live, { participationStatus: "REVOKED" }),
    );
    await expect(
      revokeContextAgentConsent({
        workspaceId: WORKSPACE_ID,
        actorUserId: MEMBER_ID,
        consentReceiptId: live.receiptId,
        reasonCodes: ["again"],
        evidenceRefs: ["evidence:revocation:2"],
        idempotencyKey: "revoke-2",
        now: NOW,
      }),
    ).rejects.toThrow("revocation_requires_live_consent");
  });

  it("loses a CAS race deterministically instead of overwriting state", async () => {
    const live = consent(MEMBER_ID);
    dbMock.contextAgentConsentReceipt.findFirst.mockResolvedValue(
      consentRow(live),
    );
    dbMock.contextAgentConsentReceipt.updateMany.mockResolvedValue({
      count: 0,
    });
    await expect(
      pauseContextAgentParticipation({
        workspaceId: WORKSPACE_ID,
        actorUserId: MEMBER_ID,
        consentReceiptId: live.receiptId,
        reasonCodes: ["member_requested"],
        idempotencyKey: "pause-1",
        now: NOW,
      }),
    ).rejects.toThrow("consent_state_concurrent_update");
  });

  it("fails closed when the stored boundary literal was tampered with", async () => {
    const live = consent(MEMBER_ID);
    dbMock.contextAgentConsentReceipt.findFirst.mockResolvedValue(
      consentRow(live, { performanceInputProhibited: false }),
    );
    await expect(
      recordContextAgentCollection({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_ID,
        consentReceiptId: live.receiptId,
        collectionKind: "local_snapshot",
        consentScopeHash: live.scopeHash,
        itemCount: 1,
        digestHashes: [DIGEST],
        evidenceRefs: ["evidence:collection:1"],
        collectedAt: NOW,
        idempotencyKey: "collection-1",
        now: NOW,
      }),
    ).rejects.toThrow("stored_consent_binding_invalid");
  });

  it("propagates a same-transaction audit failure so the write cannot commit alone", async () => {
    const live = consent(MEMBER_ID);
    dbMock.contextAgentConsentReceipt.findFirst.mockResolvedValue(
      consentRow(live),
    );
    auditMock.writeAuditLog.mockRejectedValue(
      new Error("injected_audit_failure"),
    );
    await expect(
      revokeContextAgentConsent({
        workspaceId: WORKSPACE_ID,
        actorUserId: MEMBER_ID,
        consentReceiptId: live.receiptId,
        reasonCodes: ["member_revoked"],
        evidenceRefs: ["evidence:revocation:1"],
        idempotencyKey: "revoke-1",
        now: NOW,
      }),
    ).rejects.toThrow("injected_audit_failure");
  });

  it("refuses deletion attempts after a recorded success", async () => {
    const live = consent(MEMBER_ID);
    const revoked = revocation(live);
    dbMock.contextAgentRevocationReceipt.findFirst.mockResolvedValue(
      revocationRow(revoked),
    );
    dbMock.contextAgentDeletionReceipt.findMany.mockResolvedValue([
      { outcome: "SUCCESS" },
    ]);
    await expect(
      recordContextAgentDeletionOutcome({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_ID,
        revocationReceiptId: revoked.receiptId,
        outcome: "success",
        counts: {
          indicesDeleted: 0,
          cachesDeleted: 0,
          derivedVectorsDeleted: 0,
          memoryCandidatesDeleted: 0,
          observedFactsDeleted: 0,
          observedFactsEvidenceInvalidated: 0,
          multiSourceRecomputed: 0,
        },
        failureCodes: [],
        evidenceRefs: ["evidence:deletion:2"],
        idempotencyKey: "deletion-2",
        now: NOW,
      }),
    ).rejects.toThrow("deletion_already_succeeded");
  });

  it("refuses inviting a member without an ACTIVE membership", async () => {
    membershipDirectory.set(MEMBER_ID, {
      role: "MEMBER",
      status: "INACTIVE",
    });
    await expect(
      inviteContextAgentParticipation({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_ID,
        memberUserId: MEMBER_ID,
        scope: scope(),
        evidenceRefs: ["evidence:invite:1"],
        idempotencyKey: "invite-1",
        now: NOW,
      }),
    ).rejects.toThrow("invited_member_active_membership_required");
  });

  it("keeps store errors as stable codes", async () => {
    const error = new ContextAgentStoreError("consent_not_found");
    expect(error.name).toBe("ContextAgentStoreError");
    expect(error.message).toBe("consent_not_found");
  });
});
