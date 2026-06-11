import { ActionType, OpportunityType, RiskLevel } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  inferRiskLevel,
  mapActionType,
} from "@/lib/conversation-capture/conversation-action-bridge.service";

describe("conversation action risk inference", () => {
  it("forces HIGH risk for any resolved external-email / reply action", () => {
    // "草稿"/"确认" map to an external-email action; previously the risk keyword
    // set omitted them, leaving these at MEDIUM where they could auto-execute.
    for (const candidate of ["整理草稿先发出去", "确认下一步安排"]) {
      const actionType = mapActionType(candidate, null);
      expect(actionType).toBe(ActionType.DRAFT_EXTERNAL_EMAIL);
      expect(inferRiskLevel(candidate, RiskLevel.MEDIUM, actionType)).toBe(RiskLevel.HIGH);
    }
  });

  it("forces HIGH for recruiting reply drafts too", () => {
    const actionType = mapActionType("回复候选人", OpportunityType.RECRUITING);
    expect(actionType).toBe(ActionType.GENERATE_REPLY_DRAFT);
    expect(inferRiskLevel("回复候选人", RiskLevel.MEDIUM, actionType)).toBe(RiskLevel.HIGH);
  });

  it("preserves CRITICAL when the base risk is already critical", () => {
    const actionType = mapActionType("发邮件", null);
    expect(inferRiskLevel("发邮件", RiskLevel.CRITICAL, actionType)).toBe(RiskLevel.CRITICAL);
  });

  it("leaves a non-external internal task at its base risk", () => {
    const actionType = mapActionType("整理内部排期", null);
    expect(actionType).not.toBe(ActionType.DRAFT_EXTERNAL_EMAIL);
    expect(inferRiskLevel("整理内部排期", RiskLevel.MEDIUM, actionType)).toBe(RiskLevel.MEDIUM);
  });

  it("keeps the explicit high-risk keyword override (预算/法务/承诺...)", () => {
    const actionType = mapActionType("创建预算任务", null);
    expect(inferRiskLevel("创建预算任务", RiskLevel.LOW, actionType)).toBe(RiskLevel.HIGH);
  });
});
