import { describe, expect, it } from "vitest";

import {
  computeWorkUnitSnapshotHash,
  validateUserVisibleTerminology,
  type HelmWorkUnit,
  type WorkUnitOwner,
} from "./contracts";
import {
  buildOwnerLifecycleReadout,
  ownerLifecyclePolicySchema,
  ownerReviewReceiptSchema,
  planOwnerLifecycleEvent,
  validateOwnerLifecycleReceipts,
  type OwnerLifecyclePolicy,
  type OwnerReviewReceipt,
} from "./owner-lifecycle";
import {
  buildSyntheticOwnerLifecyclePolicy,
  buildSyntheticWorkUnit,
  WORK_UNIT_SYNTHETIC_TIME,
} from "./synthetic-fixtures";

const BASE_TIME = WORK_UNIT_SYNTHETIC_TIME;
const LATE_TIME = "2026-07-19T02:00:00.000Z";

const OWNER_1 = {
  ownerRef: "owner-1",
  ownerType: "human_owner",
  displayName: "Synthetic owner",
} satisfies WorkUnitOwner;

const OWNER_2 = {
  ownerRef: "owner-2",
  ownerType: "domain_owner",
  displayName: "Synthetic finance owner",
} satisfies WorkUnitOwner;

function receiptFor(
  workUnit: HelmWorkUnit,
  ownerRef: string,
  overrides: Partial<OwnerReviewReceipt> = {},
): OwnerReviewReceipt {
  const actor =
    ownerRef === "owner-1"
      ? ({ actorType: "human_owner", actorRef: "owner-1" } as const)
      : ({ actorType: "human_owner", actorRef: ownerRef } as const);

  return ownerReviewReceiptSchema.parse({
    schemaVersion: "helm.owner-review-receipt.v1",
    receiptId: `owner-review:${ownerRef}`,
    ownerRef,
    actor,
    decision: "accepted",
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    decidedAt: BASE_TIME,
    rationale: "Synthetic owner reviewed this exact snapshot.",
    publicCoreCarriesRealInstance: false,
    ...overrides,
  });
}

function twoOwnerWorkUnit(overrides: Partial<HelmWorkUnit> = {}): HelmWorkUnit {
  return buildSyntheticWorkUnit({
    requiredOwners: {
      mode: "all_of",
      owners: [OWNER_1, OWNER_2],
    },
    ...overrides,
  });
}

