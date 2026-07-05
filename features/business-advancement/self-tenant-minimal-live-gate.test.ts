import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT,
  POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT,
  SELF_TENANT_EVENT_CLASSES,
  SELF_TENANT_MINIMAL_LIVE_APPROVED_SCOPE,
  SELF_TENANT_MINIMAL_LIVE_DETECTOR_RUNTIME_ADOPTION,
  SELF_TENANT_MINIMAL_LIVE_GATE_POSTURE,
  SELF_TENANT_MINIMAL_LIVE_GATE_RULE_VERSION,
  evaluateSelfTenantMinimalLiveGate,
  type SelfTenantMinimalLiveGateInput,
} from "./self-tenant-minimal-live-gate";

function build(patch: Partial<SelfTenantMinimalLiveGateInput> = {}) {
  return evaluateSelfTenantMinimalLiveGate({
    ...POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT,
    ...patch,
  });
}

describe("self-tenant minimal-live gate constants", () => {
  it("keeps the gate standard-surface-only and detector adoption no-go", () => {
    expect(SELF_TENANT_MINIMAL_LIVE_GATE_RULE_VERSION).toBe(
      "business-advancement-self-tenant-minimal-live-gate/v1",
    );
    expect(SELF_TENANT_MINIMAL_LIVE_GATE_POSTURE).toBe(
      "Self-Tenant-Standard-Surface-Usage-Only",
    );
    expect(SELF_TENANT_MINIMAL_LIVE_DETECTOR_RUNTIME_ADOPTION).toBe("No-Go");
    expect(SELF_TENANT_EVENT_CLASSES).toEqual([
      "lead_or_customer_contact",
      "poc_or_project_advancement",
      "work_assignment_and_acceptance",
      "builder_backlog",
    ]);
  });
});

describe("evaluateSelfTenantMinimalLiveGate", () => {
  it("defaults to blocked without founder approval or usage scope proof", () => {
    const packet = evaluateSelfTenantMinimalLiveGate(
      DEFAULT_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT,
    );

    expect(packet.decision).toBe("Blocked");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
    expect(packet.publicTrialAllowed).toBe(false);
    expect(packet.approvedEventClasses).toEqual([]);
    expect(packet.blockers.join("\n")).toContain("Founder decision record");
    expect(packet.blockers.join("\n")).toContain("Usage scope proof");
  });

  it("goes for self-tenant minimal-live usage from positive evidence", () => {
    const packet = evaluateSelfTenantMinimalLiveGate(
      POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT,
    );

    expect(packet.decision).toBe("Go-For-Self-Tenant-Minimal-Live-Usage");
    expect(packet.detectorRuntimeAdoption).toBe("No-Go");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
    expect(packet.publicTrialAllowed).toBe(false);
    expect(packet.approvedEventClasses).toEqual([...SELF_TENANT_EVENT_CLASSES]);
    expect(packet.allowedNextStep).toContain("standard review-first surfaces");
    expect(packet.allowedNextStep).toContain("production query adoption");
    expect(packet.blockers).toEqual([]);
  });

  it("blocks when the approved scope literal does not match", () => {
    const packet = build({
      founderDecision: {
        ...POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT.founderDecision,
        approvedScope: "Some-Other-Scope",
      },
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain(
      "self-tenant minimal-live scope",
    );
  });

  it("blocks incomplete founder evidence", () => {
    const packet = build({
      founderDecision: {
        ...POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT.founderDecision,
        approvedAtIso: "July 5 2026",
        evidenceNotes: "",
      },
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("strict UTC timestamp");
  });

  it("blocks when the founder internal gate is not healthy", () => {
    const packet = build({
      founderInternalGate: {
        ...POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT.founderInternalGate,
        decision: "Revise",
        blockers: ["example blocker"],
      },
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("founder internal gate");
  });

  it("blocks empty or unknown event classes", () => {
    const emptyClasses = build({
      usageScope: {
        ...POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT.usageScope,
        approvedEventClasses: [],
      },
    });
    expect(emptyClasses.decision).toBe("Blocked");

    const missingRollback = build({
      usageScope: {
        ...POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT.usageScope,
        rollbackOwnerUserId: " ",
      },
    });
    expect(missingRollback.decision).toBe("Blocked");
  });

  it("blocks when workspace isolation or public-repo data hygiene is not proven", () => {
    const packet = build({
      usageScope: {
        ...POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT.usageScope,
        workspaceIsolatedFromSyntheticDemo: false,
        realDataStaysOutOfPublicRepo: false,
      },
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("Usage scope proof");
  });

  it("references the committed founder decision packet in the positive fixture", () => {
    const { founderDecision } = POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT;

    expect(founderDecision.decisionPacketPath).toBe(
      "docs/_planning/HELM_SELF_TENANT_MINIMAL_LIVE_FOUNDER_DECISION_2026-07-05.md",
    );
    expect(founderDecision.approvedScope).toBe(
      SELF_TENANT_MINIMAL_LIVE_APPROVED_SCOPE,
    );
    expect(() =>
      readFileSync(founderDecision.decisionPacketPath, "utf8"),
    ).not.toThrow();
  });

  it("keeps forbidden work explicit", () => {
    const packet = evaluateSelfTenantMinimalLiveGate(
      POSITIVE_SELF_TENANT_MINIMAL_LIVE_GATE_INPUT,
    );

    expect(packet.forbiddenWork.join("\n")).toContain("data/queries.ts");
    expect(packet.forbiddenWork.join("\n")).toContain(
      "production query adoption",
    );
    expect(packet.forbiddenWork.join("\n")).toContain("auto-execute");
    expect(packet.forbiddenWork.join("\n")).toContain("public repository");
    expect(packet.forbiddenWork.join("\n")).toContain("synthetic demo");
  });

  it("does not import production query, mobile, app, db, prisma, fs or network modules", () => {
    const source = readFileSync(
      "features/business-advancement/self-tenant-minimal-live-gate.ts",
      "utf8",
    );

    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(importLines.join("\n")).not.toContain("@/");
    expect(importLines.join("\n")).not.toContain("data/queries");
    expect(importLines.join("\n")).not.toContain("features/mobile");
    expect(importLines.join("\n")).not.toContain("app/");
    expect(importLines.join("\n")).not.toContain("prisma");
    expect(importLines.join("\n")).not.toContain('from "fs"');
    expect(source).not.toContain("fetch(");
  });
});
