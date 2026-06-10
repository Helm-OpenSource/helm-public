import { ActionType, PreferenceSignalType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, skillSuggestionMock } = vi.hoisted(() => ({
  dbMock: {
    patternFact: {
      findMany: vi.fn(),
    },
    strategySuggestion: {
      findMany: vi.fn(),
    },
    policyRule: {
      findMany: vi.fn(),
    },
    preferenceSignal: {
      findMany: vi.fn(),
    },
    recommendationFeedback: {
      findMany: vi.fn(),
    },
  },
  skillSuggestionMock: {
    getFormalSkillReviewQueue: vi.fn(),
    getOpenSkillSuggestions: vi.fn(),
    getRecentFormalReviewDecisions: vi.fn(),
    getRecentSkillAdoptions: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/evolution/skill-suggestion.service", () => skillSuggestionMock);

import {
  getApprovalLearningPanels,
  getEvolutionInsights,
} from "./evolution-insights.service";

describe("evolution insights bilingual copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.patternFact.findMany.mockResolvedValue([]);
    dbMock.strategySuggestion.findMany.mockResolvedValue([]);
    dbMock.policyRule.findMany.mockResolvedValue([]);
    dbMock.preferenceSignal.findMany.mockResolvedValue([]);
    dbMock.recommendationFeedback.findMany.mockResolvedValue([]);
    skillSuggestionMock.getFormalSkillReviewQueue.mockResolvedValue([]);
    skillSuggestionMock.getOpenSkillSuggestions.mockResolvedValue([]);
    skillSuggestionMock.getRecentFormalReviewDecisions.mockResolvedValue([]);
    skillSuggestionMock.getRecentSkillAdoptions.mockResolvedValue([]);
  });

  it("returns English pattern fallback copy for English workspaces", async () => {
    dbMock.patternFact.findMany.mockResolvedValueOnce([
      {
        id: "pattern-1",
        patternType: "approval_pattern",
        patternKey: "outbound_review",
        patternValue: "manual_review",
        title: "系统观察到你会保留外发承诺类动作的人工审批",
        summary: "最近多次对外发承诺类动作保留人工审批，建议后续继续走审批链。",
        confidence: 0.82,
        evidenceCount: 4,
        scopeType: "WORKSPACE",
        scopeId: null,
        evidenceSnapshot: "{}",
      },
    ]);

    const result = await getEvolutionInsights({
      workspaceId: "workspace-1",
      userId: "user-1",
      limit: 1,
      locale: "en-US",
    });

    expect(result.insights[0]?.title).toContain("manual approval");
    expect(result.insights[0]?.summary).toContain("outbound commitment actions");
    expect(result.insights[0]?.summary).not.toMatch(/[\u4E00-\u9FFF]/);
  });

  it("localizes approval learning labels and signal fallbacks", async () => {
    dbMock.policyRule.findMany.mockResolvedValueOnce([
      {
        id: "policy-1",
        actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
        name: "Outbound review",
        mode: "REQUIRES_APPROVAL",
        riskThreshold: "HIGH",
        enabled: true,
      },
    ]);
    dbMock.patternFact.findMany.mockResolvedValueOnce([
      {
        id: "pattern-1",
        patternType: "approval_pattern",
        patternKey: "external_commitment",
        patternValue: "approval_required",
        title: "系统观察到你会保留外发承诺类动作的人工审批",
        summary: "最近多次对外发承诺类动作保留人工审批，建议后续继续走审批链。",
        confidence: 0.78,
        evidenceCount: 3,
      },
    ]);
    dbMock.preferenceSignal.findMany
      .mockResolvedValueOnce([
        {
          id: "signal-1",
          signalType: PreferenceSignalType.APPROVAL_PREFERENCE,
          signalKey: ActionType.DRAFT_EXTERNAL_EMAIL,
          signalValue: "approved",
          weight: 1,
          updatedAt: new Date("2026-06-04T08:00:00Z"),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getApprovalLearningPanels({
      workspaceId: "workspace-1",
      userId: "user-1",
      actionTypes: [ActionType.DRAFT_EXTERNAL_EMAIL],
      locale: "en-US",
    });

    const panel = result[ActionType.DRAFT_EXTERNAL_EMAIL];
    expect(panel?.actionLabel).toBe("Draft external email");
    expect(panel?.policy?.modeLabel).toBe("Requires approval");
    expect(panel?.policy?.riskLabel).toBe("High risk");
    expect(panel?.learnedPatterns[0]?.title).toContain("manual approval");
    expect(panel?.learnedPatterns[0]?.summary).toBe(
      "Helm observed that you recently keep manual approval on outbound commitment actions.",
    );
    expect(panel?.signalHints[0]?.summary).toContain("accept similar actions");
    expect(panel?.summaryLines.join(" ")).not.toMatch(/[\u4E00-\u9FFF]/);
  });
});
