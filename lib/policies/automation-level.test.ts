import { ActionExecutionMode } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  AUTOMATION_LEVELS,
  compareAutomationLevels,
  resolveAutomationLevelFromApprovalRule,
  resolveAutomationLevelFromExecutionMode,
} from "@/lib/policies/automation-level";
import { HELM_V2_ACTION_APPROVAL_MATRIX } from "@/lib/helm-v2/approval-matrix";

describe("automation level projection", () => {
  it("projects the policy engine execution modes onto the ladder", () => {
    expect(resolveAutomationLevelFromExecutionMode(ActionExecutionMode.SUGGEST_ONLY)).toMatchObject({
      level: "observer",
      blocked: false,
    });
    expect(resolveAutomationLevelFromExecutionMode(ActionExecutionMode.REQUIRES_APPROVAL)).toMatchObject({
      level: "shadow",
      blocked: false,
    });
    expect(resolveAutomationLevelFromExecutionMode(ActionExecutionMode.AUTO_WITHIN_THRESHOLD)).toMatchObject({
      level: "active",
      blocked: false,
    });
    expect(resolveAutomationLevelFromExecutionMode(ActionExecutionMode.FORBIDDEN)).toMatchObject({
      level: "observer",
      blocked: true,
    });
  });

  it("projects the helm-v2 approval matrix onto the ladder", () => {
    expect(
      resolveAutomationLevelFromApprovalRule(HELM_V2_ACTION_APPROVAL_MATRIX["meeting.parse"]),
    ).toMatchObject({ level: "active", blocked: false });
    expect(
      resolveAutomationLevelFromApprovalRule(HELM_V2_ACTION_APPROVAL_MATRIX["opportunity.shadow_update"]),
    ).toMatchObject({ level: "shadow", blocked: false });
    expect(
      resolveAutomationLevelFromApprovalRule(HELM_V2_ACTION_APPROVAL_MATRIX["email.create_draft"]),
    ).toMatchObject({ level: "shadow", blocked: false });
  });

  it("marks pilot-disabled classes as blocked observers", () => {
    const pilotDisabled = Object.values(HELM_V2_ACTION_APPROVAL_MATRIX).filter(
      (rule) => !rule.pilotEnabled,
    );
    for (const rule of pilotDisabled) {
      expect(resolveAutomationLevelFromApprovalRule(rule)).toMatchObject({
        level: "observer",
        blocked: true,
      });
    }
    // The matrix is expected to keep at least one class off the pilot (e.g.
    // official CRM stage writes); if this ever empties, the mapping and the
    // matrix should be reviewed together.
    expect(pilotDisabled.length).toBeGreaterThan(0);
  });

  it("never projects a human-gated tier to active", () => {
    for (const rule of Object.values(HELM_V2_ACTION_APPROVAL_MATRIX)) {
      const resolution = resolveAutomationLevelFromApprovalRule(rule);
      if (rule.tier !== "A0") {
        expect(resolution.level).not.toBe("active");
      }
    }
  });

  it("orders the ladder observer < shadow < active", () => {
    expect(AUTOMATION_LEVELS).toEqual(["observer", "shadow", "active"]);
    expect(compareAutomationLevels("observer", "active")).toBeLessThan(0);
    expect(compareAutomationLevels("active", "shadow")).toBeGreaterThan(0);
    expect(compareAutomationLevels("shadow", "shadow")).toBe(0);
  });
});
