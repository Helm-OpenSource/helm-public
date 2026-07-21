import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AttentionItem } from "@/lib/shell/attention-feed";
import type { DashboardHomeWorkEntryModel } from "@/features/dashboard/home-work-entry";
import {
  attachRoleAnomalyProgress,
  getAdditionalRoleAnomalyItems,
  resolveRoleAttentionCategory,
} from "@/features/dashboard/role-anomaly-progress";

function buildModel(): DashboardHomeWorkEntryModel {
  const card = {
    id: "existing-work",
    title: "继续本角色工作",
    subject: "当前工作",
    statusLabel: "可推进",
    nextStep: "继续当前工作。",
    boundary: "不会自动执行。",
    href: "/dashboard#role-workspace",
    ctaLabel: "打开工位",
  };
  return {
    canReviewGovernedActions: false,
    state: "returning-active",
    title: "当前工作",
    summary: "继续推进。",
    topWorkItems: [card],
    reviewItems: [],
    reviewItemsArePrimary: false,
    assignmentItems: [],
    resumeItem: card,
    blockerItems: [],
    roleAnomalyItems: [],
  };
}

const ITEMS: AttentionItem[] = [
  {
    key: "source:warning",
    severity: "warning",
    label: "数据源读取失败",
    roleCategory: "ANSON_DATA_STRATEGY_MEMBER",
    href: "/diagnostics",
    basisRef: "audit:data-source:latest",
  },
  {
    key: "worker:critical",
    severity: "critical",
    label: "关键运行队列中断",
    roleCategory: "ANSON_COLLECTION_SUPERVISOR",
    href: null,
    basisRef: "audit:worker-runtime:latest",
  },
  {
    key: "source:info",
    severity: "info",
    label: "注意力来源暂未返回",
    roleCategory: "all",
    href: null,
    basisRef: "attention:source:unreturned",
  },
];

describe("attachRoleAnomalyProgress", () => {
  it("promotes critical and warning attention into stable role work without treating info as work", () => {
    const result = attachRoleAnomalyProgress({
      model: buildModel(),
      attentionItems: ITEMS,
      english: false,
    });

    expect(result.roleAnomalyItems.map((item) => item.id)).toEqual([
      "system-anomaly:worker:critical",
      "system-anomaly:source:warning",
    ]);
    expect(result.topWorkItems.map((item) => item.id)).toEqual([
      "system-anomaly:worker:critical",
      "system-anomaly:source:warning",
      "existing-work",
    ]);
    expect(result.roleAnomalyItems[0]).toMatchObject({
      statusLabel: "关键异常",
      href: "/diagnostics",
      evidenceRef: "audit:worker-runtime:latest",
    });
    expect(result.roleAnomalyItems[0]?.boundary).toContain("不会自动外呼");
  });

  it("deduplicates stable anomaly keys and keeps the highest severity observation", () => {
    const result = attachRoleAnomalyProgress({
      model: buildModel(),
      attentionItems: [
        ITEMS[0]!,
        { ...ITEMS[0]!, severity: "critical", label: "数据源持续失败" },
      ],
      english: true,
    });

    expect(result.roleAnomalyItems).toHaveLength(1);
    expect(result.roleAnomalyItems[0]).toMatchObject({
      title: "数据源持续失败",
      statusLabel: "Critical anomaly",
      evidenceRef: "audit:data-source:latest",
    });
  });

  it("keeps one curated role item visible when three or more anomalies compete for top work", () => {
    const result = attachRoleAnomalyProgress({
      model: buildModel(),
      attentionItems: [
        ITEMS[0]!,
        ITEMS[1]!,
        {
          ...ITEMS[0]!,
          key: "source:second-warning",
          label: "第二个读源失败",
        },
      ],
      english: false,
    });

    expect(result.roleAnomalyItems).toHaveLength(3);
    expect(result.topWorkItems.map((item) => item.id)).toEqual([
      "system-anomaly:worker:critical",
      "system-anomaly:source:second-warning",
      "existing-work",
    ]);
    expect(getAdditionalRoleAnomalyItems(result).map((item) => item.id)).toEqual([
      "system-anomaly:source:warning",
    ]);
  });

  it("does not surface a basis ref that looks like PII", () => {
    const result = attachRoleAnomalyProgress({
      model: buildModel(),
      attentionItems: [
        {
          ...ITEMS[0]!,
          basisRef: "incident:user@example.com",
        },
      ],
      english: false,
    });
    expect(result.roleAnomalyItems[0]?.evidenceRef).toBeUndefined();
  });
});

describe("resolveRoleAttentionCategory", () => {
  it("preserves the exact tenant role preset before applying safe fallbacks", () => {
    expect(
      resolveRoleAttentionCategory({
        rolePresetKey: " ANSON_DATA_STRATEGY_MEMBER ",
        basePresetKey: "GENERAL_OPERATOR",
        workspaceRole: "MEMBER",
      }),
    ).toBe("ANSON_DATA_STRATEGY_MEMBER");
    expect(
      resolveRoleAttentionCategory({
        rolePresetKey: null,
        basePresetKey: "GENERAL_OPERATOR",
        workspaceRole: "MEMBER",
      }),
    ).toBe("GENERAL_OPERATOR");
    expect(
      resolveRoleAttentionCategory({
        rolePresetKey: null,
        basePresetKey: null,
        workspaceRole: "MEMBER",
      }),
    ).toBe("MEMBER");
  });
});

describe("dashboard role-attention wiring", () => {
  it("reuses one role-scoped attention resolution for role work and the inbox", () => {
    const source = readFileSync(
      new URL("../../app/(workspace)/dashboard/page.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/const attentionRoleCategory = resolveRoleAttentionCategory/);
    expect(source).toMatch(/resolveShellAttention\(\{[\s\S]*roleCategory: attentionRoleCategory/);
    expect(source).toMatch(/attentionItems: attentionResolution\.items/);
    expect(source).toMatch(/viewModel=\{roleAwareViewModel\}/);
    expect(source).toMatch(/<AttentionInbox[\s\S]*items=\{attentionResolution\.items\}/);
  });
});
