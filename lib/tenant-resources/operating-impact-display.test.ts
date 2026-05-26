import { describe, expect, it } from "vitest";
import type { TenantResourceOperatingImpactItem } from "@/lib/tenant-resources/operating-impact";
import {
  formatTenantResourceDecision,
  formatTenantResourceEvidenceToken,
  formatTenantResourceImpactSummary,
  formatTenantResourceNextActionMode,
  formatTenantResourceReason,
  formatTenantResourceSourceKind,
} from "@/lib/tenant-resources/operating-impact-display";

describe("tenant resource operating impact display", () => {
  it("turns capability and resource tokens into Chinese operator copy", () => {
    expect(formatTenantResourceDecision("route_to_review", false)).toBe("需资源复核");
    expect(formatTenantResourceReason("resource_freshness_unknown", false)).toBe(
      "资源新鲜度未知",
    );
    expect(formatTenantResourceNextActionMode("review_queue", false)).toBe("进入复核队列");
    expect(formatTenantResourceEvidenceToken("stale", false)).toBe("已过期");
    expect(formatTenantResourceSourceKind("import_source", false)).toBe("导入来源");
  });

  it("keeps dashboard impact summaries out of internal trace language", () => {
    const item = {
      resourceName: "HubSpot CRM",
      followThroughStatus: "stale_or_failed",
    } as TenantResourceOperatingImpactItem;

    const summary = formatTenantResourceImpactSummary(item, false);

    expect(summary).toContain("HubSpot CRM");
    expect(summary).toContain("证据需要先刷新");
    expect(summary).not.toMatch(/stale_or_failed|route_to_review|resource_freshness_unknown/);
  });
});
