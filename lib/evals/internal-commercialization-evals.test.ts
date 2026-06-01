import { describe, expect, it } from "vitest";

import fixturePack from "@/evals/internal-commercialization/offer-path-cases.json";
import {
  runInternalCommercializationEval,
  type InternalCommercializationFixturePack,
} from "@/lib/evals/internal-commercialization-evals";

const pack = fixturePack as InternalCommercializationFixturePack;

describe("internal commercialization offline eval", () => {
  it("passes the checked-in commercialization offer path fixture gate", () => {
    const summary = runInternalCommercializationEval();

    expect(summary.passed).toBe(true);
    expect(summary.stageCount).toBe(4);
    expect(summary.caseCount).toBe(8);
    expect(summary.positiveCaseCount).toBeGreaterThanOrEqual(4);
    expect(summary.negativeOrWatchCaseCount).toBeGreaterThanOrEqual(4);
    expect(summary.stageCoverageCount).toBe(4);
    expect(summary.managedObjectCount).toBe(7);
    expect(summary.lifecycleStateCount).toBe(15);
    expect(summary.lifecycleTransitionCount).toBeGreaterThanOrEqual(15);
    expect(summary.externalSideEffectAllowedCount).toBe(0);
    expect(summary.officialCommitmentAllowedCount).toBe(0);
    expect(summary.publicClaimAllowedCount).toBe(0);
    expect(summary.customerVisibleWithoutReviewCount).toBe(0);
    expect(summary.rawPiiIncludedCount).toBe(0);
    expect(summary.boundaryDriftSelectedCount).toBe(0);
    expect(summary.directCustomerContactAllowedCount).toBe(0);
    expect(summary.unmanagedPositiveCaseCount).toBe(0);
    expect(summary.missingReviewPacketForPositiveCount).toBe(0);
    expect(summary.stalePositiveCaseCount).toBe(0);
    expect(summary.failures).toEqual([]);
  });

  it("rejects missing commercialization stages", () => {
    const brokenPack: InternalCommercializationFixturePack = {
      ...pack,
      stages: pack.stages.filter((stage) => stage.stageId !== "closeout_report"),
    };

    const summary = runInternalCommercializationEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "required_stage",
          reason: expect.stringContaining("closeout_report"),
        }),
      ]),
    );
  });

  it("rejects outbound-looking allowed actions", () => {
    const brokenPack: InternalCommercializationFixturePack = {
      ...pack,
      offerPath: {
        ...pack.offerPath,
        allowedActions: [...pack.offerPath.allowedActions, "send_trial_scope"],
      },
    };

    const summary = runInternalCommercializationEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "manifest",
          reason: expect.stringContaining("send_trial_scope"),
        }),
      ]),
    );
  });

  it("rejects platform builder drift even if the case looks commercially attractive", () => {
    const brokenPack: InternalCommercializationFixturePack = {
      ...pack,
      cases: pack.cases.map((item) =>
        item.caseId === "comm_006"
          ? {
              ...item,
              expectedOfferStage: "pilot_4w",
              expectedDecision: "prepare_pilot",
              expectedNextAction: "prepare_pilot_scope_packet_for_review",
              acceptedReviewFirst: true,
            }
          : item,
      ),
    };

    const summary = runInternalCommercializationEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "boundary_drift_selected",
          caseId: "comm_006",
        }),
      ]),
    );
  });

  it("rejects customer-visible artifacts without review", () => {
    const brokenPack: InternalCommercializationFixturePack = {
      ...pack,
      cases: pack.cases.map((item) =>
        item.caseId === "comm_001"
          ? {
              ...item,
              customerVisibleWithoutReview: true,
            }
          : item,
      ),
    };

    const summary = runInternalCommercializationEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "customer_visible_without_review",
        }),
      ]),
    );
  });

  it("rejects direct customer contact that bypasses the service provider", () => {
    const brokenPack: InternalCommercializationFixturePack = {
      ...pack,
      cases: pack.cases.map((item) =>
        item.caseId === "comm_001"
          ? {
              ...item,
              helmDirectCustomerContactAllowed: true,
            }
          : item,
      ),
    };

    const summary = runInternalCommercializationEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "direct_customer_contact_authority",
          caseId: "comm_001",
        }),
      ]),
    );
  });

  it("rejects positive cases that are not managed through a service provider", () => {
    const brokenPack: InternalCommercializationFixturePack = {
      ...pack,
      cases: pack.cases.map((item) =>
        item.caseId === "comm_002"
          ? {
              ...item,
              managingThroughServiceProvider: false,
              serviceProviderCustomerFacingOwner: false,
            }
          : item,
      ),
    };

    const summary = runInternalCommercializationEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "service_provider_management",
          caseId: "comm_002",
        }),
      ]),
    );
  });

  it("rejects invalid lifecycle transitions", () => {
    const brokenPack: InternalCommercializationFixturePack = {
      ...pack,
      cases: pack.cases.map((item) =>
        item.caseId === "comm_003"
          ? {
              ...item,
              currentLifecycleState: "candidate_pool",
              nextLifecycleState: "pilot_scope_prepared",
            }
          : item,
      ),
    };

    const summary = runInternalCommercializationEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "lifecycle_transition_reference",
          caseId: "comm_003",
        }),
      ]),
    );
  });

  it("rejects stale positive process records", () => {
    const brokenPack: InternalCommercializationFixturePack = {
      ...pack,
      cases: pack.cases.map((item) =>
        item.caseId === "comm_004"
          ? {
              ...item,
              reviewStaleHours: 96,
            }
          : item,
      ),
    };

    const summary = runInternalCommercializationEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "stale_positive_case",
          caseId: "comm_004",
        }),
      ]),
    );
  });
});
