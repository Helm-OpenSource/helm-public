import { describe, expect, it } from "vitest";
import { buildTenantResourceManualProofLifecycle } from "@/lib/tenant-resources/manual-proof-lifecycle";

const generatedAt = "2026-04-25T08:00:00.000Z";

const baseInput = {
  now: generatedAt,
  resourceKey: "import_source:hubspot",
  actionRef: "tenant_resource_loop_hubspot_renewal_risk",
  generatedAt,
  detailStatus: "usable_for_judgement" as const,
  nextOwner: "operator" as const,
  failureMode: null,
  evidenceRefs: ["import_source:hubspot", "import_job:job-1"],
};

describe("tenant resource manual proof lifecycle", () => {
  it("requires an operator submission before manual proof can enter follow-through learning", () => {
    const lifecycle = buildTenantResourceManualProofLifecycle({
      ...baseInput,
      proofRequired: true,
      proofLifecycleState: "required",
    });

    expect(lifecycle).toMatchObject({
      lifecycleKey:
        "tenant_resource_manual_proof_import_source_hubspot_tenant_resource_loop_hubspot_renewal_risk",
      required: true,
      status: "awaiting_submission",
      submitter: {
        expected: "operator",
        submittedBy: null,
      },
      reviewer: {
        expected: "none",
      },
      followThrough: {
        canEnterLearn: false,
        nextOwner: "operator",
        result: "await_proof",
      },
    });
    expect(lifecycle.boundaryNotes.join("\n")).toContain("read-only");
  });

  it("routes submitted proof to reviewer before closing follow-through", () => {
    const lifecycle = buildTenantResourceManualProofLifecycle({
      ...baseInput,
      proofRequired: true,
      proofLifecycleState: "required",
      proofRecords: [
        {
          proofId: "proof-1",
          resourceKey: "import_source:hubspot",
          actionRef: "tenant_resource_loop_hubspot_renewal_risk",
          status: "SUBMITTED",
          submittedBy: "operator-1",
          submittedAt: "2026-04-25T07:55:00.000Z",
          evidenceRefs: ["screenshot:proof-1"],
        },
      ],
    });

    expect(lifecycle).toMatchObject({
      status: "submitted",
      submitter: {
        expected: "operator",
        submittedBy: "operator-1",
        submittedAt: "2026-04-25T07:55:00.000Z",
      },
      reviewer: {
        expected: "reviewer",
      },
      proof: {
        proofId: "proof-1",
        status: "SUBMITTED",
        evidenceRefs: ["screenshot:proof-1"],
      },
      followThrough: {
        canEnterLearn: false,
        nextOwner: "reviewer",
        result: "review_proof",
      },
    });
  });

  it("allows accepted unexpired proof to enter learn follow-through", () => {
    const lifecycle = buildTenantResourceManualProofLifecycle({
      ...baseInput,
      proofRequired: true,
      proofLifecycleState: "required",
      proofRecords: [
        {
          proofId: "proof-accepted",
          resourceKey: "import_source:hubspot",
          actionRef: "tenant_resource_loop_hubspot_renewal_risk",
          status: "ACCEPTED",
          submittedBy: "operator-1",
          submittedAt: "2026-04-25T07:40:00.000Z",
          reviewedBy: "reviewer-1",
          reviewedAt: "2026-04-25T07:50:00.000Z",
          expiresAt: "2026-04-26T07:50:00.000Z",
          evidenceRefs: ["screenshot:proof-accepted"],
        },
      ],
    });

    expect(lifecycle).toMatchObject({
      status: "accepted",
      reviewer: {
        expected: "none",
        reviewedBy: "reviewer-1",
        reviewedAt: "2026-04-25T07:50:00.000Z",
      },
      expiry: {
        expired: false,
      },
      followThrough: {
        canEnterLearn: true,
        nextOwner: "none",
        result: "learn_from_accepted_proof",
      },
    });
  });

  it("downgrades expired accepted proof back to repair or retry", () => {
    const lifecycle = buildTenantResourceManualProofLifecycle({
      ...baseInput,
      now: "2026-04-27T08:00:00.000Z",
      proofRequired: true,
      proofLifecycleState: "required",
      proofRecords: [
        {
          proofId: "proof-expired",
          resourceKey: "import_source:hubspot",
          actionRef: "tenant_resource_loop_hubspot_renewal_risk",
          status: "ACCEPTED",
          submittedBy: "operator-1",
          submittedAt: "2026-04-25T07:40:00.000Z",
          reviewedBy: "reviewer-1",
          reviewedAt: "2026-04-25T07:50:00.000Z",
          expiresAt: "2026-04-26T07:50:00.000Z",
        },
      ],
    });

    expect(lifecycle).toMatchObject({
      status: "expired",
      expiry: {
        expired: true,
      },
      followThrough: {
        canEnterLearn: false,
        nextOwner: "operator",
        result: "repair_or_retry",
      },
    });
  });

  it("blocks proof lifecycle when the resource action is blocked", () => {
    const lifecycle = buildTenantResourceManualProofLifecycle({
      ...baseInput,
      proofRequired: false,
      proofLifecycleState: "blocked",
      detailStatus: "blocked",
      nextOwner: "none",
      failureMode: "capability_not_granted",
    });

    expect(lifecycle).toMatchObject({
      required: false,
      status: "blocked",
      submitter: {
        expected: "none",
      },
      followThrough: {
        canEnterLearn: false,
        nextOwner: "none",
        result: "stop_blocked",
      },
    });
    expect(lifecycle.followThrough.nextMove).toContain("capability_not_granted");
  });
});
