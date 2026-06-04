import { describe, expect, it } from "vitest";
import {
  formatAuthControlConsistencyOverview,
  formatLatestAuthAnomalyFollowThroughSummary,
  formatLatestMarkerCoverageSummary,
  formatRevokeExecutionAggregateSummary,
} from "@/features/settings/formatters/auth-session-formatters";

const sampleDate = new Date(2026, 3, 15, 10, 30);
const followThroughDate = new Date(2026, 3, 16, 11, 45);

describe("auth session formatters", () => {
  it("renders auth control overview dates in the selected locale", () => {
    const english = formatAuthControlConsistencyOverview(
      {
        consistencyStatus: "DRIFT",
        followThroughStatus: "PENDING",
        reviewOnlyScopeCount: 1,
        bulkRevocableScopeCount: 2,
        driftScopeCount: 3,
        currentSessionProtectedScopeCount: 1,
        latestDetectedAt: sampleDate,
        latestMarkerScopeCount: 2,
        latestFollowThroughActionType: "review_packet_created",
        latestFollowThroughRecordedAt: followThroughDate,
        latestFollowThroughSourcePage: "/settings?tab=governance",
      },
      true,
    );

    expect(english).toContain("latest anomaly Apr 15 10:30");
    expect(english).toContain("recorded Apr 16 11:45");
    expect(english).not.toMatch(/[月日]|最近异常|记录于/);

    const chinese = formatAuthControlConsistencyOverview(
      {
        consistencyStatus: "DRIFT",
        followThroughStatus: "PENDING",
        reviewOnlyScopeCount: 1,
        bulkRevocableScopeCount: 2,
        driftScopeCount: 3,
        currentSessionProtectedScopeCount: 1,
        latestDetectedAt: sampleDate,
        latestMarkerScopeCount: 2,
        latestFollowThroughActionType: "review_packet_created",
        latestFollowThroughRecordedAt: followThroughDate,
        latestFollowThroughSourcePage: "/settings?tab=governance",
      },
      false,
    );

    expect(chinese).toContain("最近异常 04月15日 10:30");
    expect(chinese).toContain("记录于 04月16日 11:45");
  });

  it("renders follow-through and marker coverage dates in English", () => {
    const followThrough = formatLatestAuthAnomalyFollowThroughSummary(
      {
        status: "ACTIONABLE",
        followThroughStatus: "CURRENT",
        reviewOnlyScopeCount: 0,
        bulkRevocableScopeCount: 2,
        driftScopeCount: 1,
        currentSessionProtectedScopeCount: 0,
        latestMarkerRecordedAt: sampleDate,
        latestMarkerScopeCount: 2,
        latestFollowThroughActionType: "bulk_revoke_reviewed",
        latestFollowThroughRecordedAt: followThroughDate,
        latestFollowThroughSourcePage: "/settings?tab=security",
      },
      true,
    );

    expect(followThrough).toContain("latest marker Apr 15 10:30");
    expect(followThrough).toContain("recorded Apr 16 11:45");
    expect(followThrough).not.toMatch(/[月日]|最近标记|记录于/);

    const coverage = formatLatestMarkerCoverageSummary(
      {
        status: "REVIEW_ONLY",
        followThroughStatus: "STALE",
        stillDetectedScopeCount: 1,
        resolvedScopeCount: 2,
        newlyDetectedScopeCount: 3,
        reviewOnlyScopeCount: 1,
        bulkRevocableScopeCount: 0,
        driftScopeCount: 1,
        currentSessionProtectedScopeCount: 1,
        latestMarkerRecordedAt: sampleDate,
        latestMarkerScopeCount: 1,
        latestFollowThroughActionType: "owner_review_requested",
        latestFollowThroughRecordedAt: followThroughDate,
        latestFollowThroughSourcePage: "/settings?tab=security",
      },
      true,
    );

    expect(coverage).toContain("latest marker Apr 15 10:30");
    expect(coverage).toContain("recorded Apr 16 11:45");
    expect(coverage).not.toMatch(/[月日]|最近标记|记录于/);
  });

  it("renders revoke execution dates in English", () => {
    const rendered = formatRevokeExecutionAggregateSummary(
      {
        status: "ACTIONABLE",
        liveEligibleSessionCount: 4,
        lastExecutedEligibleSessionCount: 3,
        lastExecutedRevokedSessionCount: 2,
        executionShortfallCount: 1,
        previewEligibleDeltaCount: 1,
        reviewOnlyScopeCount: 0,
        bulkRevocableScopeCount: 2,
        driftScopeCount: 1,
        currentSessionProtectedScopeCount: 0,
        latestExecutedAt: sampleDate,
      },
      true,
    );

    expect(rendered).toContain("latest executed Apr 15 10:30");
    expect(rendered).not.toMatch(/[月日]|最近执行于/);
  });
});
