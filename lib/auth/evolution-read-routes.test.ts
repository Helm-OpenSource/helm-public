import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sessionMock,
  insightGovernanceMock,
  evolutionInsightsMock,
  skillSuggestionMock,
  strategySuggestionMock,
  dbMock,
} = vi.hoisted(() => ({
  sessionMock: {
    getCurrentWorkspaceSession: vi.fn(),
  },
  insightGovernanceMock: {
    canManageWorkspaceInsights: vi.fn(),
    getInsightGovernanceDeniedMessage: vi.fn(),
  },
  evolutionInsightsMock: {
    getEvolutionInsights: vi.fn(),
    getActivePatternFacts: vi.fn(),
  },
  skillSuggestionMock: {
    listSkillSuggestions: vi.fn(),
  },
  strategySuggestionMock: {
    listStrategySuggestions: vi.fn(),
  },
  dbMock: {
    deltaEvent: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
}));

vi.mock("@/lib/auth/insight-governance", () => ({
  canManageWorkspaceInsights: insightGovernanceMock.canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage: insightGovernanceMock.getInsightGovernanceDeniedMessage,
}));

vi.mock("@/lib/evolution/evolution-insights.service", () => ({
  getEvolutionInsights: evolutionInsightsMock.getEvolutionInsights,
  getActivePatternFacts: evolutionInsightsMock.getActivePatternFacts,
}));

vi.mock("@/lib/evolution/skill-suggestion.service", () => ({
  listSkillSuggestions: skillSuggestionMock.listSkillSuggestions,
}));

vi.mock("@/lib/evolution/strategy-suggestion.service", () => ({
  listStrategySuggestions: strategySuggestionMock.listStrategySuggestions,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import { GET as evolutionInsightsRoute } from "@/app/api/evolution/insights/route";
import { GET as evolutionPatternsRoute } from "@/app/api/evolution/patterns/route";
import { GET as evolutionSkillSuggestionsRoute } from "@/app/api/evolution/skill-suggestions/route";
import { GET as evolutionStrategySuggestionsRoute } from "@/app/api/evolution/strategy-suggestions/route";
import { GET as evolutionDeltaEventsRoute } from "@/app/api/evolution/delta-events/route";

describe("evolution read routes insight governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Member" },
      membership: { role: "MEMBER" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    insightGovernanceMock.canManageWorkspaceInsights.mockReturnValue(false);
    insightGovernanceMock.getInsightGovernanceDeniedMessage.mockReturnValue("insight denied");
  });

  it("rejects evolution insight read routes without MANAGE_INSIGHTS", async () => {
    const responses = await Promise.all([
      evolutionInsightsRoute(new Request("http://localhost/api/evolution/insights?limit=3")),
      evolutionPatternsRoute(
        new Request("http://localhost/api/evolution/patterns?userScoped=true&userId=user-2&limit=9"),
      ),
      evolutionSkillSuggestionsRoute(
        new Request("http://localhost/api/evolution/skill-suggestions?status=OPEN"),
      ),
      evolutionStrategySuggestionsRoute(
        new Request("http://localhost/api/evolution/strategy-suggestions?status=OPEN"),
      ),
      evolutionDeltaEventsRoute(new Request("http://localhost/api/evolution/delta-events?limit=20")),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        message: "insight denied",
        errorCode: "INSIGHT_GOVERNANCE_REQUIRED",
      });
    }

    expect(evolutionInsightsMock.getEvolutionInsights).not.toHaveBeenCalled();
    expect(evolutionInsightsMock.getActivePatternFacts).not.toHaveBeenCalled();
    expect(skillSuggestionMock.listSkillSuggestions).not.toHaveBeenCalled();
    expect(strategySuggestionMock.listStrategySuggestions).not.toHaveBeenCalled();
    expect(dbMock.deltaEvent.findMany).not.toHaveBeenCalled();
  });

  it("allows evolution insight read routes once MANAGE_INSIGHTS is present", async () => {
    insightGovernanceMock.canManageWorkspaceInsights.mockReturnValue(true);
    evolutionInsightsMock.getEvolutionInsights.mockResolvedValue({ insights: [{ id: "insight-1" }] });
    evolutionInsightsMock.getActivePatternFacts.mockResolvedValue([{ id: "pattern-1" }]);
    skillSuggestionMock.listSkillSuggestions.mockResolvedValue([{ id: "skill-1" }]);
    strategySuggestionMock.listStrategySuggestions.mockResolvedValue([{ id: "suggestion-1" }]);
    dbMock.deltaEvent.findMany.mockResolvedValue([{ id: "delta-1" }]);

    const insightsResponse = await evolutionInsightsRoute(
      new Request("http://localhost/api/evolution/insights?limit=3"),
    );
    const patternsResponse = await evolutionPatternsRoute(
      new Request("http://localhost/api/evolution/patterns?userScoped=true&userId=user-2&limit=9"),
    );
    const skillResponse = await evolutionSkillSuggestionsRoute(
      new Request("http://localhost/api/evolution/skill-suggestions?status=OPEN"),
    );
    const strategyResponse = await evolutionStrategySuggestionsRoute(
      new Request("http://localhost/api/evolution/strategy-suggestions?status=OPEN"),
    );
    const deltaResponse = await evolutionDeltaEventsRoute(
      new Request("http://localhost/api/evolution/delta-events?limit=20"),
    );

    expect(insightsResponse.status).toBe(200);
    await expect(insightsResponse.json()).resolves.toMatchObject({
      success: true,
      data: { insights: [{ id: "insight-1" }] },
    });
    expect(patternsResponse.status).toBe(200);
    await expect(patternsResponse.json()).resolves.toMatchObject({
      success: true,
      data: { patterns: [{ id: "pattern-1" }] },
    });
    expect(skillResponse.status).toBe(200);
    await expect(skillResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestions: [{ id: "skill-1" }] },
    });
    expect(strategyResponse.status).toBe(200);
    await expect(strategyResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestions: [{ id: "suggestion-1" }] },
    });
    expect(deltaResponse.status).toBe(200);
    await expect(deltaResponse.json()).resolves.toMatchObject({
      success: true,
      data: { deltaEvents: [{ id: "delta-1" }] },
    });

    expect(evolutionInsightsMock.getEvolutionInsights).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      limit: 3,
    });
    expect(evolutionInsightsMock.getActivePatternFacts).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-2",
      limit: 9,
    });
    expect(skillSuggestionMock.listSkillSuggestions).toHaveBeenCalledWith("workspace-1", "OPEN");
    expect(strategySuggestionMock.listStrategySuggestions).toHaveBeenCalledWith("workspace-1", "OPEN");
    expect(dbMock.deltaEvent.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  });
});
