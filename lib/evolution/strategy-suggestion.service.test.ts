import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    workspace: {
      findUnique: vi.fn(),
    },
    policyRule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    preferenceSignal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    strategySuggestion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
  logEvent: vi.fn(),
  writeAuditLog: vi.fn(),
  recordPolicyChangedDelta: vi.fn(),
  refreshEvolutionState: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  ActionExecutionMode: {
    AUTO_WITHIN_THRESHOLD: "AUTO_WITHIN_THRESHOLD",
    FORBIDDEN: "FORBIDDEN",
    REQUIRES_APPROVAL: "REQUIRES_APPROVAL",
    SUGGEST_ONLY: "SUGGEST_ONLY",
  },
  ActionType: {
    ASSIGN_OWNER: "ASSIGN_OWNER",
    CHANGE_DUE_DATE: "CHANGE_DUE_DATE",
    CREATE_MEETING: "CREATE_MEETING",
    CREATE_TASK: "CREATE_TASK",
    DRAFT_EXTERNAL_EMAIL: "DRAFT_EXTERNAL_EMAIL",
    DRAFT_INTERNAL_NOTE: "DRAFT_INTERNAL_NOTE",
    GENERATE_REPLY_DRAFT: "GENERATE_REPLY_DRAFT",
    SCHEDULE_INTERVIEW: "SCHEDULE_INTERVIEW",
    SEND_MEETING_SUMMARY: "SEND_MEETING_SUMMARY",
    UPDATE_OPPORTUNITY_STAGE: "UPDATE_OPPORTUNITY_STAGE",
  },
  ActorType: {
    SYSTEM: "SYSTEM",
    USER: "USER",
  },
  NotificationType: {
    UPDATE: "UPDATE",
  },
  PreferenceSignalType: {
    RISK_TOLERANCE: "RISK_TOLERANCE",
    TIMING_PREFERENCE: "TIMING_PREFERENCE",
  },
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: mocks.logEvent,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/evolution/delta-event.service", () => ({
  recordPolicyChangedDelta: mocks.recordPolicyChangedDelta,
}));

vi.mock("@/lib/evolution/pattern-detection.service", () => ({
  refreshEvolutionState: mocks.refreshEvolutionState,
}));

import { ActionExecutionMode, ActionType } from "@prisma/client";
import {
  acceptStrategySuggestion,
  syncStrategySuggestions,
} from "@/lib/evolution/strategy-suggestion.service";

const han = /[\u3400-\u9fff]/u;

function makeApprovalPattern(summary: string | null = "中文 pattern 摘要") {
  return {
    id: "pattern-1",
    workspaceId: "workspace-1",
    scopeType: "workspace",
    scopeId: null,
    patternType: "approval_pattern",
    patternKey: "external_approval",
    patternValue: "review_first",
    confidence: 72,
    evidenceCount: 5,
    title: null,
    summary,
  };
}

describe("strategy suggestion localization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.workspace.findUnique.mockResolvedValue({
      defaultLocale: "en-US",
    });
    mocks.db.policyRule.findMany.mockResolvedValue([
      {
        id: "policy-1",
        actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
        mode: ActionExecutionMode.SUGGEST_ONLY,
      },
    ]);
    mocks.db.policyRule.findFirst.mockResolvedValue(null);
    mocks.db.policyRule.create.mockImplementation(async ({ data }) => ({
      id: "policy-created-1",
      ...data,
    }));
    mocks.db.preferenceSignal.findMany.mockResolvedValue([]);
    mocks.db.preferenceSignal.findFirst.mockResolvedValue(null);
    mocks.db.preferenceSignal.create.mockImplementation(async ({ data }) => ({
      id: "signal-1",
      ...data,
    }));
    mocks.db.strategySuggestion.findMany.mockResolvedValue([]);
    mocks.db.strategySuggestion.findUnique.mockResolvedValue(null);
    mocks.db.strategySuggestion.findFirst.mockResolvedValue(null);
    mocks.db.strategySuggestion.create.mockImplementation(async ({ data }) => ({
      id: "suggestion-1",
      status: "OPEN",
      ...data,
    }));
    mocks.db.strategySuggestion.update.mockImplementation(async ({ data }) => ({
      id: "suggestion-1",
      status: data.status ?? "OPEN",
      title: "Suggest switching Draft external email back to per-action approval",
      suggestionType: "POLICY_MODE_CHANGE",
      targetPolicyKey: ActionType.DRAFT_EXTERNAL_EMAIL,
      currentValue: ActionExecutionMode.SUGGEST_ONLY,
      suggestedValue: ActionExecutionMode.REQUIRES_APPROVAL,
      appliedTargetType: data.appliedTargetType,
      appliedTargetId: data.appliedTargetId,
      appliedEffectSummary: data.appliedEffectSummary,
      ...data,
    }));
  });

  it("stores English strategy suggestion copy for English workspaces", async () => {
    const suggestions = await syncStrategySuggestions({
      workspaceId: "workspace-1",
      patterns: [makeApprovalPattern()],
    });

    expect(suggestions).toHaveLength(1);
    const created = mocks.db.strategySuggestion.create.mock.calls[0][0].data;
    expect(created.title).toBe(
      "Suggest switching Draft external email back to per-action approval",
    );
    expect(created.reason).toContain("human approval");
    expect(`${created.title} ${created.reason}`).not.toMatch(han);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: created.title,
      }),
    );
  });

  it("localizes accepted strategy suggestion effects and audit summaries", async () => {
    const suggestion = {
      id: "suggestion-1",
      status: "OPEN",
      title: "Suggest switching Draft external email back to per-action approval",
      suggestionType: "POLICY_MODE_CHANGE",
      targetPolicyKey: ActionType.DRAFT_EXTERNAL_EMAIL,
      currentValue: ActionExecutionMode.SUGGEST_ONLY,
      suggestedValue: ActionExecutionMode.REQUIRES_APPROVAL,
    };
    mocks.db.strategySuggestion.findFirst.mockResolvedValue(suggestion);

    await acceptStrategySuggestion({
      workspaceId: "workspace-1",
      suggestionId: "suggestion-1",
      userId: "user-1",
      actorName: "Reviewer",
    });

    const createdPolicy = mocks.db.policyRule.create.mock.calls[0][0].data;
    expect(createdPolicy.name).toBe("Draft external email policy");
    expect(createdPolicy.description).toContain("External wording");

    const notification = mocks.db.notification.create.mock.calls[0][0].data;
    expect(notification.title).toBe(
      "Strategy suggestion converged into a system rule",
    );
    expect(notification.body).toBe(
      'Updated the default Draft external email policy to "Requires approval"',
    );

    const audit = mocks.writeAuditLog.mock.calls.at(-1)?.[0];
    expect(audit.summary).toBe(
      "Accepted strategy suggestion: Suggest switching Draft external email back to per-action approval",
    );
    expect(
      `${createdPolicy.name} ${createdPolicy.description} ${notification.title} ${notification.body} ${audit.summary}`,
    ).not.toMatch(han);
  });
});
