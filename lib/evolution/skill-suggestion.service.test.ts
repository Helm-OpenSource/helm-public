import { ActorType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, analyticsMock, auditMock, evolutionPatternMock } = vi.hoisted(() => ({
  dbMock: {
    skillSuggestion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    capabilityCatalogEntry: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    eventLog: {
      count: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
  analyticsMock: {
    logEvent: vi.fn(),
  },
  auditMock: {
    writeAuditLog: vi.fn(),
  },
  evolutionPatternMock: {
    refreshEvolutionState: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: analyticsMock.logEvent,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

vi.mock("@/lib/evolution/pattern-detection.service", () => ({
  refreshEvolutionState: evolutionPatternMock.refreshEvolutionState,
}));

import {
  acceptSkillSuggestion,
  approveSkillFormalReview,
  deferSkillFormalReview,
  dismissSkillSuggestion,
  queueSkillFormalReview,
  rejectSkillFormalReview,
  returnSkillFormalReviewForHardening,
  syncSkillSuggestions,
} from "@/lib/evolution/skill-suggestion.service";

describe("skill suggestion service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.eventLog.count.mockResolvedValue(0);
  });

  it("creates a reusable open skill suggestion from stable patterns and expires stale ones", async () => {
    dbMock.skillSuggestion.findMany.mockResolvedValue([
      { id: "stale-1", fingerprint: "workspace-1:skill-candidate:stale", status: "OPEN" },
    ]);
    dbMock.skillSuggestion.findUnique.mockResolvedValueOnce(null);
    dbMock.skillSuggestion.create.mockResolvedValue({
      id: "skill-1",
      status: "OPEN",
      fingerprint: "workspace-1:skill-candidate:meeting-followup-window-pack",
      candidateSkillKey: "meeting-followup-window-pack",
      candidateSkillName: "会后跟进窗口包",
      candidateCategory: "execution",
      candidateBoundary: "review_required",
      candidateEffectMode: "internal_write",
      candidateDefaultSurface: "meetings",
      title: "建议把“会后跟进窗口包”收成候选能力",
      reason: "你的团队在会后 24 小时内推进 follow-up 的采纳率更高。",
      confidence: 82,
      candidateSpecJson: "{}",
      evidenceSnapshot: "{\"evidenceCount\":6}",
      sourcePatternFactIds: "[\"pattern-1\"]",
      sourceRecommendationIds: null,
      nonCommitmentNote: "review-first",
    });
    dbMock.skillSuggestion.update.mockResolvedValue({ id: "stale-1" });

    await syncSkillSuggestions({
      workspaceId: "workspace-1",
      patterns: [
        {
          id: "pattern-1",
          workspaceId: "workspace-1",
          scopeType: "USER",
          scopeId: "user-1",
          patternType: "followup_timing_pattern",
          patternKey: "meeting_followup",
          patternValue: "within_24h_preferred",
          confidence: 80,
          evidenceCount: 4,
          title: "系统观察到会后 24 小时内的跟进更容易被采纳",
          summary: "你的团队在会后 24 小时内推进 follow-up 的采纳率更高。",
        },
      ],
    });

    expect(dbMock.skillSuggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace-1",
          candidateSkillKey: "meeting-followup-window-pack",
          candidateBoundary: "review_required",
          candidateEffectMode: "internal_write",
          candidateDefaultSurface: "meetings",
        }),
      }),
    );
    expect(dbMock.skillSuggestion.update).toHaveBeenCalledWith({
      where: { id: "stale-1" },
      data: { status: "EXPIRED" },
    });
  });

  it("accepts a skill suggestion into candidate capability and refreshes evolution", async () => {
    dbMock.skillSuggestion.findFirst.mockResolvedValue({
      id: "skill-1",
      workspaceId: "workspace-1",
      status: "OPEN",
      candidateSkillKey: "budget-blocker-clarification-pack",
      candidateSkillName: "预算阻碍澄清包",
      candidateCategory: "execution",
      candidateBoundary: "draft_only",
      candidateEffectMode: "draft_only",
      candidateDefaultSurface: "opportunities",
      title: "建议把“预算阻碍澄清包”收成候选能力",
      reason: "预算相关阻碍正在变成高频模式。",
      confidence: 78,
      candidateSpecJson: "{}",
      evidenceSnapshot: "{\"evidenceCount\":4}",
      nonCommitmentNote: "不会自动获得报价承诺权限。",
      appliedTargetId: null,
      appliedEffectSummary: null,
    });
    dbMock.capabilityCatalogEntry.upsert.mockResolvedValue({
      id: "cap-1",
      stage: "candidate_skill",
    });
    dbMock.skillSuggestion.update.mockResolvedValue({
      id: "skill-1",
      status: "ACCEPTED",
      title: "建议把“预算阻碍澄清包”收成候选能力",
      candidateSkillKey: "budget-blocker-clarification-pack",
      candidateBoundary: "draft_only",
      candidateEffectMode: "draft_only",
      appliedTargetType: "CapabilityCatalogEntry",
      appliedTargetId: "cap-1",
      appliedEffectSummary: "已把“预算阻碍澄清包”收口为 review-first 的 candidate capability，会继续积累证据但不会自动变成 formal skill。",
    });

    await acceptSkillSuggestion({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
    });

    expect(dbMock.capabilityCatalogEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { capabilityKey: "workspace-1:candidate-skill:budget-blocker-clarification-pack" },
        create: expect.objectContaining({
          stage: "candidate_skill",
          reviewRequired: true,
          loadPolicy: "on_demand",
        }),
      }),
    );
    expect(dbMock.notification.create).toHaveBeenCalled();
    expect(evolutionPatternMock.refreshEvolutionState).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      actorId: "user-1",
      actorType: ActorType.USER,
      sourcePage: "/settings",
      trigger: "skill_suggestion_accepted",
    });
  });

  it("promotes accepted capabilities to probationary stage when later evidence becomes strong enough", async () => {
    dbMock.skillSuggestion.findMany.mockResolvedValue([]);
    dbMock.skillSuggestion.findUnique.mockResolvedValue({
      id: "skill-1",
      workspaceId: "workspace-1",
      status: "ACCEPTED",
      fingerprint: "workspace-1:skill-candidate:meeting-followup-window-pack",
      candidateSkillKey: "meeting-followup-window-pack",
      candidateSkillName: "会后跟进窗口包",
      candidateCategory: "execution",
      candidateBoundary: "review_required",
      candidateEffectMode: "internal_write",
      candidateDefaultSurface: "meetings",
      title: "建议把“会后跟进窗口包”收成候选能力",
      reason: "你的团队在会后 24 小时内推进 follow-up 的采纳率更高。",
      confidence: 86,
      candidateSpecJson: "{}",
      evidenceSnapshot: "{\"evidenceCount\":7}",
      sourcePatternFactIds: "[\"pattern-1\"]",
      sourceRecommendationIds: null,
      nonCommitmentNote: "不会自动替人决定下一步。",
      appliedTargetId: "cap-1",
      appliedEffectSummary: "已把“会后跟进窗口包”收口为 review-first 的 candidate capability。",
    });
    dbMock.skillSuggestion.update
      .mockResolvedValueOnce({
        id: "skill-1",
        workspaceId: "workspace-1",
        status: "ACCEPTED",
        candidateSkillKey: "meeting-followup-window-pack",
        candidateSkillName: "会后跟进窗口包",
        candidateCategory: "execution",
        candidateBoundary: "review_required",
        candidateEffectMode: "internal_write",
        candidateDefaultSurface: "meetings",
        title: "建议把“会后跟进窗口包”收成候选能力",
        reason: "你的团队在会后 24 小时内推进 follow-up 的采纳率更高。",
        confidence: 88,
        candidateSpecJson: "{}",
        evidenceSnapshot: "{\"evidenceCount\":8}",
        sourcePatternFactIds: "[\"pattern-1\"]",
        sourceRecommendationIds: null,
        nonCommitmentNote: "不会自动替人决定下一步。",
        appliedTargetId: "cap-1",
        appliedEffectSummary: "已把“会后跟进窗口包”收口为 review-first 的 candidate capability。",
      })
      .mockResolvedValueOnce({ id: "skill-1" });
    dbMock.capabilityCatalogEntry.findUnique.mockResolvedValue({
      id: "cap-1",
      capabilityKey: "workspace-1:candidate-skill:meeting-followup-window-pack",
      stage: "candidate_skill",
      boundaryNote: "candidate only",
    });
    dbMock.capabilityCatalogEntry.upsert.mockResolvedValue({
      id: "cap-1",
      capabilityKey: "workspace-1:candidate-skill:meeting-followup-window-pack",
      stage: "probationary_skill",
      boundaryNote: "probationary capability",
      name: "会后跟进窗口包",
    });
    dbMock.eventLog.count.mockImplementation(async ({ where }: { where: { eventName: string | { in: string[] } } }) => {
      const eventName = where.eventName;
      if (typeof eventName === "object" && Array.isArray(eventName.in)) {
        if (eventName.in.includes("skill_suggestion_created")) {
          return 3;
        }
        if (eventName.in.includes("skill_formal_review_returned")) {
          return 0;
        }
      }
      if (eventName === "skill_suggestion_accepted") {
        return 1;
      }
      return 0;
    });

    await syncSkillSuggestions({
      workspaceId: "workspace-1",
      patterns: [
        {
          id: "pattern-1",
          workspaceId: "workspace-1",
          scopeType: "USER",
          scopeId: "user-1",
          patternType: "followup_timing_pattern",
          patternKey: "meeting_followup",
          patternValue: "within_24h_preferred",
          confidence: 86,
          evidenceCount: 8,
          title: "系统观察到会后 24 小时内的跟进更容易被采纳",
          summary: "你的团队在会后 24 小时内推进 follow-up 的采纳率更高。",
        },
      ],
    });

    expect(dbMock.capabilityCatalogEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          stage: "probationary_skill",
        }),
      }),
    );
    expect(dbMock.skillSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "skill-1" },
        data: expect.objectContaining({
          appliedEffectSummary: expect.stringContaining("观察期能力"),
        }),
      }),
    );
  });

  it("queues a calibrated probationary capability for manual formal review", async () => {
    dbMock.skillSuggestion.findFirst.mockResolvedValue({
      id: "skill-1",
      workspaceId: "workspace-1",
      status: "ACCEPTED",
      candidateSkillKey: "meeting-followup-window-pack",
      candidateSkillName: "会后跟进窗口包",
      candidateCategory: "execution",
      candidateBoundary: "review_required",
      candidateEffectMode: "internal_write",
      candidateDefaultSurface: "meetings",
      title: "建议把“会后跟进窗口包”收成候选能力",
      reason: "你的团队在会后 24 小时内推进 follow-up 的采纳率更高。",
      confidence: 90,
      candidateSpecJson: "{}",
      evidenceSnapshot: "{\"evidenceCount\":8}",
      nonCommitmentNote: "不会自动替人决定下一步。",
      appliedTargetId: "cap-1",
      appliedEffectSummary: "已把“会后跟进窗口包”提升为 probationary capability。",
      formalReviewStatus: "READY",
    });
    dbMock.eventLog.count.mockImplementation(async ({ where }: { where: { eventName: string | { in: string[] } } }) => {
      const eventName = where.eventName;
      if (typeof eventName === "object" && Array.isArray(eventName.in)) {
        if (eventName.in.includes("skill_suggestion_created")) {
          return 3;
        }
        if (eventName.in.includes("skill_formal_review_returned")) {
          return 0;
        }
      }
      if (eventName === "skill_suggestion_accepted") {
        return 1;
      }
      return 0;
    });
    dbMock.skillSuggestion.update.mockResolvedValue({
      id: "skill-1",
      formalReviewStatus: "QUEUED",
      formalReviewSummary: "“会后跟进窗口包”已进入 formal review queue。",
    });

    await queueSkillFormalReview({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
    });

    expect(dbMock.skillSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "skill-1" },
        data: expect.objectContaining({
          formalReviewStatus: "QUEUED",
          formalReviewQueuedByUserId: "user-1",
        }),
      }),
    );
    expect(dbMock.notification.create).toHaveBeenCalled();
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SKILL_FORMAL_REVIEW_QUEUED",
      }),
    );
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "skill_formal_review_queued",
      }),
    );
  });

  it("returns a queued formal review item to hardening and refreshes evolution", async () => {
    dbMock.skillSuggestion.findFirst.mockResolvedValue({
      id: "skill-1",
      workspaceId: "workspace-1",
      status: "ACCEPTED",
      candidateSkillKey: "meeting-followup-window-pack",
      candidateSkillName: "会后跟进窗口包",
      title: "建议把“会后跟进窗口包”收成候选能力",
      formalReviewStatus: "QUEUED",
    });
    dbMock.skillSuggestion.update.mockResolvedValue({
      id: "skill-1",
      formalReviewStatus: "HARDENING_REQUIRED",
    });

    await returnSkillFormalReviewForHardening({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
    });

    expect(dbMock.skillSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "skill-1" },
        data: expect.objectContaining({
          formalReviewStatus: "HARDENING_REQUIRED",
          formalReviewQueuedByUserId: null,
          formalReviewQueuedAt: null,
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SKILL_FORMAL_REVIEW_RETURNED",
      }),
    );
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "skill_formal_review_returned",
      }),
    );
    expect(evolutionPatternMock.refreshEvolutionState).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      actorId: "user-1",
      actorType: ActorType.USER,
      sourcePage: "/settings",
      trigger: "skill_formal_review_returned",
    });
  });

  it("approves a queued formal review item with a complete checklist", async () => {
    dbMock.skillSuggestion.findFirst.mockResolvedValue({
      id: "skill-1",
      workspaceId: "workspace-1",
      status: "ACCEPTED",
      candidateSkillKey: "meeting-followup-window-pack",
      candidateSkillName: "会后跟进窗口包",
      title: "建议把“会后跟进窗口包”收成候选能力",
      formalReviewStatus: "QUEUED",
    });
    dbMock.skillSuggestion.update.mockResolvedValue({
      id: "skill-1",
      formalReviewDecision: "APPROVED_PENDING_PROMOTION",
    });

    await approveSkillFormalReview({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
      reviewNote: "Static catalog patch and tests are ready.",
      checklist: {
        catalogPatchReady: true,
        testsReady: true,
        guardsReady: true,
        docsReady: true,
        boundaryConfirmed: true,
      },
    });

    expect(dbMock.skillSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "skill-1" },
        data: expect.objectContaining({
          formalReviewDecision: "APPROVED_PENDING_PROMOTION",
          formalReviewDecisionByUserId: "user-1",
          formalReviewDecisionByName: "Owner",
          formalReviewDecisionNote: "Static catalog patch and tests are ready.",
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SKILL_FORMAL_REVIEW_APPROVED",
      }),
    );
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "skill_formal_review_approved",
      }),
    );
    expect(evolutionPatternMock.refreshEvolutionState).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      actorId: "user-1",
      actorType: ActorType.USER,
      sourcePage: "/settings",
      trigger: "skill_formal_review_approved",
    });
  });

  it("defers a queued formal review item with a reviewer note", async () => {
    dbMock.skillSuggestion.findFirst.mockResolvedValue({
      id: "skill-1",
      workspaceId: "workspace-1",
      status: "ACCEPTED",
      candidateSkillKey: "meeting-followup-window-pack",
      candidateSkillName: "会后跟进窗口包",
      title: "建议把“会后跟进窗口包”收成候选能力",
      formalReviewStatus: "QUEUED",
    });
    dbMock.skillSuggestion.update.mockResolvedValue({
      id: "skill-1",
      formalReviewDecision: "DEFERRED",
    });

    await deferSkillFormalReview({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
      reviewNote: "Need a clearer formal promotion checklist for the operator handoff.",
      checklist: {
        catalogPatchReady: true,
        testsReady: false,
        guardsReady: true,
        docsReady: false,
        boundaryConfirmed: true,
      },
    });

    expect(dbMock.skillSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formalReviewDecision: "DEFERRED",
          formalReviewDecisionNote: "Need a clearer formal promotion checklist for the operator handoff.",
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SKILL_FORMAL_REVIEW_DEFERRED",
      }),
    );
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "skill_formal_review_deferred",
      }),
    );
  });

  it("rejects a queued formal review item and records the rejection note", async () => {
    dbMock.skillSuggestion.findFirst.mockResolvedValue({
      id: "skill-1",
      workspaceId: "workspace-1",
      status: "ACCEPTED",
      candidateSkillKey: "meeting-followup-window-pack",
      candidateSkillName: "会后跟进窗口包",
      title: "建议把“会后跟进窗口包”收成候选能力",
      formalReviewStatus: "QUEUED",
    });
    dbMock.skillSuggestion.update.mockResolvedValue({
      id: "skill-1",
      formalReviewDecision: "REJECTED",
    });

    await rejectSkillFormalReview({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
      reviewNote: "This pattern is still too narrow and should not enter formal promotion yet.",
      checklist: {
        catalogPatchReady: false,
        testsReady: false,
        guardsReady: false,
        docsReady: false,
        boundaryConfirmed: true,
      },
    });

    expect(dbMock.skillSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formalReviewDecision: "REJECTED",
          formalReviewDecisionNote: "This pattern is still too narrow and should not enter formal promotion yet.",
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SKILL_FORMAL_REVIEW_REJECTED",
      }),
    );
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "skill_formal_review_rejected",
      }),
    );
  });

  it("does not dismiss a non-open skill suggestion", async () => {
    dbMock.skillSuggestion.findFirst.mockResolvedValue({
      id: "skill-1",
      workspaceId: "workspace-1",
      status: "ACCEPTED",
      title: "建议把“预算阻碍澄清包”收成候选能力",
      candidateSkillKey: "budget-blocker-clarification-pack",
      candidateBoundary: "draft_only",
      candidateEffectMode: "draft_only",
    });

    const result = await dismissSkillSuggestion({
      workspaceId: "workspace-1",
      suggestionId: "skill-1",
      userId: "user-1",
      actorName: "Owner",
    });

    expect(result).toMatchObject({
      id: "skill-1",
      status: "ACCEPTED",
    });
    expect(dbMock.skillSuggestion.update).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
    expect(analyticsMock.logEvent).not.toHaveBeenCalled();
  });
});
