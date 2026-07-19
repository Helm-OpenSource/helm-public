import { describe, expect, it } from "vitest";

import { computeWorkUnitSnapshotHash, validateUserVisibleTerminology } from "./contracts";
import {
  buildPrivateMainlineProjection,
  buildWorkUnitRuntimeReadout,
  planWorkUnitRuntimeEvent,
} from "./runtime";
import { buildSyntheticWorkUnit, syntheticAcceptedDecision } from "./synthetic-fixtures";

const BASE_TIME = "2026-07-19T00:00:00.000Z";

describe("Work Unit runtime governance", () => {
  it("turns a clean candidate into a review-ready runtime readout without effects", () => {
    const readout = buildWorkUnitRuntimeReadout(buildSyntheticWorkUnit());

    expect(readout.posture).toBe("owner_review_ready");
    expect(readout.snapshotHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(readout.userVisible.primaryAction.zh).toBe("复核候选方案");
    expect(readout.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandId: "accept_candidate",
          enabled: true,
          requiresHumanOwner: true,
          publicCoreExecutes: false,
          createsExternalEffect: false,
          nextState: "accepted_by_human",
        }),
        expect.objectContaining({
          commandId: "record_mainline",
          enabled: false,
          publicCoreExecutes: false,
          createsExternalEffect: false,
        }),
      ]),
    );
    expect(validateUserVisibleTerminology(readout.userVisible)).toEqual([]);
  });

  it("keeps failed checks in repair posture and blocks owner acceptance", () => {
    const readout = buildWorkUnitRuntimeReadout(
      buildSyntheticWorkUnit({
        validationReceipts: [
          {
            receiptId: "validation-failed",
            name: "synthetic-business-check",
            ok: false,
            summary: "Synthetic check failed.",
            createdAt: BASE_TIME,
          },
        ],
      }),
    );

    expect(readout.posture).toBe("needs_repair");
    expect(readout.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "validation-check-failed" }),
      ]),
    );
    expect(readout.commands.find((command) => command.commandId === "accept_candidate")).toMatchObject({
      enabled: false,
      blockedBy: ["validation-check-failed"],
    });
    expect(readout.commands.find((command) => command.commandId === "request_changes")).toMatchObject({
      enabled: true,
      nextState: "changes_requested",
    });
  });

  it("requires a human owner to plan acceptance and never persists from Public Core", () => {
    const candidate = buildSyntheticWorkUnit();

    const aiPlan = planWorkUnitRuntimeEvent({
      workUnit: candidate,
      event: {
        commandId: "accept_candidate",
        actor: { actorType: "ai", actorRef: "agent-1" },
        at: BASE_TIME,
        rationale: "AI tried to accept the candidate.",
      },
    });
    expect(aiPlan.ok).toBe(false);
    if (!aiPlan.ok) {
      expect(aiPlan.violations.map((violation) => violation.rule)).toContain(
        "human-owner-runtime-command-required",
      );
    }

    const ownerPlan = planWorkUnitRuntimeEvent({
      workUnit: candidate,
      event: {
        commandId: "accept_candidate",
        actor: { actorType: "human_owner", actorRef: "owner-1" },
        at: BASE_TIME,
        rationale: "Synthetic owner accepted the current candidate snapshot.",
      },
    });

    expect(ownerPlan.ok).toBe(true);
    if (ownerPlan.ok) {
      expect(ownerPlan.publicCorePersists).toBe(false);
      expect(ownerPlan.createsExternalEffect).toBe(false);
      expect(ownerPlan.plannedState).toMatchObject({
        status: "accepted_by_human",
        decisionSnapshotHash: computeWorkUnitSnapshotHash(candidate),
      });
      expect(ownerPlan.plannedState.mergeReceipt).toBeUndefined();
      expect(ownerPlan.plannedState.activationReceipt).toBeUndefined();
    }
  });

  it("marks accepted work stale when related conflict keys moved", () => {
    const candidate = buildSyntheticWorkUnit();
    const snapshotHash = computeWorkUnitSnapshotHash(candidate);
    const readout = buildWorkUnitRuntimeReadout(
      buildSyntheticWorkUnit({
        status: "accepted_by_human",
        decisionSnapshotHash: snapshotHash,
        decision: syntheticAcceptedDecision(snapshotHash),
        relatedMainlineChanges: [
          {
            mainlineRef: "mainline:quote:Q-001:v2",
            conflictKeys: ["quote:Q-001"],
            changedAt: "2026-07-19T01:00:00.000Z",
          },
        ],
      }),
    );

    expect(readout.posture).toBe("stale");
    expect(readout.commands.find((command) => command.commandId === "record_mainline")).toMatchObject({
      enabled: false,
      blockedBy: ["approval-invalidated-by-related-mainline-change"],
    });
  });

  it("builds an append-only private mainline projection shape without real instances", () => {
    const candidate = buildSyntheticWorkUnit();
    const snapshotHash = computeWorkUnitSnapshotHash(candidate);
    const accepted = buildSyntheticWorkUnit({
      status: "accepted_by_human",
      decisionSnapshotHash: snapshotHash,
      decision: syntheticAcceptedDecision(snapshotHash),
    });
    const promoted = buildSyntheticWorkUnit({
      status: "promoted_to_mainline",
      decisionSnapshotHash: snapshotHash,
      decision: syntheticAcceptedDecision(snapshotHash),
      mergeReceipt: {
        receiptId: "merge-1",
        actor: { actorType: "human_owner", actorRef: "owner-1" },
        snapshotHash,
        createdAt: BASE_TIME,
        summary: "Synthetic promotion receipt shape.",
        publicCoreCarriesRealInstance: false,
      },
    });

    const projection = buildPrivateMainlineProjection([candidate, accepted, promoted]);

    expect(projection.publicCoreCarriesRealInstance).toBe(false);
    expect(projection.entries.map((entry) => entry.state)).toEqual([
      "accepted_by_human",
      "promoted_to_mainline",
    ]);
    expect(projection.effectiveByConflictKey).toEqual([
      {
        conflictKey: "quote:Q-001",
        entryId: "mainline-entry:hwu-synthetic-001:promoted_to_mainline",
      },
    ]);
  });
});
