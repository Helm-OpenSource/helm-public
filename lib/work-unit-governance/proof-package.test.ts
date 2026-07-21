import { describe, expect, it } from "vitest";

import { computeWorkUnitSnapshotHash, hwuAcceptanceChecklist } from "./contracts";
import {
  buildWorkUnitProofPackage,
  buildWorkUnitProofPackageReadout,
  validateWorkUnitProofPackage,
  type WorkUnitProofPackage,
} from "./proof-package";
import {
  buildSyntheticActivationAuthorityReceipt,
  buildSyntheticActivationHandoffRequest,
  buildSyntheticLearningAssetDraft,
  buildSyntheticLearningFinding,
  buildSyntheticPromotedWorkUnit,
  buildSyntheticWorkUnitProofPackage,
} from "./synthetic-fixtures";

describe("work unit proof package", () => {
  it("builds a shape-only proof package that is not readiness or approval", () => {
    const workUnit = buildSyntheticPromotedWorkUnit();
    const activationRequest = buildSyntheticActivationHandoffRequest(workUnit);
    const activationReceipt = buildSyntheticActivationAuthorityReceipt(
      workUnit,
      activationRequest,
    );
    const packageItem = buildWorkUnitProofPackage({
      workUnit,
      activationRequest,
      activationReceipt,
    });

    expect(validateWorkUnitProofPackage({ workUnit, packageItem })).toEqual([]);
    expect(packageItem.snapshotHash).toBe(computeWorkUnitSnapshotHash(workUnit));
    expect(packageItem.requirementCoverage).toHaveLength(hwuAcceptanceChecklist.length);
    expect(packageItem.entries.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining([
        "work_unit_snapshot",
        "decision_card",
        "validation_receipt",
        "owner_decision",
        "merge_receipt",
        "activation_handoff_request",
        "activation_authority_receipt",
      ]),
    );
    expect(packageItem.publicCoreCarriesRealInstance).toBe(false);
    expect(packageItem.publicCorePersists).toBe(false);
    expect(packageItem.grantsApproval).toBe(false);
    expect(packageItem.grantsReadiness).toBe(false);
    expect(packageItem.activatesRuntime).toBe(false);
    expect(packageItem.readinessClaim).toBe("not_readiness");
  });

  it("blocks stale proof packages whose snapshot no longer binds the work unit", () => {
    const workUnit = buildSyntheticPromotedWorkUnit();
    const packageItem = buildSyntheticWorkUnitProofPackage(workUnit, {
      snapshotHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    });

    expect(
      validateWorkUnitProofPackage({ workUnit, packageItem }).map(
        (violation) => violation.rule,
      ),
    ).toContain("proof-package-snapshot-mismatch");
  });

  it("blocks proof packages that try to carry raw private or unknown evidence", () => {
    const workUnit = buildSyntheticPromotedWorkUnit();
    const clean = buildSyntheticWorkUnitProofPackage(workUnit);
    const packageItem: WorkUnitProofPackage = {
      ...clean,
      entries: [
        ...clean.entries,
        {
          entryId: "proof-entry:raw-private",
          kind: "evidence_manifest",
          title: "Raw private fixture should not render",
          summary: "This entry is intentionally unsafe.",
          ref: "synthetic://unsafe-redaction/raw-private-fixture",
          redactionStatus: "raw_private_rejected",
          observedBy: { actorType: "ai", actorRef: "agent-1" },
          observedAt: clean.generatedAt,
          snapshotHash: clean.snapshotHash,
          publicCoreCarriesRealInstance: false,
        },
      ],
    };

    expect(
      validateWorkUnitProofPackage({ workUnit, packageItem }).map(
        (violation) => violation.rule,
      ),
    ).toContain("proof-entry-redaction-not-public-safe");
  });

  it("requires exact HWU coverage entries so omitted requirements are visible", () => {
    const workUnit = buildSyntheticPromotedWorkUnit();
    const clean = buildSyntheticWorkUnitProofPackage(workUnit);
    const packageItem: WorkUnitProofPackage = {
      ...clean,
      requirementCoverage: clean.requirementCoverage.filter(
        (coverage) => coverage.requirementId !== "HWU-14",
      ),
    };

    expect(
      validateWorkUnitProofPackage({ workUnit, packageItem }).map(
        (violation) => violation.rule,
      ),
    ).toContain("proof-package-requirement-coverage-mismatch");
  });

  it("requires coverage status to match the attached evidence", () => {
    const workUnit = buildSyntheticPromotedWorkUnit();
    const clean = buildSyntheticWorkUnitProofPackage(workUnit);
    const covered = clean.requirementCoverage.find(
      (coverage) => coverage.status === "covered",
    );
    expect(covered).toBeDefined();

    const coveredWithoutEvidence: WorkUnitProofPackage = {
      ...clean,
      requirementCoverage: clean.requirementCoverage.map((coverage) =>
        coverage.requirementId === covered?.requirementId
          ? { ...coverage, evidenceEntryIds: [] }
          : coverage,
      ),
    };
    expect(
      validateWorkUnitProofPackage({
        workUnit,
        packageItem: coveredWithoutEvidence,
      }).map((violation) => violation.rule),
    ).toContain("proof-package-covered-requirement-needs-evidence");

    const missingWithEvidence: WorkUnitProofPackage = {
      ...clean,
      requirementCoverage: clean.requirementCoverage.map((coverage) =>
        coverage.requirementId === covered?.requirementId
          ? { ...coverage, status: "missing" }
          : coverage,
      ),
    };
    expect(
      validateWorkUnitProofPackage({
        workUnit,
        packageItem: missingWithEvidence,
      }).map((violation) => violation.rule),
    ).toContain("proof-package-missing-requirement-has-evidence");
  });

  it("rejects duplicate proof entry identifiers", () => {
    const workUnit = buildSyntheticPromotedWorkUnit();
    const clean = buildSyntheticWorkUnitProofPackage(workUnit);
    const firstEntry = clean.entries[0];
    expect(firstEntry).toBeDefined();
    const packageItem: WorkUnitProofPackage = {
      ...clean,
      entries: firstEntry ? [...clean.entries, firstEntry] : clean.entries,
    };

    expect(
      validateWorkUnitProofPackage({ workUnit, packageItem }).map(
        (violation) => violation.rule,
      ),
    ).toContain("proof-package-entry-id-duplicate");
  });

  it("includes repair and learning evidence without applying the learning asset", () => {
    const workUnit = buildSyntheticPromotedWorkUnit();
    const finding = buildSyntheticLearningFinding(workUnit);
    const learningDraft = buildSyntheticLearningAssetDraft({ finding });
    const packageItem = buildWorkUnitProofPackage({
      workUnit,
      learningDrafts: [learningDraft],
    });

    expect(validateWorkUnitProofPackage({ workUnit, packageItem })).toEqual([]);
    expect(packageItem.entries.map((entry) => entry.kind)).toContain(
      "learning_asset_draft",
    );
    expect(packageItem.appliesLearningAsset).toBe(false);
  });

  it("builds a reviewer readout without converting proof into readiness", () => {
    const workUnit = buildSyntheticPromotedWorkUnit();
    const packageItem = buildSyntheticWorkUnitProofPackage(workUnit);
    const readout = buildWorkUnitProofPackageReadout(packageItem);

    expect(readout.userVisible.title.zh).toBe("证明包查看器");
    expect(readout.userVisible.boundary.zh).toContain("不是生产就绪");
    expect(readout.publicCorePersists).toBe(false);
    expect(readout.grantsReadiness).toBe(false);
    expect(readout.grantsApproval).toBe(false);
    expect(readout.activatesRuntime).toBe(false);
  });
});
