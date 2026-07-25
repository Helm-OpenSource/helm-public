import { describe, expect, it } from "vitest";
import {
  classifyContextAgentScopeChange,
  computeContextAgentScopeHash,
  createContextAgentCollectionReceipt,
  createContextAgentConsentReceipt,
  createContextAgentDeletionReceipt,
  createContextAgentInvitation,
  createContextAgentPauseReceipt,
  createContextAgentRevocationReceipt,
  createContextAgentScopeRevision,
  normalizeContextAgentScope,
  validateContextAgentCollectionReceipt,
  validateContextAgentConsentReceipt,
  validateContextAgentDeletionReceipt,
  validateContextAgentPauseReceipt,
  validateContextAgentScope,
  validateContextAgentScopeRevision,
  type ContextAgentDeletionCounts,
  type ContextAgentScope,
} from "./context-agent-contracts";

const NOW = "2026-07-25T08:00:00.000Z";
const DIGEST = `sha256:${"d".repeat(64)}`;

function scope(overrides: Partial<ContextAgentScope> = {}): ContextAgentScope {
  return {
    deviceRefs: ["device:laptop-1"],
    directoryRefs: ["dir:projects", "dir:notes"],
    enterpriseAppRefs: ["app:crm"],
    purposes: ["company_memory_candidates"],
    ...overrides,
  };
}

function counts(
  overrides: Partial<ContextAgentDeletionCounts> = {},
): ContextAgentDeletionCounts {
  return {
    indicesDeleted: 3,
    cachesDeleted: 2,
    derivedVectorsDeleted: 5,
    memoryCandidatesDeleted: 1,
    observedFactsDeleted: 1,
    observedFactsEvidenceInvalidated: 2,
    multiSourceRecomputed: 4,
    ...overrides,
  };
}

function consentReceipt(memberUserRef = "member-1", actorUserRef = memberUserRef) {
  return createContextAgentConsentReceipt({
    workspaceRef: "workspace:workspace-1",
    invitationRef: "invitation-1",
    memberUserRef,
    actorUserRef,
    consentVersion: 1,
    previousConsentRef: null,
    scope: scope(),
    evidenceRefs: ["evidence:consent-ui:1"],
    idempotencyKey: "consent-1",
    recordedAt: NOW,
  });
}

describe("context agent scope contract", () => {
  it("normalizes deterministically and hashes stably", () => {
    const shuffled = scope({
      directoryRefs: ["dir:notes", "dir:projects", "dir:notes"],
    });
    expect(normalizeContextAgentScope(shuffled)).toEqual(
      normalizeContextAgentScope(scope()),
    );
    expect(computeContextAgentScopeHash(shuffled)).toBe(
      computeContextAgentScopeHash(scope()),
    );
  });

  it("refuses scopes without devices, purposes, or with non-ref values", () => {
    expect(
      validateContextAgentScope(scope({ deviceRefs: [] })).errors,
    ).toContain("context_agent_scope_device_required");
    expect(
      validateContextAgentScope(scope({ purposes: [] })).errors,
    ).toContain("context_agent_scope_purpose_invalid");
    expect(
      validateContextAgentScope(
        scope({
          purposes: ["performance_review" as never],
        }),
      ).errors,
    ).toContain("context_agent_scope_purpose_invalid");
    expect(
      validateContextAgentScope(
        scope({ directoryRefs: ["raw content with spaces"] }),
      ).errors,
    ).toContain("context_agent_scope_ref_invalid");
  });

  it("classifies narrowing, expansion, and mixed changes fail-closed", () => {
    const base = scope();
    expect(
      classifyContextAgentScopeChange(base, scope({ directoryRefs: ["dir:projects"] })),
    ).toBe("narrowing");
    expect(
      classifyContextAgentScopeChange(
        base,
        scope({ enterpriseAppRefs: ["app:crm", "app:mail"] }),
      ),
    ).toBe("expansion");
    // Mixed narrowing + widening still widens one dimension: expansion.
    expect(
      classifyContextAgentScopeChange(
        base,
        scope({
          directoryRefs: [],
          enterpriseAppRefs: ["app:crm", "app:mail"],
        }),
      ),
    ).toBe("expansion");
    expect(classifyContextAgentScopeChange(base, scope())).toBe("unchanged");
  });
});

