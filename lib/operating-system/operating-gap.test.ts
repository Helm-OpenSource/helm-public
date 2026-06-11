import { describe, expect, it } from "vitest";
import {
  buildOperatingGapQueue,
  createOperatingGapFromReconciliationResult,
  summarizeBusinessLoopGaps,
  summarizeOperatingGaps,
} from "@/lib/operating-system/operating-gap";

describe("operating gap projection", () => {
  it("projects missing owner, missing evidence, and blocked-too-long from problem spaces", () => {
    const gaps = buildOperatingGapQueue({
      workspaceId: "ws_1",
      truthConflicts: [],
      problemSpaces: [
        {
          id: "problem_1",
          workspaceId: "ws_1",
          title: "Security review chain",
          summary: "The follow-through chain is visible but no one owns it.",
          nextStep: "Assign the security owner.",
          status: "BLOCKED",
          ownerHint: null,
          evidenceRefs: [],
          href: "/meetings/meeting_1",
          updatedAt: new Date("2026-04-01T09:00:00.000Z"),
        },
      ],
      compositionFailures: [],
      now: new Date("2026-04-05T12:00:00.000Z"),
    });

    expect(gaps.map((item) => item.kind)).toEqual([
      "blocked-too-long",
      "missing-owner",
      "missing-evidence",
    ]);
    expect(gaps[0]?.severity).toBe("critical");
    expect(gaps[1]?.escalationPosture).toBe("assign-owner");
  });

  it("maps truth conflicts and composition failures into operator-facing gap kinds", () => {
    const gaps = buildOperatingGapQueue({
      workspaceId: "ws_1",
      truthConflicts: [
        {
          id: "conflict_1",
          workspaceId: "ws_1",
          summary: "CRM owner and meeting owner still disagree.",
          status: "OPEN",
          subjectKey: "ws_1:MEETING:meeting_1:owner",
          href: "/meetings/meeting_1",
          createdAt: new Date("2026-04-04T10:00:00.000Z"),
        },
      ],
      problemSpaces: [],
      compositionFailures: [
        {
          id: "failure_1",
          workspaceId: "ws_1",
          failureClass: "SIGNAL_GAP",
          summary: "Calendar source is still disconnected.",
          problemSpaceTitle: "Calendar sync",
          href: "/meetings/meeting_1",
          createdAt: new Date("2026-04-04T11:00:00.000Z"),
        },
        {
          id: "failure_2",
          workspaceId: "ws_1",
          failureClass: "TOOL_MISS",
          summary: "No safe adapter path is available yet.",
          problemSpaceTitle: "Follow-through path",
          href: "/meetings/meeting_1",
          createdAt: new Date("2026-04-04T12:00:00.000Z"),
        },
      ],
      now: new Date("2026-04-04T13:00:00.000Z"),
    });

    expect(gaps.map((item) => item.kind)).toContain("unresolved-conflict");
    expect(gaps.map((item) => item.kind)).toContain("source-not-connected");
    expect(gaps.map((item) => item.kind)).toContain("capability-gap");

    const summary = summarizeOperatingGaps(gaps);
    expect(summary.totalOpen).toBe(3);
    expect(summary.reviewRequired).toBe(3);
    expect(summary.kindCounts[0]?.count).toBeGreaterThan(0);
  });

  it("counts only critical/high-severity gaps as escalation-required (not every open gap)", () => {
    const base = {
      gapKey: "k",
      workspaceId: "ws_1",
      kind: "missing-owner" as const,
      sourceRepresentation: "problem-space" as const,
      title: "t",
      summary: "s",
      ownerHint: null,
      nextActionHint: null,
      evidenceRefs: [],
      evidenceSummary: "",
      escalationPosture: "assign-owner" as const,
      operatorReviewRequired: false,
      href: "/x",
      updatedAt: new Date("2026-04-04T13:00:00.000Z"),
    };
    const summary = summarizeOperatingGaps([
      { ...base, id: "g1", severity: "critical" },
      { ...base, id: "g2", severity: "high" },
      { ...base, id: "g3", severity: "medium" },
      { ...base, id: "g4", severity: "low" },
    ]);

    expect(summary.totalOpen).toBe(4);
    // Previously this was always equal to totalOpen (the escalationPosture
    // !== "watch" clause was dead); now it reflects real severity.
    expect(summary.escalationRequired).toBe(2);
  });

  it("projects missing-kpi-link when business-loop metrics are missing or stale", () => {
    const missingMetrics = buildOperatingGapQueue({
      workspaceId: "ws_1",
      truthConflicts: [],
      problemSpaces: [],
      compositionFailures: [],
      coordinationMetrics: null,
      now: new Date("2026-04-08T12:00:00.000Z"),
    });

    expect(missingMetrics[0]?.kind).toBe("missing-kpi-link");
    expect(missingMetrics[0]?.sourceRepresentation).toBe("coordination-metrics");
    expect(missingMetrics[0]?.severity).toBe("critical");

    const staleMetrics = buildOperatingGapQueue({
      workspaceId: "ws_1",
      truthConflicts: [],
      problemSpaces: [],
      compositionFailures: [],
      coordinationMetrics: {
        workspaceId: "ws_1",
        metricDate: new Date("2026-04-05T00:00:00.000Z"),
        href: "/reports",
      },
      now: new Date("2026-04-08T12:00:00.000Z"),
    });

    expect(staleMetrics[0]?.kind).toBe("missing-kpi-link");
    expect(staleMetrics[0]?.severity).toBe("high");
    expect(staleMetrics[0]?.summary).toContain("stale");
  });

  it("builds a business-loop gap summary without pulling in non-loop gap kinds", () => {
    const gaps = buildOperatingGapQueue({
      workspaceId: "ws_1",
      truthConflicts: [
        {
          id: "conflict_1",
          workspaceId: "ws_1",
          summary: "Owner still conflicts across meeting and CRM.",
          status: "OPEN",
          subjectKey: "ws_1:MEETING:meeting_1:owner",
          href: "/meetings/meeting_1",
          createdAt: new Date("2026-04-04T10:00:00.000Z"),
        },
      ],
      problemSpaces: [
        {
          id: "problem_1",
          workspaceId: "ws_1",
          title: "Security review chain",
          summary: "The loop is visible but still has no owner.",
          nextStep: "",
          status: "ACTIVE",
          ownerHint: null,
          evidenceRefs: [],
          href: "/meetings/meeting_1",
          updatedAt: new Date("2026-04-04T11:00:00.000Z"),
        },
      ],
      compositionFailures: [
        {
          id: "failure_1",
          workspaceId: "ws_1",
          failureClass: "SIGNAL_GAP",
          summary: "Calendar source is still disconnected.",
          problemSpaceTitle: "Calendar sync",
          href: "/meetings/meeting_1",
          createdAt: new Date("2026-04-04T12:00:00.000Z"),
        },
      ],
      coordinationMetrics: null,
      now: new Date("2026-04-08T12:00:00.000Z"),
    });

    const summary = summarizeBusinessLoopGaps(gaps);

    expect(summary.totalOpen).toBe(5);
    expect(summary.reviewRequired).toBe(5);
    expect(summary.primaryGap?.kind).toBe("missing-kpi-link");
    expect(summary.kindCounts.some((item) => item.kind === "missing-owner")).toBe(true);
    expect(summary.kindCounts.some((item) => item.kind === "missing-next-action")).toBe(true);
    expect(summary.kindCounts.some((item) => item.kind === "unresolved-conflict")).toBe(true);
    expect(summary.kindCounts.map((item) => item.kind)).not.toContain("source-not-connected");
  });

  it("wraps PR101 unresolved reconciliation output into an operating gap", () => {
    const gap = createOperatingGapFromReconciliationResult({
      workspaceId: "ws_1",
      href: "/meetings/meeting_1",
      updatedAt: new Date("2026-04-04T15:00:00.000Z"),
      result: {
        subjectKey: "ws_1:MEETING:meeting_1:owner",
        claimKey: "owner",
        outcome: "unresolved",
        resolvedValue: null,
        confidence: 42,
        operatorReviewRequired: true,
        conflictingValues: ["alice", "bob"],
        summary: "Owner still conflicts across meeting and CRM.",
        evidenceChain: [
          {
            sourceKind: "meeting",
            sourceId: "meeting_1",
            claimValue: "alice",
            summary: "Meeting note says Alice owns the next step.",
            evidenceRefs: ["meeting:1"],
            observedAt: new Date("2026-04-04T14:00:00.000Z"),
            sourceTrust: 92,
            freshness: 100,
            explicitConfidence: 88,
            score: 92,
            posture: "contested",
          },
        ],
      },
    });

    expect(gap?.kind).toBe("unresolved-conflict");
    expect(gap?.sourceRepresentation).toBe("truth-reconciliation");
    expect(gap?.severity).toBe("critical");
  });
});
