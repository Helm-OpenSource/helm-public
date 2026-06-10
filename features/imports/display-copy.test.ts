import { describe, expect, it } from "vitest";
import {
  formatCrmImportDisplayText,
  formatCrmImportExternalReference,
  formatCrmImportObjectType,
} from "@/features/imports/display-copy";

describe("CRM import display copy", () => {
  it("converts ingress implementation language for the Chinese surface", () => {
    const display = formatCrmImportDisplayText(
      "CRM-first CRM ingress remains review-first and read-only. Assist stays recommendation-first and keeps connect -> preview -> import -> warmup visible for the operator. blockers, commitments, memory and today focus should not auto-run through a connector workflow; conflict readiness and writeback stay explicit before rerun. meeting/note outputs stay visible.",
      false,
    );

    expect(display).toContain("客户关系系统优先");
    expect(display).toContain("会议/笔记");
    expect(display).toContain("先复核");
    expect(display).toContain("只读");
    expect(display).toContain("建议优先");
    expect(display).toContain("连接 → 预览 → 导入 → 预热");
    expect(display).toContain("操作人");
    expect(display).toContain("阻塞");
    expect(display).toContain("承诺");
    expect(display).toContain("记忆");
    expect(display).toContain("今日焦点");
    expect(display).toContain("冲突");
    expect(display).toContain("就绪度");
    expect(display).toContain("回写");
    expect(display).toContain("重跑");
    expect(display).not.toMatch(/CRM-first|review-first|recommendation-first|blocker|commitment|operator|connector|workflow/i);
    expect(display).not.toMatch(/memory|today focus|conflict|readiness|writeback|rerun|meeting\/note/i);
  });

  it("localizes standalone CRM surface language for Chinese readers", () => {
    const display = formatCrmImportDisplayText(
      "CRM ingress · CRM import · CRM warmup",
      false,
    );

    expect(display).toBe("客户关系系统入口 · 客户关系系统导入 · 客户关系系统预热");
  });

  it("formats import job statuses before they reach the page", () => {
    expect(formatCrmImportDisplayText("COMPLETED_WITH_WARNINGS", false)).toBe(
      "已完成，有警告",
    );
    expect(formatCrmImportDisplayText("NEEDS_REVIEW", false)).toBe("待复核");
    expect(formatCrmImportDisplayText("AUTO_LINKED", false)).toBe("已自动关联");
    expect(formatCrmImportDisplayText("CONNECTED", false)).toBe("已连接");
    expect(formatCrmImportDisplayText("MOCK", false)).toBe("演示连接");
    expect(formatCrmImportDisplayText("INITIAL_IMPORT", false)).toBe("首次导入");
    expect(formatCrmImportDisplayText("CREATED NONE UPDATED", false)).toBe(
      "已创建 无 已更新",
    );
  });

  it("converts persisted Chinese ingress copy for the English surface", () => {
    const display = formatCrmImportDisplayText(
      "客户关系系统入口保持先复核和只读。连接 → 预览 → 导入 → 预热 对操作人可见；冲突、就绪度、回写和重跑必须显式复核。",
      true,
    );

    expect(display).toContain("CRM ingress");
    expect(display).toContain("review-first");
    expect(display).toContain("read-only");
    expect(display).toContain("connect -> preview -> import -> warmup");
    expect(display).toContain("operator");
    expect(display).toContain("conflicts");
    expect(display).toContain("readiness");
    expect(display).toContain("writeback");
    expect(display).toContain("rerun");
    expect(display).toContain("explicit review");
    expect(display).not.toMatch(/[一-龥]/);
  });

  it("converts persisted Chinese CRM statuses for the English surface", () => {
    expect(formatCrmImportDisplayText("待复核", true)).toBe("needs review");
    expect(formatCrmImportDisplayText("已自动关联", true)).toBe("auto linked");
    expect(formatCrmImportDisplayText("已完成，有警告", true)).toBe(
      "completed with warnings",
    );
    expect(formatCrmImportDisplayText("演示连接", true)).toBe("mock connection");
    expect(formatCrmImportDisplayText("首次导入", true)).toBe("initial import");
  });

  it("keeps English CRM copy unchanged on the English surface", () => {
    const display = formatCrmImportDisplayText(
      "Assist stays recommendation-first and never auto-runs a connector flow.",
      true,
    );

    expect(display).toBe(
      "Assist stays recommendation-first and never auto-runs a connector flow.",
    );
  });

  it("formats imported object types before they reach item rows", () => {
    expect(formatCrmImportObjectType("CONTACT", false)).toBe("联系人");
    expect(formatCrmImportObjectType("COMPANY", false)).toBe("公司");
    expect(formatCrmImportObjectType("OPPORTUNITY", false)).toBe("机会");
    expect(formatCrmImportObjectType("Contact", false)).toBe("联系人");
    expect(formatCrmImportObjectType("Account", false)).toBe("公司");
    expect(formatCrmImportObjectType("Deal", false)).toBe("机会");
    expect(formatCrmImportObjectType("ActionItem", false)).toBe("动作项");
    expect(formatCrmImportObjectType(null, false)).toBe("无");
  });

  it("humanizes external record references before rendering conflict rows", () => {
    expect(
      formatCrmImportExternalReference("hubspot-contact-daniel-review", false),
    ).toBe("Daniel Review");
    expect(
      formatCrmImportExternalReference("salesforce-opportunity-renewal-q2", false),
    ).toBe("Renewal Q2");
    expect(formatCrmImportExternalReference("", false)).toBe("外部记录");
  });
});