describe("Work Unit owner lifecycle governance", () => {
  it("keeps all-of owner review pending until every required owner has a current receipt", () => {
    const workUnit = twoOwnerWorkUnit();
    const readout = buildOwnerLifecycleReadout({
      workUnit,
      policy: buildSyntheticOwnerLifecyclePolicy(),
      receipts: [receiptFor(workUnit, "owner-1")],
      now: BASE_TIME,
    });

    expect(readout.posture).toBe("waiting_for_all_owners");
    expect(readout.satisfiedOwnerRefs).toEqual(["owner-1"]);
    expect(readout.pendingOwnerRefs).toEqual(["owner-2"]);
    expect(readout.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: "request_owner_review",
          enabled: true,
          publicCoreExecutes: false,
          sendsNotification: false,
          createsExternalEffect: false,
        }),
        expect.objectContaining({
          actionId: "record_owner_decision",
          enabled: true,
          grantsApproval: false,
        }),
      ]),
    );
    expect(validateUserVisibleTerminology(readout.userVisible)).toEqual([]);
  });

  it("accepts authorized human proxy receipts only when the proxy authorization is current and receipted", () => {
    const workUnit = twoOwnerWorkUnit({
      requiredOwners: {
        mode: "any_of",
        owners: [OWNER_1, OWNER_2],
      },
    });
    const policy = ownerLifecyclePolicySchema.parse({
      ...buildSyntheticOwnerLifecyclePolicy(),
      authorizedProxies: [
        {
          ownerRef: "owner-2",
          proxy: {
            ownerRef: "proxy-1",
            ownerType: "authorized_human_proxy",
            displayName: "Synthetic delegated reviewer",
          },
          authorizedBy: { actorType: "human_owner", actorRef: "owner-2" },
          authorizationReceiptRef: "owner-proxy-auth:owner-2:proxy-1",
          authorizedAt: BASE_TIME,
          expiresAt: "2026-07-20T00:00:00.000Z",
          publicCoreCarriesRealInstance: false,
        },
      ],
    }) satisfies OwnerLifecyclePolicy;
    const proxyReceipt = receiptFor(workUnit, "owner-2", {
      receiptId: "owner-review:owner-2:proxy-1",
      actor: { actorType: "authorized_human_proxy", actorRef: "proxy-1" },
      authorizationReceiptRef: "owner-proxy-auth:owner-2:proxy-1",
    });

    expect(
      validateOwnerLifecycleReceipts({
        workUnit,
        policy,
        receipts: [proxyReceipt],
        now: BASE_TIME,
      }),
    ).toEqual([]);

    const readout = buildOwnerLifecycleReadout({
      workUnit,
      policy,
      receipts: [proxyReceipt],
      now: BASE_TIME,
    });
    expect(readout.posture).toBe("owner_review_satisfied");
    expect(readout.authorizedProxyRefs).toEqual(["proxy-1"]);

    const unreceiptedProxy = receiptFor(workUnit, "owner-2", {
      receiptId: "owner-review:owner-2:proxy-without-auth",
      actor: { actorType: "authorized_human_proxy", actorRef: "proxy-1" },
      authorizationReceiptRef: undefined,
    });
    expect(
      validateOwnerLifecycleReceipts({
        workUnit,
        policy,
        receipts: [unreceiptedProxy],
        now: BASE_TIME,
      }).map((violation) => violation.rule),
    ).toContain("proxy-receipt-needs-authorization");
  });

  it("turns an expired owner review into an escalation plan without sending or approving", () => {
    const workUnit = buildSyntheticWorkUnit();
    const readout = buildOwnerLifecycleReadout({
      workUnit,
      policy: buildSyntheticOwnerLifecyclePolicy({
        reviewDueAt: "2026-07-19T01:00:00.000Z",
        escalationOwnerRefs: ["owner-escalation-1"],
      }),
      receipts: [],
      now: LATE_TIME,
    });

    expect(readout.posture).toBe("escalation_required");
    expect(readout.escalationOwnerRefs).toEqual(["owner-escalation-1"]);
    expect(readout.actions.find((action) => action.actionId === "request_escalation")).toMatchObject({
      enabled: true,
      publicCoreExecutes: false,
      sendsNotification: false,
      grantsApproval: false,
    });

    const plan = planOwnerLifecycleEvent({
      workUnit,
      policy: buildSyntheticOwnerLifecyclePolicy({
        reviewDueAt: "2026-07-19T01:00:00.000Z",
        escalationOwnerRefs: ["owner-escalation-1"],
      }),
      receipts: [],
      now: LATE_TIME,
      event: {
        commandId: "request_escalation",
        actor: { actorType: "system", actorRef: "owner-lifecycle" },
        at: LATE_TIME,
        rationale: "Synthetic review expired; prepare an escalation card.",
      },
    });

    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.publicCorePersists).toBe(false);
      expect(plan.sendsNotification).toBe(false);
      expect(plan.createsExternalEffect).toBe(false);
      expect(plan.grantsApproval).toBe(false);
    }
  });

  it("blocks owner decisions from AI and from stale snapshots", () => {
    const workUnit = buildSyntheticWorkUnit();
    const aiPlan = planOwnerLifecycleEvent({
      workUnit,
      policy: buildSyntheticOwnerLifecyclePolicy(),
      receipts: [],
      now: BASE_TIME,
      event: {
        commandId: "record_owner_decision",
        actor: { actorType: "ai", actorRef: "agent-1" },
        at: BASE_TIME,
        ownerRef: "owner-1",
        decision: "accepted",
        rationale: "AI attempted to approve the candidate.",
      },
    });

    expect(aiPlan.ok).toBe(false);
    if (!aiPlan.ok) {
      expect(aiPlan.violations.map((violation) => violation.rule)).toContain(
        "human-owner-lifecycle-command-required",
      );
    }

    const staleReadout = buildOwnerLifecycleReadout({
      workUnit: buildSyntheticWorkUnit({
        relatedMainlineChanges: [
          {
            mainlineRef: "mainline:quote:Q-001:v2",
            conflictKeys: ["quote:Q-001"],
            changedAt: "2026-07-19T01:00:00.000Z",
          },
        ],
      }),
      policy: buildSyntheticOwnerLifecyclePolicy(),
      receipts: [receiptFor(workUnit, "owner-1")],
      now: LATE_TIME,
    });

    expect(staleReadout.posture).toBe("stale_review_required");
    expect(staleReadout.blockers.map((violation) => violation.rule)).toContain(
      "owner-review-stale-related-mainline-change",
    );
  });

  it("allows only human owners to plan owner changes and keeps the plan shape-only", () => {
    const workUnit = twoOwnerWorkUnit();
    const newOwner = {
      ownerRef: "owner-3",
      ownerType: "domain_owner",
      displayName: "Synthetic legal owner",
    } satisfies WorkUnitOwner;

    const systemPlan = planOwnerLifecycleEvent({
      workUnit,
      policy: buildSyntheticOwnerLifecyclePolicy(),
      receipts: [],
      now: BASE_TIME,
      event: {
        commandId: "record_owner_change",
        actor: { actorType: "system", actorRef: "owner-lifecycle" },
        at: BASE_TIME,
        ownerRef: "owner-2",
        newOwner,
        ownerChangeReceiptRef: "owner-change:owner-2:owner-3",
        rationale: "System attempted to replace a required owner.",
      },
    });
    expect(systemPlan.ok).toBe(false);
    if (!systemPlan.ok) {
      expect(systemPlan.violations.map((violation) => violation.rule)).toContain(
        "owner-change-needs-human-owner",
      );
    }

    const ownerPlan = planOwnerLifecycleEvent({
      workUnit,
      policy: buildSyntheticOwnerLifecyclePolicy(),
      receipts: [],
      now: BASE_TIME,
      event: {
        commandId: "record_owner_change",
        actor: { actorType: "human_owner", actorRef: "owner-1" },
        at: BASE_TIME,
        ownerRef: "owner-2",
        newOwner,
        ownerChangeReceiptRef: "owner-change:owner-2:owner-3",
        rationale: "Synthetic owner reassigned the finance review slot.",
      },
    });

    expect(ownerPlan.ok).toBe(true);
    if (ownerPlan.ok) {
      expect(ownerPlan.publicCorePersists).toBe(false);
      expect(ownerPlan.createsExternalEffect).toBe(false);
      expect(ownerPlan.plannedRequiredOwners?.owners.map((owner) => owner.ownerRef)).toEqual([
        "owner-1",
        "owner-3",
      ]);
    }
  });
});
