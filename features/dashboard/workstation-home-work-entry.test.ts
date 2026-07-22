import { describe, expect, it } from "vitest";
import type { DashboardHomeWorkEntryModel } from "@/features/dashboard/home-work-entry";
import { routeWorkEntryToWorkstation } from "@/features/dashboard/workstation-home-work-entry";

function model(): DashboardHomeWorkEntryModel {
  const generic = {
    id: "generic-approval",
    title: "通用经营审批",
    subject: "跨角色事项",
    statusLabel: "待复核",
    nextStep: "打开通用审批。",
    boundary: "人工确认。",
    href: "/approvals",
    ctaLabel: "现在复核",
  };
  return {
    canReviewGovernedActions: true,
    state: "review-heavy",
    title: "现在最该先进入的是复核。",
    summary: "通用复核压力。",
    topWorkItems: [generic],
    reviewItems: [generic],
    reviewItemsArePrimary: true,
    assignmentItems: [],
    resumeItem: generic,
    blockerItems: [],
    roleAnomalyItems: [],
  };
}

describe("routeWorkEntryToWorkstation", () => {
  it("replaces cross-role primary work with the bound role workstation", () => {
    const result = routeWorkEntryToWorkstation({
      model: model(),
      workstation: {
        key: "collection-seat",
        href: "/anson/seat-desk",
        label: "催收坐席工位",
      },
      english: false,
    });

    expect(result.topWorkItems.map((item) => item.id)).toEqual([
      "role-workstation:collection-seat",
    ]);
    expect(result.topWorkItems[0]).toMatchObject({
      href: "/anson/seat-desk",
      ctaLabel: "打开工位",
    });
    expect(result.reviewItems).toHaveLength(1);
    expect(result.reviewItemsArePrimary).toBe(false);
    expect(result.showCrossRoleReviewQueue).toBe(false);
  });

  it("keeps the cross-role review queue only for an explicitly responsible workstation", () => {
    const result = routeWorkEntryToWorkstation({
      model: model(),
      workstation: {
        key: "control-tower",
        href: "/anson/home",
        label: "控制塔（原生）",
        showCrossRoleReviewQueue: true,
      },
      english: false,
    });

    expect(result.showCrossRoleReviewQueue).toBe(true);
  });

  it("keeps routed anomalies ahead of the workstation and retains a role entry", () => {
    const base = model();
    const anomalies = ["critical", "warning", "third"].map((key) => ({
      ...base.topWorkItems[0]!,
      id: `system-anomaly:${key}`,
      title: key,
      href: `/diagnostics?e=${key}`,
    }));
    const result = routeWorkEntryToWorkstation({
      model: { ...base, roleAnomalyItems: anomalies },
      workstation: {
        key: "quality-review",
        href: "/reports?tab=qc-queue",
        label: "质检与合规工位",
      },
      english: false,
    });

    expect(result.topWorkItems.map((item) => item.id)).toEqual([
      "system-anomaly:critical",
      "system-anomaly:warning",
      "role-workstation:quality-review",
    ]);
    expect(result.title).toContain("异常");
  });
});