describe("context agent invitation + consent receipts", () => {
  it("creates a valid invitation bound to the scope hash", () => {
    const invitation = createContextAgentInvitation({
      workspaceRef: "workspace:workspace-1",
      memberUserRef: "member-1",
      invitedByUserRef: "admin-1",
      scope: scope(),
      evidenceRefs: ["evidence:invite:1"],
      idempotencyKey: "invite-1",
      recordedAt: NOW,
    });
    expect(invitation.scopeHash).toBe(computeContextAgentScopeHash(scope()));
    expect(invitation.authorityEffect).toBe("none");
  });

  it("refuses admin proxy consent at the contract layer", () => {
    expect(() => consentReceipt("member-1", "admin-1")).toThrow(
      "context_agent_self_consent_required",
    );
  });

  it("validates the frozen performance-input boundary exactly-true", () => {
    const receipt = consentReceipt();
    expect(receipt.performanceInputProhibited).toBe(true);
    expect(validateContextAgentConsentReceipt(receipt).valid).toBe(true);
    const tampered = {
      ...receipt,
      performanceInputProhibited: false as unknown as true,
    };
    expect(validateContextAgentConsentReceipt(tampered).errors).toContain(
      "context_agent_performance_input_boundary_invalid",
    );
    const detached = validateContextAgentConsentReceipt({
      ...receipt,
      actorUserRef: "admin-1",
    });
    expect(detached.errors).toContain("context_agent_self_consent_required");
  });

  it("detects content or scope hash tampering", () => {
    const receipt = consentReceipt();
    expect(
      validateContextAgentConsentReceipt({
        ...receipt,
        scopeHash: `sha256:${"0".repeat(64)}`,
      }).errors,
    ).toContain("context_agent_consent_scope_hash_mismatch");
    expect(
      validateContextAgentConsentReceipt({
        ...receipt,
        recordedAt: "2026-07-25T09:00:00.000Z",
      }).errors,
    ).toContain("context_agent_consent_content_hash_mismatch");
  });

  it("requires the previous-consent chain from version two onward", () => {
    expect(() =>
      createContextAgentConsentReceipt({
        workspaceRef: "workspace:workspace-1",
        invitationRef: "invitation-2",
        memberUserRef: "member-1",
        actorUserRef: "member-1",
        consentVersion: 2,
        previousConsentRef: null,
        scope: scope(),
        evidenceRefs: ["evidence:consent-ui:2"],
        idempotencyKey: "consent-2",
        recordedAt: NOW,
      }),
    ).toThrow("context_agent_consent_version_invalid");
  });
});

describe("context agent scope revision", () => {
  const revisionInput = {
    workspaceRef: "workspace:workspace-1",
    consentRef: "consent-1",
    memberUserRef: "member-1",
    actorUserRef: "member-1",
    sequence: 1,
    previousScope: scope(),
    idempotencyKey: "revision-1",
    recordedAt: NOW,
  };

  it("allows narrowing without re-consent and pins both scope hashes", () => {
    const revision = createContextAgentScopeRevision({
      ...revisionInput,
      newScope: scope({ directoryRefs: ["dir:projects"] }),
    });
    expect(revision.revisionKind).toBe("narrowing");
    expect(validateContextAgentScopeRevision(revision).valid).toBe(true);
    expect(revision.previousScopeHash).toBe(
      computeContextAgentScopeHash(scope()),
    );
  });

  it("refuses widening, mixed, unchanged, and proxy revisions", () => {
    expect(() =>
      createContextAgentScopeRevision({
        ...revisionInput,
        newScope: scope({ deviceRefs: ["device:laptop-1", "device:phone-1"] }),
      }),
    ).toThrow("context_agent_scope_expansion_requires_new_consent");
    expect(() =>
      createContextAgentScopeRevision({
        ...revisionInput,
        newScope: scope({
          directoryRefs: [],
          purposes: [
            "company_memory_candidates",
            "operating_context_evidence",
          ],
        }),
      }),
    ).toThrow("context_agent_scope_expansion_requires_new_consent");
    expect(() =>
      createContextAgentScopeRevision({
        ...revisionInput,
        newScope: scope(),
      }),
    ).toThrow("context_agent_scope_revision_requires_narrowing");
    expect(() =>
      createContextAgentScopeRevision({
        ...revisionInput,
        actorUserRef: "admin-1",
        newScope: scope({ directoryRefs: ["dir:projects"] }),
      }),
    ).toThrow("context_agent_self_scope_revision_required");
  });
});

