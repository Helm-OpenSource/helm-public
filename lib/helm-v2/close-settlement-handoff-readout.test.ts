import { describe, expect, it } from "vitest";
import { buildCloseSettlementHandoffReadout } from "@/lib/helm-v2/close-settlement-handoff-readout";

describe("buildCloseSettlementHandoffReadout", () => {
  it("keeps settlement review, closeout, and close-request provenance explicit", () => {
    const readout = buildCloseSettlementHandoffReadout({
      settlementFlow: {
        state: "review_open",
        driver: "settlement_review",
        summary: "Settlement flow stays open until bounded operator review is resolved.",
        boundaryNote: "Review-first only.",
        latestUpdatedAt: new Date("2026-04-22T05:20:00.000Z"),
        currentOwner: "operator@demo.com",
        checkpointKey: "checkpoint::alpha",
        nextAction: "Resolve settlement review before requesting close.",
        forwardAttentionCount: 1,
        openCloseoutCount: 1,
        resolvedCloseoutCount: 0,
      },
      settlementReview: {
        state: "requested",
        summary: "Settlement review is waiting for explicit operator resolution.",
        boundaryNote: "Manual review only.",
        requestEventId: "settlement_request_1",
        resolutionEventId: null,
        checkpointId: "checkpoint_1",
        checkpointKey: "checkpoint::alpha",
        resumeToken: "resume::alpha",
        nextAction: "Resolve settlement review.",
        requestedAt: new Date("2026-04-22T05:18:00.000Z"),
        resolvedAt: null,
        requestedBy: "operator@demo.com",
        resolvedBy: null,
        sourcePage: "/operating",
      },
      closeoutConfirmation: {
        state: "confirmable",
        summary: "Closeout truth can be confirmed after settlement review is resolved.",
        boundaryNote: "Confirm only after explicit review.",
        confirmationEventId: null,
        settlementReviewResolutionEventId: null,
        checkpointId: "checkpoint_1",
        checkpointKey: "checkpoint::alpha",
        resumeToken: "resume::alpha",
        nextAction: "Confirm closeout truth after review.",
        confirmedAt: null,
        confirmedBy: null,
        sourcePage: "/meetings/meeting_alpha",
      },
      closeoutRefresh: {
        state: "not_requestable",
        summary: "No stale closeout refresh is open.",
        boundaryNote: "Refresh stays manual.",
        requestEventId: null,
        confirmationEventId: null,
        checkpointId: null,
        checkpointKey: "checkpoint::alpha",
        resumeToken: null,
        nextAction: null,
        requestedAt: null,
        resolvedAt: null,
        requestedBy: null,
        sourcePage: null,
      },
      closeRequest: {
        state: "requestable",
        summary: "Thread close can be requested once closeout follow-through stays current.",
        boundaryNote: "Close remains review-first.",
        requestEventId: null,
        closeoutResolutionEventId: "close_resolution_1",
        closeoutResolutionFollowThroughEventId: "close_followthrough_1",
        checkpointId: "checkpoint_1",
        checkpointKey: "checkpoint::alpha",
        resumeToken: "resume::alpha",
        nextAction: "Request thread close after confirming the handoff.",
        requestedAt: null,
        resolvedAt: null,
        requestedBy: null,
        sourcePage: "/meetings/meeting_alpha",
      },
    });

    expect(readout.compactSummary).toContain("settlement review_open");
    expect(readout.compactSummary).toContain("review requested");
    expect(readout.compactSummary).toContain("close requestable");
    expect(readout.settlementSummary).toContain("requested by operator@demo.com");
    expect(readout.closeoutSummary).toContain("Closeout truth can be confirmed");
    expect(readout.closeRequestSummary).toContain("Thread close can be requested");
    expect(readout.provenanceSummary).toContain("review /operating");
    expect(readout.provenanceSummary).toContain("confirmation /meetings/meeting_alpha");
    expect(readout.focusTitle).toBe("settlement review");
    expect(readout.focusSectionId).toBe("run-thread-settlement-review");
  });

  it("falls back to close request focus when review and closeout follow-through are already settled", () => {
    const readout = buildCloseSettlementHandoffReadout({
      settlementFlow: {
        state: "ready_to_close",
        driver: "settlement_review",
        summary: "Settlement flow is ready to request close.",
        boundaryNote: "Manual only.",
        latestUpdatedAt: new Date("2026-04-22T06:10:00.000Z"),
        currentOwner: "operator@demo.com",
        checkpointKey: "checkpoint::beta",
        nextAction: "Request close if the thread should be closed.",
        forwardAttentionCount: 0,
        openCloseoutCount: 0,
        resolvedCloseoutCount: 1,
      },
      settlementReview: {
        state: "resolved",
        summary: "Settlement review was resolved.",
        boundaryNote: "Review-first only.",
        requestEventId: "settlement_request_2",
        resolutionEventId: "settlement_resolution_2",
        checkpointId: "checkpoint_2",
        checkpointKey: "checkpoint::beta",
        resumeToken: "resume::beta",
        nextAction: null,
        requestedAt: new Date("2026-04-22T06:00:00.000Z"),
        resolvedAt: new Date("2026-04-22T06:05:00.000Z"),
        requestedBy: "operator@demo.com",
        resolvedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_beta",
      },
      closeoutConfirmation: {
        state: "confirmed",
        summary: "Closeout truth has already been confirmed.",
        boundaryNote: "Confirmed truth stays review-first.",
        confirmationEventId: "confirm_2",
        settlementReviewResolutionEventId: "settlement_resolution_2",
        checkpointId: "checkpoint_2",
        checkpointKey: "checkpoint::beta",
        resumeToken: "resume::beta",
        nextAction: null,
        confirmedAt: new Date("2026-04-22T06:06:00.000Z"),
        confirmedBy: "founder@demo.com",
        sourcePage: "/meetings/meeting_beta",
      },
      closeoutRefresh: {
        state: "resolved",
        summary: "No refresh is currently open.",
        boundaryNote: "Refresh stays bounded.",
        requestEventId: "refresh_request_2",
        confirmationEventId: "confirm_2",
        checkpointId: "checkpoint_2",
        checkpointKey: "checkpoint::beta",
        resumeToken: "resume::beta",
        nextAction: null,
        requestedAt: new Date("2026-04-22T06:07:00.000Z"),
        resolvedAt: new Date("2026-04-22T06:08:00.000Z"),
        requestedBy: "operator@demo.com",
        sourcePage: "/operating",
      },
      closeRequest: {
        state: "requestable",
        summary: "Thread close can be requested now.",
        boundaryNote: "Still manual and review-first.",
        requestEventId: null,
        closeoutResolutionEventId: "close_resolution_2",
        closeoutResolutionFollowThroughEventId: "close_followthrough_2",
        checkpointId: "checkpoint_2",
        checkpointKey: "checkpoint::beta",
        resumeToken: "resume::beta",
        nextAction: "Request close.",
        requestedAt: null,
        resolvedAt: null,
        requestedBy: null,
        sourcePage: "/operating",
      },
    });

    expect(readout.focusTitle).toBe("close request");
    expect(readout.focusSectionId).toBe("run-thread-close-request");
    expect(readout.provenanceSummary).toContain("close /operating");
    expect(readout.compactSummary).toContain("confirm confirmed");
    expect(readout.compactSummary).toContain("close requestable");
  });
});
