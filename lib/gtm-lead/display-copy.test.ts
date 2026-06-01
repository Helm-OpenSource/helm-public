import { describe, expect, it } from "vitest";
import {
  formatGtmLeadIcpFitLabel,
  formatGtmLeadReadinessStageLabel,
  formatGtmLeadSourceTypeLabel,
  formatGtmLeadStageBadgeVariant,
  formatGtmLeadStageLabel,
} from "./display-copy";

describe("formatGtmLeadSourceTypeLabel", () => {
  it("returns bilingual labels", () => {
    expect(formatGtmLeadSourceTypeLabel("REFERRAL", false)).toBe(
      "客户/伙伴转介绍",
    );
    expect(formatGtmLeadSourceTypeLabel("REFERRAL", true)).toBe("Referral");
    expect(formatGtmLeadSourceTypeLabel("PARTNER", false)).toBe("渠道合作伙伴");
    expect(formatGtmLeadSourceTypeLabel("OTHER", true)).toBe("Other");
  });
});

describe("formatGtmLeadIcpFitLabel", () => {
  it("returns bilingual labels for each ICP fit", () => {
    expect(formatGtmLeadIcpFitLabel("STRONG", false)).toBe("强匹配");
    expect(formatGtmLeadIcpFitLabel("UNKNOWN", true)).toBe("Unknown");
  });
});

describe("formatGtmLeadReadinessStageLabel", () => {
  it("returns bilingual labels for each readiness stage", () => {
    expect(formatGtmLeadReadinessStageLabel("PILOT_READY", false)).toBe(
      "可启动试点",
    );
    expect(formatGtmLeadReadinessStageLabel("TRIAL_IN_PROGRESS", true)).toBe(
      "Trial in progress",
    );
  });
});

describe("formatGtmLeadStageLabel", () => {
  it("returns bilingual labels for each stage", () => {
    expect(formatGtmLeadStageLabel("CAPTURED", false)).toBe("已记录");
    expect(formatGtmLeadStageLabel("CUSTOMER_CONFIRMATION_PENDING", true)).toBe(
      "Customer confirmation pending",
    );
    expect(formatGtmLeadStageLabel("CONVERTED", false)).toBe("已转化");
    expect(formatGtmLeadStageLabel("DISQUALIFIED", false)).toBe(
      "判定不匹配",
    );
  });
});

describe("formatGtmLeadStageBadgeVariant", () => {
  it("maps progress stages to info / approval / warning", () => {
    expect(formatGtmLeadStageBadgeVariant("CAPTURED")).toBe("info");
    expect(formatGtmLeadStageBadgeVariant("DEMAND_BRIEF_READY")).toBe(
      "approval",
    );
    expect(formatGtmLeadStageBadgeVariant("FIRST_LOOP_ACTIVE")).toBe("warning");
  });

  it("maps CONVERTED to success and LOST/DISQUALIFIED to danger", () => {
    expect(formatGtmLeadStageBadgeVariant("CONVERTED")).toBe("success");
    expect(formatGtmLeadStageBadgeVariant("LOST")).toBe("danger");
    expect(formatGtmLeadStageBadgeVariant("DISQUALIFIED")).toBe("danger");
  });

  it("maps NURTURED to neutral", () => {
    expect(formatGtmLeadStageBadgeVariant("NURTURED")).toBe("neutral");
  });
});
