import { ActionExecutionMode, RiskLevel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolvePolicyDecision } from "@/lib/policies";

describe("resolvePolicyDecision", () => {
  it("forces approval for high-risk actions", () => {
    const decision = resolvePolicyDecision({
      actionType: "DRAFT_EXTERNAL_EMAIL",
      riskLevel: RiskLevel.HIGH,
      policy: null,
    });

    expect(decision.requiresApproval).toBe(true);
    expect(decision.mode).toBe(ActionExecutionMode.REQUIRES_APPROVAL);
  });

  it("allows auto execution within policy threshold", () => {
    const decision = resolvePolicyDecision({
      actionType: "CREATE_TASK",
      riskLevel: RiskLevel.LOW,
      policy: {
        id: "rule_1",
        workspaceId: "ws_1",
        name: "创建待办默认自动",
        actionType: "CREATE_TASK",
        mode: ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
        riskThreshold: RiskLevel.MEDIUM,
        appliesTo: null,
        description: null,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(decision.requiresApproval).toBe(false);
    expect(decision.mode).toBe(ActionExecutionMode.AUTO_WITHIN_THRESHOLD);
  });
});
