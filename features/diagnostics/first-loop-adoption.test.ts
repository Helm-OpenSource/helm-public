import { describe, expect, it } from "vitest";
import {
  FIRST_LOOP_ANCHOR_RESUMED_ACTION,
  FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
  FIRST_LOOP_REVIEW_COMPLETED_PROXY_ACTION,
  FIRST_LOOP_RETURN_ANCHOR_ACTION,
  FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
  FIRST_LOOP_WRITE_BACK_COMPLETED_PROXY_ACTION,
} from "@/lib/operating-system";
import {
  buildFirstLoopAdoptionReadout,
  buildFirstLoopAdoptionUserSummaries,
} from "@/features/diagnostics/first-loop-adoption";

describe("buildFirstLoopAdoptionUserSummaries", () => {
  it("aggregates first-loop adoption events by user and derives posture", () => {
    const summaries = buildFirstLoopAdoptionUserSummaries({
      currentUserId: "user-1",
      events: [
        {
          userId: "user-2",
          actor: "Teammate",
          actionType: FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
          createdAt: new Date("2026-04-13T09:00:00.000Z"),
        },
        {
          userId: "user-1",
          actor: "Owner",
          actionType: FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
          createdAt: new Date("2026-04-13T10:00:00.000Z"),
        },
        {
          userId: "user-1",
          actor: "Owner",
          actionType: FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
          createdAt: new Date("2026-04-13T10:05:00.000Z"),
        },
        {
          userId: "user-1",
          actor: "Owner",
          actionType: FIRST_LOOP_RETURN_ANCHOR_ACTION,
          createdAt: new Date("2026-04-13T10:10:00.000Z"),
        },
        {
          userId: "user-1",
          actor: "Owner",
          actionType: FIRST_LOOP_ANCHOR_RESUMED_ACTION,
          createdAt: new Date("2026-04-13T10:15:00.000Z"),
        },
        {
          userId: "user-1",
          actor: "Owner",
          actionType: FIRST_LOOP_REVIEW_COMPLETED_PROXY_ACTION,
          createdAt: new Date("2026-04-13T10:20:00.000Z"),
        },
        {
          userId: "user-1",
          actor: "Owner",
          actionType: FIRST_LOOP_WRITE_BACK_COMPLETED_PROXY_ACTION,
          createdAt: new Date("2026-04-13T10:25:00.000Z"),
        },
      ],
    });

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      userId: "user-1",
      actor: "Owner",
      isCurrentUser: true,
      handoffEnteredCount: 1,
      primaryActionOpenedCount: 1,
      anchorSavedCount: 1,
      anchorResumedCount: 1,
      reviewCompletedCount: 1,
      writeBackConfirmedCount: 1,
      totalCount: 6,
      posture: "closed-loop",
    });
    expect(summaries[1]).toMatchObject({
      userId: "user-2",
      actor: "Teammate",
      posture: "handoff-only",
      totalCount: 1,
    });
  });

  it("keeps only tracked users, sorts by current user and total activity, and respects limit", () => {
    const summaries = buildFirstLoopAdoptionUserSummaries({
      currentUserId: "user-9",
      limit: 2,
      events: [
        {
          userId: null,
          actor: "System",
          actionType: FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
          createdAt: new Date("2026-04-13T08:00:00.000Z"),
        },
        {
          userId: "user-2",
          actor: "Teammate B",
          actionType: FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
          createdAt: new Date("2026-04-13T09:00:00.000Z"),
        },
        {
          userId: "user-3",
          actor: "Teammate C",
          actionType: FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
          createdAt: new Date("2026-04-13T09:30:00.000Z"),
        },
        {
          userId: "user-3",
          actor: "Teammate C",
          actionType: FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
          createdAt: new Date("2026-04-13T09:45:00.000Z"),
        },
        {
          userId: "user-3",
          actor: "Teammate C",
          actionType: FIRST_LOOP_REVIEW_COMPLETED_PROXY_ACTION,
          createdAt: new Date("2026-04-13T09:50:00.000Z"),
        },
        {
          userId: "user-9",
          actor: "Current User",
          actionType: FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
          createdAt: new Date("2026-04-13T10:00:00.000Z"),
        },
      ],
    });

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      userId: "user-9",
      isCurrentUser: true,
      totalCount: 1,
    });
    expect(summaries[1]).toMatchObject({
      userId: "user-3",
      totalCount: 3,
      reviewCompletedCount: 1,
      posture: "reviewed",
    });
  });

  it("keeps return behavior distinct when the user resumed work but did not finish review or write-back", () => {
    const summaries = buildFirstLoopAdoptionUserSummaries({
      events: [
        {
          userId: "user-4",
          actor: "Teammate D",
          actionType: FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
          createdAt: new Date("2026-04-13T09:00:00.000Z"),
        },
        {
          userId: "user-4",
          actor: "Teammate D",
          actionType: FIRST_LOOP_RETURN_ANCHOR_ACTION,
          createdAt: new Date("2026-04-13T09:10:00.000Z"),
        },
        {
          userId: "user-4",
          actor: "Teammate D",
          actionType: FIRST_LOOP_ANCHOR_RESUMED_ACTION,
          createdAt: new Date("2026-04-13T09:15:00.000Z"),
        },
      ],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      userId: "user-4",
      anchorSavedCount: 1,
      anchorResumedCount: 1,
      reviewCompletedCount: 0,
      writeBackConfirmedCount: 0,
      posture: "returning",
    });
  });

  it("derives a review-gap readout when action opens exist but review does not", () => {
    const readout = buildFirstLoopAdoptionReadout({
      english: true,
      adoption: {
        handoffEnteredCount: 2,
        primaryActionOpenedCount: 1,
        anchorSavedCount: 1,
        anchorResumedCount: 1,
        reviewCompletedCount: 0,
        writeBackConfirmedCount: 0,
        byUser: [
          {
            userId: "user-1",
            actor: "Owner",
            isCurrentUser: true,
            handoffEnteredCount: 1,
            primaryActionOpenedCount: 1,
            anchorSavedCount: 1,
            anchorResumedCount: 0,
            reviewCompletedCount: 0,
            writeBackConfirmedCount: 0,
            totalCount: 3,
            posture: "active",
            lastTouchedAt: new Date("2026-04-13T10:25:00.000Z"),
          },
        ],
      },
    });

    expect(readout).toMatchObject({
      stage: "review",
      status: "ready",
      stageLabel: "Review still missing",
      connectionValue: "2 opens-resumes / 0 reviews",
    });
    expect(readout.currentUserLine).toContain("opened the first move");
    expect(readout.proofNote).toContain("audit-backed");
  });

  it("derives a write-back gap when review exists but memory confirmation is still missing", () => {
    const readout = buildFirstLoopAdoptionReadout({
      english: true,
      adoption: {
        handoffEnteredCount: 3,
        primaryActionOpenedCount: 2,
        anchorSavedCount: 1,
        anchorResumedCount: 1,
        reviewCompletedCount: 2,
        writeBackConfirmedCount: 0,
        byUser: [
          {
            userId: "user-1",
            actor: "Owner",
            isCurrentUser: true,
            handoffEnteredCount: 1,
            primaryActionOpenedCount: 1,
            anchorSavedCount: 0,
            anchorResumedCount: 0,
            reviewCompletedCount: 1,
            writeBackConfirmedCount: 0,
            totalCount: 2,
            posture: "reviewed",
            lastTouchedAt: new Date("2026-04-13T10:25:00.000Z"),
          },
        ],
      },
    });

    expect(readout).toMatchObject({
      stage: "write-back",
      status: "ready",
      stageLabel: "Write-back still missing",
      connectionValue: "2 reviews / 0 write-backs",
    });
    expect(readout.nextAttention).toContain("write-back");
  });

  it("marks the loop as closed when confirmed write-back exists", () => {
    const readout = buildFirstLoopAdoptionReadout({
      english: true,
      adoption: {
        handoffEnteredCount: 4,
        primaryActionOpenedCount: 3,
        anchorSavedCount: 2,
        anchorResumedCount: 2,
        reviewCompletedCount: 2,
        writeBackConfirmedCount: 1,
        byUser: [
          {
            userId: "user-1",
            actor: "Owner",
            isCurrentUser: true,
            handoffEnteredCount: 1,
            primaryActionOpenedCount: 1,
            anchorSavedCount: 1,
            anchorResumedCount: 1,
            reviewCompletedCount: 1,
            writeBackConfirmedCount: 1,
            totalCount: 5,
            posture: "closed-loop",
            lastTouchedAt: new Date("2026-04-13T10:25:00.000Z"),
          },
        ],
      },
    });

    expect(readout).toMatchObject({
      stage: "closed-loop",
      status: "done",
      stageLabel: "Review + write-back reached",
      connectionValue: "2 reviews / 1 write-backs",
    });
    expect(readout.currentUserLine).toContain("review + write-back");
  });
});
