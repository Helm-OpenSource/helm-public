import { describe, expect, it } from "vitest";
import {
  formatGovernanceAuditMarker,
  formatGovernanceAuditSummary,
  formatGovernanceAuditTargetType,
  formatIdentityMatchMarker,
} from "@/features/settings/formatters/governance-formatters";

describe("settings governance formatters", () => {
  it("keeps Chinese org-admin markers out of raw internal enum wording", () => {
    const rendered = [
      formatIdentityMatchMarker(
        {
          recordedAt: new Date("2026-04-15T10:30:00.000Z"),
          status: "NEEDS_REVIEW",
          reason: "联系人姓名接近且公司一致，但缺少邮箱级强标识。",
          externalType: "CONTACT",
          externalId: "crm-1",
          internalObjectType: "contact",
          internalObjectId: "contact-1",
          matchScore: 68,
        },
        false,
      ),
      formatGovernanceAuditMarker(
        {
          createdAt: new Date("2026-04-21T08:06:00.000Z"),
          actionType: "APPROVAL_APPROVED",
          summary: "审批通过。",
          actor: "林舟",
          targetType: "ApprovalTask",
          targetId: "cmnzwr829003w7ntgmo1k02ua",
          sourcePage: "/settings?tab=permissions",
        },
        false,
      ),
      formatGovernanceAuditMarker(
        {
          createdAt: new Date("2026-04-21T08:06:00.000Z"),
          actionType: "OPPORTUNITY_STAGE_CHANGED",
          summary: "机会阶段变更。",
          actor: "林舟",
          targetType: "Opportunity",
          targetId: "cmnzwr5hu001q7ntgesffmyro",
          sourcePage: "/settings?tab=permissions",
        },
        false,
      ),
    ].join(" ");

    expect(rendered).toContain("联系人");
    expect(rendered).toContain("需要复核");
    expect(rendered).toContain("审批任务");
    expect(rendered).toContain("机会阶段变更");
    expect(rendered).toContain("目标 机会");
    expect(rendered).not.toMatch(/CONTACT|NEEDS_REVIEW|ApprovalTask|OPPORTUNITY_STAGE_CHANGED|Opportunity:/);
    expect(rendered).not.toMatch(/cmnzwr829003w7ntgmo1k02ua|cmnzwr5hu001q7ntgesffmyro/);
  });

  it("formats auth session summaries before rendering Chinese governance feeds", () => {
    const rendered = [
      formatGovernanceAuditSummary(
        "Created auth session for founder@demo.com.",
        false,
      ),
      formatGovernanceAuditSummary(
        "Revoked 2 stale active auth sessions for AuthSession cleanup.",
        false,
      ),
      formatGovernanceAuditTargetType("AuthSession", false),
    ].join(" ");

    expect(rendered).toContain("已为 founder@demo.com 创建认证会话");
    expect(rendered).toContain("已撤销 2 个过期活跃会话");
    expect(rendered).toContain("认证会话");
    expect(rendered).not.toMatch(/Created auth session|stale active auth sessions|AuthSession/);
  });

  it("formats provider source and membership lifecycle enums before rendering support pack evidence", () => {
    const rendered = formatGovernanceAuditSummary(
      "PROVIDER/SOURCE mismatch. Updated ops@demo.com from INACTIVE to ACTIVE.",
      false,
    );

    expect(rendered).toContain("来源服务商 / 来源页");
    expect(rendered).toContain("已停用");
    expect(rendered).toContain("已激活");
    expect(rendered).not.toMatch(/PROVIDER\/SOURCE|INACTIVE|ACTIVE/);
  });
});
