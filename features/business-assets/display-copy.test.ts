import { describe, expect, it } from "vitest";
import {
  buildBusinessAssetEmptyCopy,
  buildBusinessAssetJudgementChain,
  formatBusinessAssetTypeLabel,
} from "@/features/business-assets/display-copy";
import {
  buildBusinessAssetHref,
  buildBusinessAssetHrefFromObject,
  normalizeBusinessAssetType,
} from "@/features/business-assets/hrefs";

describe("business asset display copy", () => {
  it("uses customer-facing asset labels", () => {
    expect(formatBusinessAssetTypeLabel("customer", false)).toBe("客户资产");
    expect(formatBusinessAssetTypeLabel("opportunity", false)).toBe("机会资产");
    expect(formatBusinessAssetTypeLabel("commitment", false)).toBe("承诺资产");
    expect(formatBusinessAssetTypeLabel("risk", false)).toBe("风险资产");
  });

  it("keeps the judgement chain focused on user work", () => {
    const chain = buildBusinessAssetJudgementChain({
      english: false,
      signal: "客户一周没有确认方案",
      judgement: "机会正在降温",
      action: "先补一次确认会议",
      needsReview: true,
      learningTarget: "客户资产记忆",
    });

    expect(chain.signal).toContain("客户一周没有确认方案");
    expect(chain.review).toContain("人工复核");
    expect(Object.values(chain).join(" ")).not.toMatch(/fixture|fallback|tenant|workspace/i);
  });

  it("builds stable asset routes from business objects", () => {
    expect(normalizeBusinessAssetType("risk")).toBe("risk");
    expect(normalizeBusinessAssetType("meeting")).toBeNull();
    expect(buildBusinessAssetHref({ type: "opportunity", id: "opp_1" })).toBe(
      "/assets/opportunity/opp_1",
    );
    expect(
      buildBusinessAssetHrefFromObject({
        objectType: "COMPANY",
        objectId: "company_1",
        source: "dashboard",
      }),
    ).toBe("/assets/customer/company_1?source=dashboard");
  });

  it("keeps empty states about the asset, not product mechanics", () => {
    const copy = buildBusinessAssetEmptyCopy({
      type: "customer",
      english: false,
    });

    expect(copy.title).toContain("客户资产");
    expect(copy.description).not.toMatch(/路由|模型|表|schema/i);
  });
});
