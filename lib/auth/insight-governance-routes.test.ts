import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecommendationFeedbackType } from "@prisma/client";

const {
  sessionMock,
  insightGovernanceMock,
  settingsGovernanceMock,
  ownershipMock,
  reportsMock,
  recommendationFeedbackMock,
  skillSuggestionMock,
  strategySuggestionMock,
  cacheMock,
} = vi.hoisted(() => ({
  sessionMock: {
    getCurrentWorkspaceSession: vi.fn(),
    requireCurrentUser: vi.fn(),
    getCurrentWorkspace: vi.fn(),
  },
  insightGovernanceMock: {
    canManageWorkspaceInsights: vi.fn(),
    getInsightGovernanceDeniedMessage: vi.fn(),
  },
  settingsGovernanceMock: {
    canManageWorkspacePolicies: vi.fn(),
    getWorkspaceGovernanceDeniedMessage: vi.fn(),
  },
  ownershipMock: {
    assertWorkspaceRecommendationOwnership: vi.fn(),
    assertWorkspaceActionItemOwnership: vi.fn(),
    assertWorkspaceApprovalTaskOwnership: vi.fn(),
    assertWorkspaceSkillSuggestionOwnership: vi.fn(),
    assertWorkspaceStrategySuggestionOwnership: vi.fn(),
    isWorkspaceOwnershipError: vi.fn(),
  },
  reportsMock: {
    generateWeeklyReport: vi.fn(),
  },
  recommendationFeedbackMock: {
    submitRecommendationFeedback: vi.fn(),
  },
  skillSuggestionMock: {
    acceptSkillSuggestion: vi.fn(),
    approveSkillFormalReview: vi.fn(),
    deferSkillFormalReview: vi.fn(),
    dismissSkillSuggestion: vi.fn(),
    queueSkillFormalReview: vi.fn(),
    rejectSkillFormalReview: vi.fn(),
    returnSkillFormalReviewForHardening: vi.fn(),
  },
  strategySuggestionMock: {
    acceptStrategySuggestion: vi.fn(),
    dismissStrategySuggestion: vi.fn(),
  },
  cacheMock: {
    revalidatePath: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
  requireCurrentUser: sessionMock.requireCurrentUser,
  getCurrentWorkspace: sessionMock.getCurrentWorkspace,
}));

vi.mock("@/lib/auth/insight-governance", () => ({
  canManageWorkspaceInsights: insightGovernanceMock.canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage: insightGovernanceMock.getInsightGovernanceDeniedMessage,
}));

vi.mock("@/lib/auth/settings-governance", () => ({
  canManageWorkspacePolicies: settingsGovernanceMock.canManageWorkspacePolicies,
  getWorkspaceGovernanceDeniedMessage: settingsGovernanceMock.getWorkspaceGovernanceDeniedMessage,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceRecommendationOwnership: ownershipMock.assertWorkspaceRecommendationOwnership,
  assertWorkspaceActionItemOwnership: ownershipMock.assertWorkspaceActionItemOwnership,
  assertWorkspaceApprovalTaskOwnership: ownershipMock.assertWorkspaceApprovalTaskOwnership,
  assertWorkspaceSkillSuggestionOwnership: ownershipMock.assertWorkspaceSkillSuggestionOwnership,
  assertWorkspaceStrategySuggestionOwnership: ownershipMock.assertWorkspaceStrategySuggestionOwnership,
  isWorkspaceOwnershipError: ownershipMock.isWorkspaceOwnershipError,
}));

vi.mock("@/lib/reports", () => ({
  generateWeeklyReport: reportsMock.generateWeeklyReport,
}));

vi.mock("@/lib/recommendations/recommendation-feedback.service", () => ({
  submitRecommendationFeedback: recommendationFeedbackMock.submitRecommendationFeedback,
}));

vi.mock("@/lib/evolution/skill-suggestion.service", () => ({
  acceptSkillSuggestion: skillSuggestionMock.acceptSkillSuggestion,
  approveSkillFormalReview: skillSuggestionMock.approveSkillFormalReview,
  deferSkillFormalReview: skillSuggestionMock.deferSkillFormalReview,
  dismissSkillSuggestion: skillSuggestionMock.dismissSkillSuggestion,
  queueSkillFormalReview: skillSuggestionMock.queueSkillFormalReview,
  rejectSkillFormalReview: skillSuggestionMock.rejectSkillFormalReview,
  returnSkillFormalReviewForHardening: skillSuggestionMock.returnSkillFormalReviewForHardening,
}));

vi.mock("@/lib/evolution/strategy-suggestion.service", () => ({
  acceptStrategySuggestion: strategySuggestionMock.acceptStrategySuggestion,
  dismissStrategySuggestion: strategySuggestionMock.dismissStrategySuggestion,
}));

vi.mock("next/cache", () => ({
  revalidatePath: cacheMock.revalidatePath,
}));

import { generateWeeklyReportAction } from "@/features/reports/actions";
import { submitRecommendationFeedbackAction } from "@/features/recommendations/actions";
import { POST as recommendationFeedbackRoute } from "@/app/api/recommendations/[id]/feedback/route";
import { POST as acceptSkillSuggestionRoute } from "@/app/api/evolution/skill-suggestions/[id]/accept/route";
import { POST as approveSkillFormalReviewRoute } from "@/app/api/evolution/skill-suggestions/[id]/approve-formal-review/route";
import { POST as deferSkillFormalReviewRoute } from "@/app/api/evolution/skill-suggestions/[id]/defer-formal-review/route";
import { POST as dismissSkillSuggestionRoute } from "@/app/api/evolution/skill-suggestions/[id]/dismiss/route";
import { POST as queueSkillFormalReviewRoute } from "@/app/api/evolution/skill-suggestions/[id]/queue-formal-review/route";
import { POST as rejectSkillFormalReviewRoute } from "@/app/api/evolution/skill-suggestions/[id]/reject-formal-review/route";
import { POST as returnSkillFormalReviewRoute } from "@/app/api/evolution/skill-suggestions/[id]/return-hardening/route";
import { POST as acceptStrategySuggestionRoute } from "@/app/api/evolution/strategy-suggestions/[id]/accept/route";
import { POST as dismissStrategySuggestionRoute } from "@/app/api/evolution/strategy-suggestions/[id]/dismiss/route";

describe("insight governance write paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Owner" },
      membership: { role: "MEMBER" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    sessionMock.requireCurrentUser.mockResolvedValue({ id: "user-1", name: "Owner" });
    sessionMock.getCurrentWorkspace.mockResolvedValue({ id: "workspace-1", defaultLocale: "en-US" });
    insightGovernanceMock.canManageWorkspaceInsights.mockReturnValue(false);
    insightGovernanceMock.getInsightGovernanceDeniedMessage.mockReturnValue("insight denied");
    settingsGovernanceMock.canManageWorkspacePolicies.mockReturnValue(false);
    settingsGovernanceMock.getWorkspaceGovernanceDeniedMessage.mockReturnValue("policy denied");
    ownershipMock.assertWorkspaceRecommendationOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceActionItemOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceApprovalTaskOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceSkillSuggestionOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceStrategySuggestionOwnership.mockResolvedValue(undefined);
    ownershipMock.isWorkspaceOwnershipError.mockImplementation(
      (error: unknown) =>
        error instanceof Error &&
        (error.message === "recommendation not found in active workspace" ||
          error.message === "skill suggestion not found in active workspace" ||
          error.message === "strategy suggestion not found in active workspace"),
    );
  });

  it("rejects weekly report generation and recommendation feedback without insight capability", async () => {
    const reportResult = await generateWeeklyReportAction({ offset: 0 });
    const feedbackResult = await submitRecommendationFeedbackAction({
      recommendationId: "rec-1",
      feedbackType: RecommendationFeedbackType.APPROVED,
      sourcePage: "/dashboard",
    });
    const feedbackResponse = await recommendationFeedbackRoute(
      new Request("http://localhost/api/recommendations/rec-1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feedbackType: RecommendationFeedbackType.APPROVED,
        }),
      }),
      { params: Promise.resolve({ id: "rec-1" }) },
    );

    expect(reportResult).toEqual({ ok: false, error: "insight denied" });
    expect(feedbackResult).toEqual({ ok: false, error: "insight denied" });
    expect(feedbackResponse.status).toBe(403);
    await expect(feedbackResponse.json()).resolves.toMatchObject({
      success: false,
      message: "insight denied",
    });
    expect(reportsMock.generateWeeklyReport).not.toHaveBeenCalled();
    expect(recommendationFeedbackMock.submitRecommendationFeedback).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON feedback payload once insight capability is present", async () => {
    insightGovernanceMock.canManageWorkspaceInsights.mockReturnValue(true);

    const response = await recommendationFeedbackRoute(
      new Request("http://localhost/api/recommendations/rec-1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      { params: Promise.resolve({ id: "rec-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      errorCode: "INVALID_REQUEST",
    });
    expect(recommendationFeedbackMock.submitRecommendationFeedback).not.toHaveBeenCalled();
  });

  it("rejects strategy suggestion writes without workspace policy capability", async () => {
    const acceptSkillResponse = await acceptSkillSuggestionRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/accept", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const dismissSkillResponse = await dismissSkillSuggestionRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/dismiss", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const acceptResponse = await acceptStrategySuggestionRoute(
      new Request("http://localhost/api/evolution/strategy-suggestions/suggestion-1/accept", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "suggestion-1" }) },
    );
    const dismissResponse = await dismissStrategySuggestionRoute(
      new Request("http://localhost/api/evolution/strategy-suggestions/suggestion-1/dismiss", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "suggestion-1" }) },
    );
    const queueFormalReviewResponse = await queueSkillFormalReviewRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/queue-formal-review", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const approveFormalReviewResponse = await approveSkillFormalReviewRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/approve-formal-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "ready", checklist: { catalogPatchReady: true, testsReady: true, guardsReady: true, docsReady: true, boundaryConfirmed: true } }),
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const deferFormalReviewResponse = await deferSkillFormalReviewRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/defer-formal-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "later", checklist: { catalogPatchReady: false, testsReady: false, guardsReady: false, docsReady: false, boundaryConfirmed: true } }),
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const rejectFormalReviewResponse = await rejectSkillFormalReviewRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/reject-formal-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "no", checklist: { catalogPatchReady: false, testsReady: false, guardsReady: false, docsReady: false, boundaryConfirmed: true } }),
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const returnFormalReviewResponse = await returnSkillFormalReviewRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/return-hardening", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );

    expect(acceptSkillResponse.status).toBe(403);
    await expect(acceptSkillResponse.json()).resolves.toMatchObject({
      success: false,
      message: "policy denied",
    });
    expect(dismissSkillResponse.status).toBe(403);
    await expect(dismissSkillResponse.json()).resolves.toMatchObject({
      success: false,
      message: "policy denied",
    });
    expect(acceptResponse.status).toBe(403);
    await expect(acceptResponse.json()).resolves.toMatchObject({
      success: false,
      message: "policy denied",
    });
    expect(dismissResponse.status).toBe(403);
    await expect(dismissResponse.json()).resolves.toMatchObject({
      success: false,
      message: "policy denied",
    });
    expect(queueFormalReviewResponse.status).toBe(403);
    await expect(queueFormalReviewResponse.json()).resolves.toMatchObject({
      success: false,
      message: "policy denied",
    });
    expect(approveFormalReviewResponse.status).toBe(403);
    await expect(approveFormalReviewResponse.json()).resolves.toMatchObject({
      success: false,
      message: "policy denied",
    });
    expect(deferFormalReviewResponse.status).toBe(403);
    await expect(deferFormalReviewResponse.json()).resolves.toMatchObject({
      success: false,
      message: "policy denied",
    });
    expect(rejectFormalReviewResponse.status).toBe(403);
    await expect(rejectFormalReviewResponse.json()).resolves.toMatchObject({
      success: false,
      message: "policy denied",
    });
    expect(returnFormalReviewResponse.status).toBe(403);
    await expect(returnFormalReviewResponse.json()).resolves.toMatchObject({
      success: false,
      message: "policy denied",
    });
    expect(skillSuggestionMock.acceptSkillSuggestion).not.toHaveBeenCalled();
    expect(skillSuggestionMock.dismissSkillSuggestion).not.toHaveBeenCalled();
    expect(skillSuggestionMock.approveSkillFormalReview).not.toHaveBeenCalled();
    expect(skillSuggestionMock.deferSkillFormalReview).not.toHaveBeenCalled();
    expect(skillSuggestionMock.queueSkillFormalReview).not.toHaveBeenCalled();
    expect(skillSuggestionMock.rejectSkillFormalReview).not.toHaveBeenCalled();
    expect(skillSuggestionMock.returnSkillFormalReviewForHardening).not.toHaveBeenCalled();
    expect(strategySuggestionMock.acceptStrategySuggestion).not.toHaveBeenCalled();
    expect(strategySuggestionMock.dismissStrategySuggestion).not.toHaveBeenCalled();
  });

  it("returns 404 when recommendation feedback targets another workspace", async () => {
    insightGovernanceMock.canManageWorkspaceInsights.mockReturnValue(true);
    ownershipMock.assertWorkspaceRecommendationOwnership.mockRejectedValue(
      new Error("recommendation not found in active workspace"),
    );

    const response = await recommendationFeedbackRoute(
      new Request("http://localhost/api/recommendations/rec-1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feedbackType: RecommendationFeedbackType.APPROVED,
        }),
      }),
      { params: Promise.resolve({ id: "rec-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "recommendation not found in active workspace",
    });
    expect(recommendationFeedbackMock.submitRecommendationFeedback).not.toHaveBeenCalled();
  });

  it("allows insight-governance write paths once capability is present", async () => {
    insightGovernanceMock.canManageWorkspaceInsights.mockReturnValue(true);
    reportsMock.generateWeeklyReport.mockResolvedValue({ id: "report-1" });
    recommendationFeedbackMock.submitRecommendationFeedback.mockResolvedValue({ id: "feedback-1" });

    const reportResult = await generateWeeklyReportAction({ offset: 1 });
    const feedbackResult = await submitRecommendationFeedbackAction({
      recommendationId: "rec-1",
      feedbackType: RecommendationFeedbackType.REJECTED,
      sourcePage: "/reports",
    });
    const feedbackResponse = await recommendationFeedbackRoute(
      new Request("http://localhost/api/recommendations/rec-1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feedbackType: RecommendationFeedbackType.IGNORED,
        }),
      }),
      { params: Promise.resolve({ id: "rec-1" }) },
    );

    expect(reportResult).toEqual({ ok: true, reportId: "report-1" });
    expect(feedbackResult).toEqual({ ok: true });
    expect(feedbackResponse.status).toBe(200);
    await expect(feedbackResponse.json()).resolves.toMatchObject({
      success: true,
      data: { id: "feedback-1" },
    });
    expect(reportsMock.generateWeeklyReport).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorName: "Owner",
      english: true,
      offset: 1,
    });
    expect(ownershipMock.assertWorkspaceRecommendationOwnership).toHaveBeenCalledWith("workspace-1", "rec-1");
    expect(recommendationFeedbackMock.submitRecommendationFeedback).toHaveBeenCalled();
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/reports");
  });

  it("allows strategy suggestion writes once workspace policy capability is present", async () => {
    settingsGovernanceMock.canManageWorkspacePolicies.mockReturnValue(true);
    skillSuggestionMock.acceptSkillSuggestion.mockResolvedValue({ id: "skill-1" });
    skillSuggestionMock.approveSkillFormalReview.mockResolvedValue({ id: "skill-1" });
    skillSuggestionMock.deferSkillFormalReview.mockResolvedValue({ id: "skill-1" });
    skillSuggestionMock.dismissSkillSuggestion.mockResolvedValue({ id: "skill-1" });
    skillSuggestionMock.queueSkillFormalReview.mockResolvedValue({ id: "skill-1" });
    skillSuggestionMock.rejectSkillFormalReview.mockResolvedValue({ id: "skill-1" });
    skillSuggestionMock.returnSkillFormalReviewForHardening.mockResolvedValue({ id: "skill-1" });
    strategySuggestionMock.acceptStrategySuggestion.mockResolvedValue({ id: "suggestion-1" });
    strategySuggestionMock.dismissStrategySuggestion.mockResolvedValue({ id: "suggestion-1" });

    const acceptSkillResponse = await acceptSkillSuggestionRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/accept", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const dismissSkillResponse = await dismissSkillSuggestionRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/dismiss", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const acceptResponse = await acceptStrategySuggestionRoute(
      new Request("http://localhost/api/evolution/strategy-suggestions/suggestion-1/accept", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "suggestion-1" }) },
    );
    const dismissResponse = await dismissStrategySuggestionRoute(
      new Request("http://localhost/api/evolution/strategy-suggestions/suggestion-1/dismiss", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "suggestion-1" }) },
    );
    const queueFormalReviewResponse = await queueSkillFormalReviewRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/queue-formal-review", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const approveFormalReviewResponse = await approveSkillFormalReviewRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/approve-formal-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "ready", checklist: { catalogPatchReady: true, testsReady: true, guardsReady: true, docsReady: true, boundaryConfirmed: true } }),
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const deferFormalReviewResponse = await deferSkillFormalReviewRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/defer-formal-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "later", checklist: { catalogPatchReady: false, testsReady: false, guardsReady: false, docsReady: false, boundaryConfirmed: true } }),
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const rejectFormalReviewResponse = await rejectSkillFormalReviewRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/reject-formal-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "no", checklist: { catalogPatchReady: false, testsReady: false, guardsReady: false, docsReady: false, boundaryConfirmed: true } }),
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );
    const returnFormalReviewResponse = await returnSkillFormalReviewRoute(
      new Request("http://localhost/api/evolution/skill-suggestions/skill-1/return-hardening", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "skill-1" }) },
    );

    expect(acceptSkillResponse.status).toBe(200);
    await expect(acceptSkillResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestion: { id: "skill-1" } },
    });
    expect(dismissSkillResponse.status).toBe(200);
    await expect(dismissSkillResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestion: { id: "skill-1" } },
    });
    expect(acceptResponse.status).toBe(200);
    await expect(acceptResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestion: { id: "suggestion-1" } },
    });
    expect(dismissResponse.status).toBe(200);
    await expect(dismissResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestion: { id: "suggestion-1" } },
    });
    expect(queueFormalReviewResponse.status).toBe(200);
    await expect(queueFormalReviewResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestion: { id: "skill-1" } },
    });
    expect(approveFormalReviewResponse.status).toBe(200);
    await expect(approveFormalReviewResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestion: { id: "skill-1" } },
    });
    expect(deferFormalReviewResponse.status).toBe(200);
    await expect(deferFormalReviewResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestion: { id: "skill-1" } },
    });
    expect(rejectFormalReviewResponse.status).toBe(200);
    await expect(rejectFormalReviewResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestion: { id: "skill-1" } },
    });
    expect(returnFormalReviewResponse.status).toBe(200);
    await expect(returnFormalReviewResponse.json()).resolves.toMatchObject({
      success: true,
      data: { suggestion: { id: "skill-1" } },
    });
    expect(skillSuggestionMock.acceptSkillSuggestion).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
    });
    expect(skillSuggestionMock.dismissSkillSuggestion).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
    });
    expect(skillSuggestionMock.approveSkillFormalReview).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
      reviewNote: "ready",
      checklist: {
        catalogPatchReady: true,
        testsReady: true,
        guardsReady: true,
        docsReady: true,
        boundaryConfirmed: true,
      },
    });
    expect(skillSuggestionMock.deferSkillFormalReview).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
      reviewNote: "later",
      checklist: {
        catalogPatchReady: false,
        testsReady: false,
        guardsReady: false,
        docsReady: false,
        boundaryConfirmed: true,
      },
    });
    expect(skillSuggestionMock.queueSkillFormalReview).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
    });
    expect(skillSuggestionMock.rejectSkillFormalReview).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
      reviewNote: "no",
      checklist: {
        catalogPatchReady: false,
        testsReady: false,
        guardsReady: false,
        docsReady: false,
        boundaryConfirmed: true,
      },
    });
    expect(skillSuggestionMock.returnSkillFormalReviewForHardening).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
    });
    expect(ownershipMock.assertWorkspaceSkillSuggestionOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "skill-1",
    );
    expect(strategySuggestionMock.acceptStrategySuggestion).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      suggestionId: "suggestion-1",
      userId: "user-1",
      actorName: "Owner",
    });
    expect(strategySuggestionMock.dismissStrategySuggestion).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      suggestionId: "suggestion-1",
      userId: "user-1",
      actorName: "Owner",
    });
    expect(ownershipMock.assertWorkspaceStrategySuggestionOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "suggestion-1",
    );
  });
});
