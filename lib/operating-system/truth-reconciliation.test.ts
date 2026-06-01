import { ObjectType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  createCrmTruthSignal,
  createEmailTruthSignal,
  createMeetingTruthSignal,
  createReportTruthSignal,
  reconcileTruthSignals,
} from "@/lib/operating-system";

const subject = {
  workspaceId: "workspace-demo",
  objectType: ObjectType.OPPORTUNITY,
  objectId: "opp-acme",
  claimKey: "operating-posture",
} as const;

describe("truth reconciliation", () => {
  it("resolves one leading truth when meeting and email converge over a stale report", () => {
    const now = new Date("2026-04-08T12:00:00.000Z");
    const result = reconcileTruthSignals({
      subject,
      now,
      signals: [
        createMeetingTruthSignal({
          sourceId: "meeting-1",
          subject,
          claimValue: "blocked",
          summary: "会议里确认采购流程没有完成，当前推进被卡住。",
          observedAt: new Date("2026-04-08T10:00:00.000Z"),
          explicitConfidence: 88,
          evidenceRefs: ["meeting:meeting-1"],
        }),
        createEmailTruthSignal({
          sourceId: "thread-1",
          subject,
          claimValue: "blocked",
          summary: "邮件线程里客户仍在等内部预算确认。",
          observedAt: new Date("2026-04-08T09:00:00.000Z"),
          explicitConfidence: 82,
          evidenceRefs: ["email-thread:thread-1"],
        }),
        createReportTruthSignal({
          sourceId: "report-1",
          subject,
          claimValue: "healthy",
          summary: "周报还沿用了上周的健康状态。",
          observedAt: new Date("2026-03-30T09:00:00.000Z"),
          explicitConfidence: 54,
          evidenceRefs: ["weekly-report:report-1"],
        }),
      ],
    });

    expect(result.outcome).toBe("resolved");
    expect(result.resolvedValue).toBe("blocked");
    expect(result.operatorReviewRequired).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(80);
    expect(result.evidenceChain[0]).toEqual(
      expect.objectContaining({
        sourceKind: "meeting",
        posture: "supporting",
      }),
    );
  });

  it("keeps close multi-source disagreement unresolved and review-required", () => {
    const now = new Date("2026-04-08T12:00:00.000Z");
    const result = reconcileTruthSignals({
      subject,
      now,
      signals: [
        createMeetingTruthSignal({
          sourceId: "meeting-2",
          subject,
          claimValue: "blocked",
          summary: "会议里记录采购和预算都还没锁定。",
          observedAt: new Date("2026-04-08T08:00:00.000Z"),
          explicitConfidence: 84,
          evidenceRefs: ["meeting:meeting-2"],
        }),
        createCrmTruthSignal({
          sourceId: "crm-run-1",
          subject,
          claimValue: "healthy",
          summary: "CRM 里机会阶段仍被标成正常推进。",
          observedAt: new Date("2026-04-08T07:00:00.000Z"),
          explicitConfidence: 83,
          evidenceRefs: ["crm-import:crm-run-1"],
        }),
        createReportTruthSignal({
          sourceId: "report-2",
          subject,
          claimValue: "healthy",
          summary: "周报里还没有吸收最新会议信号。",
          observedAt: new Date("2026-04-08T06:00:00.000Z"),
          explicitConfidence: 80,
          evidenceRefs: ["weekly-report:report-2"],
        }),
      ],
    });

    expect(result.outcome).toBe("unresolved");
    expect(result.resolvedValue).toBeNull();
    expect(result.operatorReviewRequired).toBe(true);
    expect(result.conflictingValues).toContain("healthy");
    expect(result.summary).toContain("不能静默收敛");
    expect(result.evidenceChain.every((item) => item.posture === "contested")).toBe(
      true,
    );
  });

  it("normalizes source-specific builders into the same subject key", () => {
    const meeting = createMeetingTruthSignal({
      sourceId: "meeting-3",
      subject,
      claimValue: "needs-follow-up",
      summary: "会后需要继续跟进。",
      observedAt: new Date("2026-04-08T10:00:00.000Z"),
      evidenceRefs: [],
    });
    const email = createEmailTruthSignal({
      sourceId: "thread-3",
      subject,
      claimValue: "needs-follow-up",
      summary: "邮件里还在等我方回复。",
      observedAt: new Date("2026-04-08T09:30:00.000Z"),
      evidenceRefs: [],
    });

    expect(meeting.evidenceRefs).toEqual(["meeting:meeting-3"]);
    expect(email.evidenceRefs).toEqual(["email:thread-3"]);

    const result = reconcileTruthSignals({
      subject,
      now: new Date("2026-04-08T12:00:00.000Z"),
      signals: [meeting, email],
    });

    expect(result.subjectKey).toBe(
      "workspace-demo:OPPORTUNITY:opp-acme:operating-posture",
    );
    expect(result.outcome).toBe("resolved");
  });

  it("rejects subject drift instead of quietly merging different claim scopes", () => {
    const driftedSubject = {
      ...subject,
      claimKey: "next-step",
    };

    expect(() =>
      reconcileTruthSignals({
        subject,
        now: new Date("2026-04-08T12:00:00.000Z"),
        signals: [
          createMeetingTruthSignal({
            sourceId: "meeting-4",
            subject,
            claimValue: "blocked",
            summary: "当前仍 blocked。",
            observedAt: new Date("2026-04-08T11:00:00.000Z"),
            evidenceRefs: ["meeting:meeting-4"],
          }),
          createEmailTruthSignal({
            sourceId: "thread-4",
            subject: driftedSubject,
            claimValue: "send-proposal",
            summary: "邮件里建议直接发方案。",
            observedAt: new Date("2026-04-08T10:00:00.000Z"),
            evidenceRefs: ["email-thread:thread-4"],
          }),
        ],
      }),
    ).toThrow(/subject drifted/i);
  });
});
