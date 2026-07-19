import { describe, expect, it } from "vitest";

import { computeWorkUnitSnapshotHash } from "./contracts";
import {
  buildRepairLearningReadout,
  validateLearningFindingResolution,
  validateWorkUnitRepairCandidate,
} from "./repair-learning-loop";
import {
  buildSyntheticFailedWorkUnit,
  buildSyntheticLearningAssetDraft,
  buildSyntheticLearningFinding,
  buildSyntheticRepairedWorkUnit,
  buildSyntheticRepairCandidateRecord,
  syntheticAcceptedDecision,
  WORK_UNIT_SYNTHETIC_TIME,
} from "./synthetic-fixtures";

describe("work unit repair and learning loop", () => {
  it("allows AI to prepare a repaired candidate without approval, persistence, or side effects", () => {
    const original = buildSyntheticFailedWorkUnit();
    const repaired = buildSyntheticRepairedWorkUnit(original);
    const repair = buildSyntheticRepairCandidateRecord({ original, repaired });

    expect(validateWorkUnitRepairCandidate({ original, repaired, repair })).toEqual([]);
    expect(repaired.status).toBe("candidate");
    expect(repaired.agentRole).toBe("repair");
    expect(repaired.decision).toBeUndefined();
    expect(repaired.decisionSnapshotHash).toBeUndefined();
    expect(repaired.mergeReceipt).toBeUndefined();
    expect(repaired.activationReceipt).toBeUndefined();
    expect(repair.publicCoreCarriesRealInstance).toBe(false);
    expect(repair.publicCorePersists).toBe(false);
    expect(repair.createsExternalEffect).toBe(false);
    expect(repair.grantsApproval).toBe(false);
  });

  it("blocks AI repair attempts that produce authoritative state", () => {
    const original = buildSyntheticFailedWorkUnit();
    const candidate = buildSyntheticRepairedWorkUnit(original);
    const acceptedHash = computeWorkUnitSnapshotHash(candidate);
    const repaired = buildSyntheticRepairedWorkUnit(original, {
      status: "accepted_by_human",
      decisionSnapshotHash: acceptedHash,
      decision: syntheticAcceptedDecision(acceptedHash, {
        actorType: "ai",
        actorRef: "agent-1",
      }),
    });
    const repair = buildSyntheticRepairCandidateRecord({ original, repaired });

    expect(
      validateWorkUnitRepairCandidate({ original, repaired, repair }).map(
        (violation) => violation.rule,
      ),
    ).toEqual(
      expect.arrayContaining([
        "ai-cannot-authoritative-state",
        "repair-must-return-new-candidate",
      ]),
    );
  });

  it("blocks AI repair attempts that change checks to pass itself", () => {
    const original = buildSyntheticFailedWorkUnit();
    const repaired = buildSyntheticRepairedWorkUnit(original);
    const repair = buildSyntheticRepairCandidateRecord({
      original,
      repaired,
      overrides: {
        changesCheckRules: true,
        checkRuleChangeRefs: ["synthetic://guard/relaxed-renewal-cost"],
      },
    });

    expect(
      validateWorkUnitRepairCandidate({ original, repaired, repair }).map(
        (violation) => violation.rule,
      ),
    ).toContain("ai-repair-cannot-change-check-rules");
  });

  it("requires a failed validation receipt before opening a repair loop", () => {
    const original = buildSyntheticRepairedWorkUnit(buildSyntheticFailedWorkUnit());
    const repaired = buildSyntheticRepairedWorkUnit(original);
    const repair = buildSyntheticRepairCandidateRecord({ original, repaired });

    expect(
      validateWorkUnitRepairCandidate({ original, repaired, repair }).map(
        (violation) => violation.rule,
      ),
    ).toContain("repair-candidate-needs-failed-check");
  });

  it("binds the repair record to all failed checks and repaired candidate artifacts", () => {
    const original = buildSyntheticFailedWorkUnit({
      validationReceipts: [
        {
          receiptId: "validation-renewal-cost",
          name: "synthetic-renewal-cost-required",
          ok: false,
          summary: "Synthetic quote is missing renewal cost basis.",
          createdAt: WORK_UNIT_SYNTHETIC_TIME,
        },
        {
          receiptId: "validation-discount-basis",
          name: "synthetic-discount-basis-required",
          ok: false,
          summary: "Synthetic quote is missing discount basis.",
          createdAt: WORK_UNIT_SYNTHETIC_TIME,
        },
      ],
    });
    const repaired = buildSyntheticRepairedWorkUnit(original);
    const repair = buildSyntheticRepairCandidateRecord({
      original,
      repaired,
      overrides: {
        failedReceiptIds: ["validation-renewal-cost"],
        changedArtifactRefs: ["candidate-artifact-missing"],
      },
    });

    expect(
      validateWorkUnitRepairCandidate({ original, repaired, repair }).map(
        (violation) => violation.rule,
      ),
    ).toEqual(
      expect.arrayContaining([
        "repair-failed-receipt-missing",
        "repair-changed-artifact-mismatch",
      ]),
    );
  });

  it("requires every finding to become an executable asset or a human owner waiver", () => {
    const original = buildSyntheticFailedWorkUnit();
    const finding = buildSyntheticLearningFinding(original);

    expect(
      validateLearningFindingResolution({ finding }).map((violation) => violation.rule),
    ).toContain("learning-finding-needs-executable-asset-or-owner-waiver");

    expect(
      validateLearningFindingResolution({
        finding,
        draft: buildSyntheticLearningAssetDraft({ finding }),
      }),
    ).toEqual([]);

    expect(
      validateLearningFindingResolution({
        finding,
        draft: buildSyntheticLearningAssetDraft({
          finding,
          overrides: {
            disposition: {
              findingId: finding.findingId,
              disposition: "owner_waived",
              summary: "Synthetic owner waived the finding for this test fixture.",
              recordedBy: { actorType: "human_owner", actorRef: "owner-1" },
              recordedAt: WORK_UNIT_SYNTHETIC_TIME,
              waiverReason: "Covered by a private owner decision outside Public Core.",
            },
          },
        }),
      }),
    ).toEqual([]);

    expect(
      validateLearningFindingResolution({
        finding,
        draft: buildSyntheticLearningAssetDraft({
          finding,
          overrides: {
            disposition: {
              findingId: finding.findingId,
              disposition: "owner_waived",
              summary: "AI attempted to waive a synthetic finding.",
              recordedBy: { actorType: "ai", actorRef: "agent-1" },
              recordedAt: WORK_UNIT_SYNTHETIC_TIME,
              waiverReason: "No human owner approved this waiver.",
            },
          },
        }),
      }).map((violation) => violation.rule),
    ).toContain("finding-waiver-needs-human-owner");
  });

  it("builds a shape-only repair and learning readout", () => {
    const original = buildSyntheticFailedWorkUnit();
    const repaired = buildSyntheticRepairedWorkUnit(original);
    const repair = buildSyntheticRepairCandidateRecord({ original, repaired });
    const finding = buildSyntheticLearningFinding(original);
    const draft = buildSyntheticLearningAssetDraft({ finding });
    const readout = buildRepairLearningReadout({
      original,
      repaired,
      repair,
      findings: [finding],
      learningDrafts: [draft],
    });

    expect(readout.posture).toBe("lesson_asset_ready");
    expect(readout.publicCorePersists).toBe(false);
    expect(readout.createsExternalEffect).toBe(false);
    expect(readout.grantsApproval).toBe(false);
    expect(readout.actions.every((action) => !action.publicCoreExecutes)).toBe(true);
    expect(readout.actions.every((action) => !action.changesCheckRules)).toBe(true);
  });
});
