import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIT_COUNT_CAP } from "@/lib/audit/capped-count";

// The 14-day audit count on diagnostics is read through countAuditLogCapped: one capped
// `count` with an ORDER BY + LIMIT shape, surfaced as recentAuditCount plus recentAuditCountCapped.
// The first-loop adoption counts (exact, action-type filtered) are not capped.

const { auditCounts, state } = vi.hoisted(() => ({
  auditCounts: [] as Array<Record<string, unknown>>,
  state: { rawCappedCount: 0 },
}));

vi.mock("@/lib/db", () => {
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => async (args?: Record<string, unknown>) => {
          if (name === "auditLog" && method === "count") {
            auditCounts.push(args ?? {});
            return args?.take === AUDIT_COUNT_CAP + 1 ? state.rawCappedCount : 3;
          }
          if (name === "workspace" && method === "findUnique") {
            return {
              id: "workspace-1",
              name: "Atlas",
              defaultLocale: "zh-CN",
              pilotMode: true,
              featureFlagsJson: null,
              dataRetentionDays: 90,
              captureConsentRequired: true,
            };
          }
          if (method === "count") return 0;
          if (method === "findMany") return [];
          return null;
        },
      },
    );
  return { db: new Proxy({}, { get: (_target, name: string) => model(name) }) };
});
vi.mock("@/lib/evals/recommendation-evals", () => ({ getRecommendationQualityOverview: async () => null }));
vi.mock("@/lib/evals/memory-evals", () => ({ getMemoryExtractionQualityOverview: async () => null }));
vi.mock("@/lib/observability/llm-metrics.service", () => ({ getLLMOverview: async () => null }));
vi.mock("@/lib/observability/capture-metrics.service", () => ({ getCaptureObservabilityOverview: async () => null }));
vi.mock("@/lib/observability/memory-metrics.service", () => ({ getMemoryObservabilityOverview: async () => null }));

import { getDiagnosticsData } from "@/features/diagnostics/queries";

describe("diagnostics recent audit count", () => {
  beforeEach(() => {
    auditCounts.length = 0;
  });

  it("stops at the cap and says so", async () => {
    state.rawCappedCount = AUDIT_COUNT_CAP + 1;
    const data = await getDiagnosticsData("workspace-1");

    expect(data.recentAuditCount).toBe(AUDIT_COUNT_CAP);
    expect(data.recentAuditCountCapped).toBe(true);
    const capped = auditCounts.filter((args) => args.take === AUDIT_COUNT_CAP + 1);
    expect(capped).toHaveLength(1);
    expect(capped[0]).toMatchObject({
      where: { workspaceId: "workspace-1", createdAt: { gte: expect.any(Date), lte: expect.any(Date) } },
      orderBy: { createdAt: "desc" },
    });
  });

  it("reports an exact count below the cap", async () => {
    state.rawCappedCount = 37;
    const data = await getDiagnosticsData("workspace-1");

    expect(data.recentAuditCount).toBe(37);
    expect(data.recentAuditCountCapped).toBe(false);
  });

  it("leaves the first-loop adoption counts exact", async () => {
    state.rawCappedCount = 37;
    const data = await getDiagnosticsData("workspace-1");

    expect(auditCounts.filter((args) => args.take === undefined)).toHaveLength(6);
    expect(data.firstLoopAdoption.handoffEnteredCount).toBe(3);
  });
});
