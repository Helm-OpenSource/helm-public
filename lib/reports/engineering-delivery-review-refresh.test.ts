import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineeringDeliveryReview } from "@/lib/reports/engineering-delivery-review";

const { dbMock, reservedWorkspaceMock, reviewServiceMock } = vi.hoisted(() => ({
  dbMock: {
    engineeringDeliveryReviewRefreshRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    engineeringDeliveryReviewSnapshot: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  reservedWorkspaceMock: {
    resolveHelmReservedWorkspace: vi.fn(),
  },
  reviewServiceMock: {
    getEngineeringDeliveryReview: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/workspace-reserved", () => ({
  resolveHelmReservedWorkspace: reservedWorkspaceMock.resolveHelmReservedWorkspace,
}));

vi.mock("@/lib/reports/engineering-delivery-review", () => ({
  getEngineeringDeliveryReview: reviewServiceMock.getEngineeringDeliveryReview,
}));

import {
  getLatestEngineeringDeliverySnapshot,
  runEngineeringDeliveryDailyRefresh,
} from "@/lib/reports/engineering-delivery-review-refresh";

describe("engineering delivery snapshot refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    reservedWorkspaceMock.resolveHelmReservedWorkspace.mockResolvedValue({
      id: "workspace-1",
      slug: "helm-reserved",
      status: "ACTIVE",
      defaultLocale: "zh-CN",
      name: "Helm Reserved",
      workspaceClass: "HELM_RESERVED",
      systemKey: "helm_reserved_primary",
    });

    dbMock.engineeringDeliveryReviewRefreshRun.findFirst.mockResolvedValue(null);
    dbMock.engineeringDeliveryReviewRefreshRun.create.mockResolvedValue({ id: "run-1" });
    dbMock.engineeringDeliveryReviewRefreshRun.update.mockResolvedValue({});
    dbMock.engineeringDeliveryReviewSnapshot.upsert.mockResolvedValue({ id: "snapshot-1" });

    reviewServiceMock.getEngineeringDeliveryReview.mockImplementation(async ({ english }: { english?: boolean }) =>
      buildReview(Boolean(english)),
    );
  });

  it("keeps daily refresh idempotent by upserting the same daily snapshot key", async () => {
    dbMock.engineeringDeliveryReviewRefreshRun.create
      .mockResolvedValueOnce({ id: "run-1" })
      .mockResolvedValueOnce({ id: "run-2" });

    const now = new Date("2026-04-23T01:10:00.000Z");
    const first = await runEngineeringDeliveryDailyRefresh({
      now,
      timezone: "Asia/Ulaanbaatar",
      trigger: "manual",
    });
    const second = await runEngineeringDeliveryDailyRefresh({
      now,
      timezone: "Asia/Ulaanbaatar",
      trigger: "manual",
    });

    expect(first.ok).toBe(true);
    expect(first.status).toBe("SUCCESS");
    expect(second.ok).toBe(true);
    expect(second.status).toBe("SUCCESS");
    expect(dbMock.engineeringDeliveryReviewSnapshot.upsert).toHaveBeenCalledTimes(2);

    const firstKey = dbMock.engineeringDeliveryReviewSnapshot.upsert.mock.calls[0][0].where.workspaceId_snapshotDate_windowDays;
    const secondKey = dbMock.engineeringDeliveryReviewSnapshot.upsert.mock.calls[1][0].where.workspaceId_snapshotDate_windowDays;

    expect(firstKey.workspaceId).toBe("workspace-1");
    expect(secondKey.workspaceId).toBe("workspace-1");
    expect(firstKey.windowDays).toBe(28);
    expect(secondKey.windowDays).toBe(28);
    expect(firstKey.snapshotDate.toISOString()).toBe(secondKey.snapshotDate.toISOString());
  });

  it("records refresh failure and preserves existing snapshot when git review is unavailable", async () => {
    reviewServiceMock.getEngineeringDeliveryReview.mockResolvedValueOnce({
      ...buildReview(false),
      availability: "UNAVAILABLE",
    });

    const result = await runEngineeringDeliveryDailyRefresh({
      now: new Date("2026-04-23T02:00:00.000Z"),
      trigger: "manual",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(dbMock.engineeringDeliveryReviewSnapshot.upsert).not.toHaveBeenCalled();
    expect(dbMock.engineeringDeliveryReviewRefreshRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
        }),
      }),
    );
  });

  it("shows stale freshness note when today's refresh failed and page falls back to last success snapshot", async () => {
    const snapshotDate = new Date("2026-04-23T00:00:00.000Z");
    const generatedAt = new Date("2026-04-23T06:00:00.000Z");

    dbMock.engineeringDeliveryReviewSnapshot.findFirst.mockResolvedValue({
      id: "snapshot-1",
      payloadJson: JSON.stringify({
        zh: buildReview(false),
        en: buildReview(true),
      }),
      sourceRevision: "abc123",
      generatedAt,
      snapshotDate,
    });

    dbMock.engineeringDeliveryReviewRefreshRun.findFirst.mockResolvedValue({
      status: "FAILED",
      startedAt: new Date("2026-04-24T02:10:00.000Z"),
      finishedAt: new Date("2026-04-24T02:11:00.000Z"),
      errorMessage: "git unavailable",
    });

    const review = await getLatestEngineeringDeliverySnapshot({
      english: false,
      now: new Date("2026-04-24T03:00:00.000Z"),
      timezone: "Asia/Ulaanbaatar",
    });

    expect(review.availability).toBe("READY");
    expect(review.freshness?.stale).toBe(true);
    expect(review.freshness?.sourceRevision).toBe("abc123");
    expect(review.freshness?.note).toContain("今日刷新失败");
  });

  it("falls back to live review when snapshot tables are not migrated yet", async () => {
    const tableMissingError = {
      code: "P2021",
      message: "The table `engineeringdeliveryreviewsnapshot` does not exist in the current database.",
    };

    dbMock.engineeringDeliveryReviewSnapshot.findFirst.mockRejectedValueOnce(tableMissingError);
    dbMock.engineeringDeliveryReviewRefreshRun.findFirst.mockResolvedValueOnce(null);

    const review = await getLatestEngineeringDeliverySnapshot({
      english: false,
      now: new Date("2026-04-24T03:00:00.000Z"),
      timezone: "Asia/Ulaanbaatar",
    });

    expect(review.availability).toBe("READY");
    expect(review.freshness?.mode).toBe("LIVE");
    expect(review.freshness?.note).toContain("快照表尚未迁移");
    expect(reviewServiceMock.getEngineeringDeliveryReview).toHaveBeenCalled();
  });

  it("skips refresh job when snapshot tables are missing", async () => {
    const tableMissingError = {
      code: "P2021",
      message: "The table `engineeringdeliveryreviewsnapshot` does not exist in the current database.",
    };

    dbMock.engineeringDeliveryReviewSnapshot.findFirst.mockRejectedValueOnce(tableMissingError);
    dbMock.engineeringDeliveryReviewRefreshRun.findFirst.mockResolvedValueOnce(null);

    const result = await runEngineeringDeliveryDailyRefresh({
      now: new Date("2026-04-24T03:00:00.000Z"),
      trigger: "manual",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("SKIPPED");
    if (result.ok && result.status === "SKIPPED") {
      expect(result.reason).toBe("snapshot_tables_missing");
    }
    expect(dbMock.engineeringDeliveryReviewRefreshRun.create).not.toHaveBeenCalled();
  });
});

function buildReview(english: boolean): EngineeringDeliveryReview {
  return {
    availability: "READY",
    repoLabel: "helm2026-main",
    windowLabel: english ? "Last 28 days" : "最近 28 天",
    headline: english
      ? "Engineering delivery should show direction first."
      : "工程交付应该先看方向。",
    summary: english ? "snapshot summary" : "快照摘要",
    sourceNote: english ? "Source: git history" : "数据源：git 历史",
    boundaryNote: english ? "Internal review only" : "仅内部复盘",
    snapshot: {
      objectState: english ? "state" : "状态",
      blocker: english ? "blocker" : "阻塞",
      pendingDecision: english ? "decision" : "待决策",
      nextAction: english ? "next" : "下一步",
    },
    connections: [],
    contributors: [],
    collaboration: {
      summary: english ? "collaboration" : "协同",
      hotspots: [],
      risks: [],
      overlapPairs: [],
    },
    suggestions: [],
  };
}
