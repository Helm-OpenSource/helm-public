import { describe, expect, it } from "vitest";
import { AccessState } from "@prisma/client";
import {
  getBlockedProcessingMessage,
  getLifecycleBoundarySummary,
} from "@/lib/billing/lifecycle-boundary";

describe("lifecycle boundary", () => {
  it("keeps grace and read_only viewing/export open while pausing new processing", () => {
    const grace = getLifecycleBoundarySummary(AccessState.GRACE, true);
    const readOnly = getLifecycleBoundarySummary(AccessState.READ_ONLY, false);

    expect(grace.stillAvailable).toContain("Export meeting or memory bundles");
    expect(grace.stillAvailable).toContain("Use local CSV import preview without starting external recomputation");
    expect(grace.pausedHighCostProcessing).toContain("New CRM preview recomputation");
    expect(grace.scopeNote).toContain("CRM preview here means a new import preview recomputation");

    expect(readOnly.stillAvailable).toContain("导出会议或记忆包");
    expect(readOnly.stillAvailable).toContain("使用本地 CSV 导入预演，但不触发外部重算");
    expect(readOnly.pausedHighCostProcessing).toContain("新的 CRM 预演计算");
    expect(readOnly.scopeNote).toContain("本地 CSV 导入预览继续允许");
  });

  it("keeps canceled aligned with read-first and restore-first boundary behavior", () => {
    const canceled = getLifecycleBoundarySummary(AccessState.CANCELED, true);

    expect(canceled.stillAvailable).toContain("Refresh settings and billing state");
    expect(canceled.stillAvailable).toContain("Open renew / restore from settings");
    expect(canceled.pausedHighCostProcessing).toContain("Connector sync");
    expect(canceled.scopeNote).toContain("read, export and restore paths");
  });

  it("keeps active and trialing fully open", () => {
    const trialing = getLifecycleBoundarySummary(AccessState.TRIALING, true);
    const active = getLifecycleBoundarySummary(AccessState.ACTIVE, false);

    expect(trialing.pausedHighCostProcessing).toHaveLength(0);
    expect(trialing.stillAvailable).toContain("Run the full current core product, including new processing");
    expect(active.pausedHighCostProcessing).toHaveLength(0);
    expect(active.stillAvailable).toContain("继续运行当前完整核心能力，包括新的处理动作");
  });

  it("returns operation-specific blocked messages", () => {
    expect(
      getBlockedProcessingMessage({
        state: AccessState.GRACE,
        english: true,
        operation: "CRM_PREVIEW_RECOMPUTATION",
      }),
    ).toContain("CRM preview recomputation");

    expect(
      getBlockedProcessingMessage({
        state: AccessState.READ_ONLY,
        english: false,
        operation: "CSV_IMPORT_RUN",
      }),
    ).toContain("CSV 导入执行");

    expect(
      getBlockedProcessingMessage({
        state: AccessState.CANCELED,
        english: true,
        operation: "CONNECTOR_SYNC",
      }),
    ).toContain("connector sync");
  });
});