describe("context agent collection receipt", () => {
  const collectionInput = {
    workspaceRef: "workspace:workspace-1",
    consentRef: "consent-1",
    memberUserRef: "member-1",
    collectionKind: "local_snapshot" as const,
    consentScopeHash: computeContextAgentScopeHash(scope()),
    itemCount: 2,
    digestHashes: [DIGEST],
    evidenceRefs: ["evidence:collection:1"],
    idempotencyKey: "collection-1",
    collectedAt: NOW,
    recordedAt: NOW,
  };

  it("accepts digest hashes plus evidence refs and pins the boundary literal", () => {
    const receipt = createContextAgentCollectionReceipt(collectionInput);
    expect(receipt.performanceInputProhibited).toBe(true);
    expect(validateContextAgentCollectionReceipt(receipt).valid).toBe(true);
    const tampered = {
      ...receipt,
      performanceInputProhibited: false as unknown as true,
    };
    expect(
      validateContextAgentCollectionReceipt(tampered).errors,
    ).toContain("context_agent_performance_input_boundary_invalid");
  });

  it("refuses raw content in digests, refs, kinds, and item counts", () => {
    expect(() =>
      createContextAgentCollectionReceipt({
        ...collectionInput,
        digestHashes: ["the raw captured sentence"],
      }),
    ).toThrow("context_agent_collection_digest_invalid");
    expect(() =>
      createContextAgentCollectionReceipt({
        ...collectionInput,
        evidenceRefs: ["contains raw content words"],
      }),
    ).toThrow("context_agent_collection_evidence_ref_invalid");
    expect(() =>
      createContextAgentCollectionReceipt({
        ...collectionInput,
        collectionKind: "screen_recording" as never,
      }),
    ).toThrow("context_agent_collection_kind_invalid");
    expect(() =>
      createContextAgentCollectionReceipt({
        ...collectionInput,
        itemCount: 0,
      }),
    ).toThrow("context_agent_collection_item_count_invalid");
  });

  it("never echoes candidate content in error messages", () => {
    const secret = "TOP-SECRET-CUSTOMER-NOTE";
    let message = "";
    try {
      createContextAgentCollectionReceipt({
        ...collectionInput,
        digestHashes: [`raw content: ${secret}`],
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("context_agent_collection_digest_invalid");
    expect(message).not.toContain(secret);
  });
});

describe("context agent pause receipt", () => {
  const pauseInput = {
    workspaceRef: "workspace:workspace-1",
    consentRef: "consent-1",
    memberUserRef: "member-1",
    sequence: 1,
    reasonCodes: ["member_requested"],
    idempotencyKey: "pause-1",
    recordedAt: NOW,
  };

  it("lets an admin pause but only the employee resume", () => {
    const paused = createContextAgentPauseReceipt({
      ...pauseInput,
      actorUserRef: "admin-1",
      action: "pause",
    });
    expect(paused.resultingStatus).toBe("paused");
    expect(validateContextAgentPauseReceipt(paused).valid).toBe(true);
    expect(() =>
      createContextAgentPauseReceipt({
        ...pauseInput,
        actorUserRef: "admin-1",
        action: "resume",
      }),
    ).toThrow("context_agent_self_resume_required");
    const resumed = createContextAgentPauseReceipt({
      ...pauseInput,
      actorUserRef: "member-1",
      action: "resume",
    });
    expect(resumed.resultingStatus).toBe("active");
    expect(
      validateContextAgentPauseReceipt({
        ...resumed,
        actorUserRef: "admin-1",
      }).errors,
    ).toContain("context_agent_self_resume_required");
  });
});

describe("context agent revocation + deletion receipts", () => {
  const revocation = createContextAgentRevocationReceipt({
    workspaceRef: "workspace:workspace-1",
    consentRef: "consent-1",
    memberUserRef: "member-1",
    actorUserRef: "member-1",
    consentScopeHash: computeContextAgentScopeHash(scope()),
    reasonCodes: ["member_revoked"],
    evidenceRefs: ["evidence:revocation:1"],
    idempotencyKey: "revoke-1",
    recordedAt: NOW,
  });

  const deletionInput = {
    workspaceRef: "workspace:workspace-1",
    revocationRef: revocation.receiptId,
    consentRef: "consent-1",
    memberUserRef: "member-1",
    actorUserRef: "admin-1",
    deletionWorkItemRef: revocation.deletionWorkItemRef,
    attempt: 1,
    outcome: "success" as const,
    counts: counts(),
    failureCodes: [] as string[],
    evidenceRefs: ["evidence:deletion:1"],
    idempotencyKey: "deletion-1",
    recordedAt: NOW,
  };

  it("derives a deterministic deletion work item ref", () => {
    expect(revocation.deletionWorkItemRef).toMatch(
      /^context-agent-deletion-work:/,
    );
    expect(validateContextAgentDeletionReceipt(
      createContextAgentDeletionReceipt(deletionInput),
    ).valid).toBe(true);
  });

  it("keeps outcome and failure codes coherent", () => {
    expect(() =>
      createContextAgentDeletionReceipt({
        ...deletionInput,
        failureCodes: ["index_unreachable"],
      }),
    ).toThrow("context_agent_deletion_success_with_failures");
    expect(() =>
      createContextAgentDeletionReceipt({
        ...deletionInput,
        outcome: "partial",
      }),
    ).toThrow("context_agent_deletion_failure_code_required");
    const partial = createContextAgentDeletionReceipt({
      ...deletionInput,
      outcome: "partial",
      failureCodes: ["vector_store_timeout"],
    });
    expect(validateContextAgentDeletionReceipt(partial).valid).toBe(true);
    expect(() =>
      createContextAgentDeletionReceipt({
        ...deletionInput,
        outcome: "erased_forever" as never,
      }),
    ).toThrow("context_agent_deletion_outcome_invalid");
  });

  it("requires structured non-negative integer counts", () => {
    expect(() =>
      createContextAgentDeletionReceipt({
        ...deletionInput,
        counts: counts({ derivedVectorsDeleted: -1 }),
      }),
    ).toThrow("context_agent_deletion_count_invalid");
    expect(() =>
      createContextAgentDeletionReceipt({
        ...deletionInput,
        counts: counts({ multiSourceRecomputed: 1.5 }),
      }),
    ).toThrow("context_agent_deletion_count_invalid");
    const unknown = createContextAgentDeletionReceipt({
      ...deletionInput,
      outcome: "unknown",
      counts: counts({
        indicesDeleted: 0,
        cachesDeleted: 0,
        derivedVectorsDeleted: 0,
        memoryCandidatesDeleted: 0,
        observedFactsDeleted: 0,
        observedFactsEvidenceInvalidated: 0,
        multiSourceRecomputed: 0,
      }),
    });
    expect(unknown.counts.observedFactsEvidenceInvalidated).toBe(0);
  });
});
