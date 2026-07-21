import { describe, expect, it } from "vitest";

import {
  buildActivationHandoffReadout,
  planActivationHandoffEvent,
  validateActivationAuthorization,
  validateActivationHandoffRequest,
} from "./activation-handoff";
import { computeWorkUnitSnapshotHash, type HelmWorkUnit } from "./contracts";
import {
  buildSyntheticPromotedWorkUnit,
  buildSyntheticActivationAuthorityReceipt,
  buildSyntheticActivationHandoffRequest,
  buildSyntheticWorkUnit,
  WORK_UNIT_SYNTHETIC_TIME,
} from "./synthetic-fixtures";

describe("activation handoff governance", () => {
  it("plans a promoted work package handoff without external side effects", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit);

    expect(validateActivationHandoffRequest({ workUnit, request })).toEqual([]);

    const plan = planActivationHandoffEvent({
      workUnit,
      event: {
        commandId: "request_activation_handoff",
        actor: { actorType: "human_owner", actorRef: "owner-1" },
        at: WORK_UNIT_SYNTHETIC_TIME,
        rationale: "Synthetic owner requested private-plane activation review.",
      },
    });

    expect(plan).toMatchObject({
      ok: true,
      commandId: "request_activation_handoff",
      publicCorePersists: false,
      createsExternalEffect: false,
      sendsExternally: false,
      writesTarget: false,
      activatesRuntime: false,
      grantsApproval: false,
    });
    expect(plan.ok && plan.plannedRequest.publicCoreCarriesRealInstance).toBe(false);
  });

  it("blocks handoff before the work package is recorded in the company mainline", () => {
    const workUnit = buildSyntheticWorkUnit({ activationScope: "production_runtime" });
    const request = buildSyntheticActivationHandoffRequest(workUnit);

    expect(validateActivationHandoffRequest({ workUnit, request }).map((v) => v.rule)).toContain(
      "activation-handoff-mainline-required",
    );
  });

  it("requires activation handoff to stay bound to the exact mainline snapshot", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit, {
      snapshotHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    });

    expect(validateActivationHandoffRequest({ workUnit, request }).map((v) => v.rule)).toContain(
      "activation-handoff-snapshot-mismatch",
    );
  });

  it("blocks AI or generic human activation authorization", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit);
    const receipt = buildSyntheticActivationAuthorityReceipt(workUnit, request, {
      actor: { actorType: "ai", actorRef: "agent-1" },
    });

    expect(
      validateActivationAuthorization({ workUnit, request, receipt }).map((v) => v.rule),
    ).toContain("activation-authorization-needs-human-owner");
  });

  it("blocks AI-created activation handoff requests before authorization", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit, {
      requestedBy: { actorType: "ai", actorRef: "agent-1" },
    });

    expect(validateActivationHandoffRequest({ workUnit, request }).map((v) => v.rule)).toContain(
      "activation-handoff-request-needs-human-owner",
    );
  });

  it("accepts a human-owner authorization receipt as private-plane shape only", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit);
    const receipt = buildSyntheticActivationAuthorityReceipt(workUnit, request);

    expect(validateActivationAuthorization({ workUnit, request, receipt })).toEqual([]);

    const readout = buildActivationHandoffReadout({ workUnit, request, receipt });
    expect(readout.posture).toBe("authorized_for_private_plane");
    expect(readout.publicCoreCarriesRealInstance).toBe(false);
    expect(readout.publicCorePersists).toBe(false);
    expect(readout.activatesRuntime).toBe(false);
  });

  it("blocks an authorization receipt that is not accompanied by its handoff request", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit);
    const receipt = buildSyntheticActivationAuthorityReceipt(workUnit, request);

    const readout = buildActivationHandoffReadout({ workUnit, receipt });

    expect(readout.posture).toBe("blocked");
    expect(readout.blockers.map((violation) => violation.rule)).toContain(
      "activation-authorization-request-required",
    );
  });

  it("requires remediation instead of rollback for customer-visible and commercial commitments", () => {
    for (const activationScope of [
      "customer_visible",
      "commercial_commitment",
    ] satisfies HelmWorkUnit["activationScope"][]) {
      const workUnit = buildSyntheticPromotedWorkUnit({
        activationScope,
        rollbackOrRemediationPlan: {
          kind: "rollback",
          summary: "Rollback is not enough for synthetic external effects.",
          responsibleOwnerRef: "owner-1",
        },
      });
      const request = buildSyntheticActivationHandoffRequest(workUnit);

      expect(validateActivationHandoffRequest({ workUnit, request }).map((v) => v.rule)).toContain(
        "activation-handoff-remediation-required",
      );
      expect(buildActivationHandoffReadout({ workUnit }).blockers.map((v) => v.rule)).toContain(
        "activation-handoff-remediation-required",
      );
    }
  });

  it("blocks activation authorization when the handoff receipt scope drifts", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit);
    const receipt = buildSyntheticActivationAuthorityReceipt(workUnit, request, {
      authorizedScope: "customer_visible",
    });

    expect(
      validateActivationAuthorization({ workUnit, request, receipt }).map((v) => v.rule),
    ).toContain("activation-authorization-scope-mismatch");
  });

  it("blocks stale mainline drift before activation handoff", () => {
    const base = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const workUnit = {
      ...base,
      relatedMainlineChanges: [
        {
          mainlineRef: "mainline:quote:Q-001:v2",
          conflictKeys: ["quote:Q-001"],
          changedAt: "2026-07-19T01:00:00.000Z",
        },
      ],
    };
    const request = buildSyntheticActivationHandoffRequest(workUnit);

    expect(validateActivationHandoffRequest({ workUnit, request }).map((v) => v.rule)).toContain(
      "activation-handoff-stale-mainline",
    );
    expect(computeWorkUnitSnapshotHash(workUnit)).toBe(request.snapshotHash);
  });
});
