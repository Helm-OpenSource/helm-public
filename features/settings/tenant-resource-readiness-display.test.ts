import { describe, expect, it } from "vitest";
import type { TenantResourceReadiness } from "@/lib/tenant-resources/readiness";
import {
  formatTenantResourceDisplayName,
  formatTenantResourceEvidenceToken,
  formatTenantResourceGap,
  formatTenantResourceGovernancePosture,
  formatTenantResourceGuardedWriteText,
  formatTenantResourceStatus,
  pickTenantResourceReadinessRows,
} from "@/features/settings/tenant-resource-readiness-display";

function resource(
  overrides: Partial<TenantResourceReadiness>,
): TenantResourceReadiness {
  return {
    resourceKey: "resource:default",
    resourceName: "Default resource",
    workspaceId: "workspace-1",
    resourceType: "crm",
    provider: "HUBSPOT",
    status: "readable",
    source: {
      sourceKind: "import_source",
      sourceRef: "source-1",
    },
    connection: {
      readCapability: true,
      writeCapability: false,
      callbackCapability: false,
      lastSyncAt: null,
      lastHealthStatus: null,
      tokenPosture: "healthy",
    },
    mapping: {
      mappedObjectTypes: [],
      mappingCompleteness: 0,
      conflictCount: 0,
      missingRequirements: [],
    },
    governance: {
      trustLevel: "medium",
      promotionEligibility: "eligible_read_only",
      freshnessWindow: "24h",
      allowedEffectModes: ["read_only", "draft_only"],
      reviewRequirement: "recommended",
      customerFacingAllowed: false,
      writeBackAllowed: false,
      fallbackMode: "draft_only",
    },
    readiness: {
      actionable: false,
      primaryGap: "mapping_incomplete",
      reasonCodes: ["mapping_incomplete"],
      operatorNextMove: "Review mapping.",
      boundaryNotes: [],
    },
    evidenceRefs: [],
    updatedAt: null,
    ...overrides,
  };
}

describe("tenant resource readiness display helpers", () => {
  it("keeps actionable status user-facing without implying external write authority", () => {
    const posture = formatTenantResourceGovernancePosture(
      resource({
        status: "actionable",
        governance: {
          trustLevel: "human_confirmed",
          promotionEligibility: "eligible_for_action_pack",
          freshnessWindow: "24h",
          allowedEffectModes: ["read_only", "draft_only", "manual_execution"],
          reviewRequirement: "recommended",
          customerFacingAllowed: false,
          writeBackAllowed: false,
          fallbackMode: "manual_execution",
        },
      }),
      true,
    );

    expect(formatTenantResourceStatus("actionable", true)).toBe("Actionable");
    expect(posture).toContain("Manual execution");
    expect(posture).toContain("write-back blocked");
  });

  it("prioritizes blocked resources before healthy rows for operator review", () => {
    const rows = pickTenantResourceReadinessRows([
      resource({
        resourceKey: "resource:healthy",
        resourceName: "Healthy CRM",
        status: "actionable",
      }),
      resource({
        resourceKey: "resource:paused",
        resourceName: "Paused connector",
        status: "paused",
      }),
      resource({
        resourceKey: "resource:error",
        resourceName: "Errored connector",
        status: "error",
      }),
    ]);

    expect(rows.map((row) => row.resourceKey)).toEqual([
      "resource:error",
      "resource:paused",
      "resource:healthy",
    ]);
  });

  it("formats freshness and mapping gaps as operator-readable labels", () => {
    expect(formatTenantResourceGap("freshness_unknown", true)).toBe("Freshness unknown");
    expect(formatTenantResourceGap("mapping_incomplete", false)).toBe("映射不完整");
    expect(formatTenantResourceGap(null, true)).toBe("No current gap");
  });

  it("formats connector resource names before rendering Chinese settings copy", () => {
    expect(formatTenantResourceDisplayName("GOOGLE_CALENDAR connector", false)).toBe(
      "Google Calendar 连接器",
    );
    expect(formatTenantResourceDisplayName("GMAIL_connector resource", true)).toBe(
      "Gmail connector resource",
    );
  });

  it("formats guarded write reason codes before rendering Chinese settings copy", () => {
    const text = formatTenantResourceGuardedWriteText(
      "Keep guarded write blocked: policy_external_write_never_allowed, evidence_detail_needs_review, write_intent_not_declared.",
      false,
    );

    expect(formatTenantResourceEvidenceToken("not_requestable", false)).toBe(
      "暂不可发起",
    );
    expect(formatTenantResourceEvidenceToken("MANUAL_CAPTURE", false)).toBe(
      "人工记录",
    );
    expect(formatTenantResourceEvidenceToken("route_to_review", false)).toBe(
      "转入复核",
    );
    expect(text).toContain("保持写回关闭");
    expect(text).toContain("当前策略不允许外部写入");
    expect(text).toContain("证据明细仍需复核");
    expect(text).toContain("写入意图尚未声明");
    expect(text).not.toMatch(
      /blocked|policy_external_write_never_allowed|evidence_detail_needs_review|write_intent_not_declared/i,
    );
  });

  it("formats field-level guarded write evidence before settings display", () => {
    const text = formatTenantResourceGuardedWriteText(
      "Routed to review_queue because resource_freshness_unknown. Resource requires freshness review before closing or learning from the action. Critical fields: customer status / recent interaction / owner / amount or stage / next-step time.",
      false,
    );

    expect(formatTenantResourceEvidenceToken("owner", false)).toBe("负责人");
    expect(formatTenantResourceEvidenceToken("resource_freshness_unknown", false)).toBe(
      "新鲜度不足",
    );
    expect(formatTenantResourceEvidenceToken("review_queue", false)).toBe(
      "复核队列",
    );
    expect(formatTenantResourceEvidenceToken("reviewer", false)).toBe(
      "复核人",
    );
    expect(formatTenantResourceEvidenceToken("CaptureSession", false)).toBe(
      "现场记录",
    );
    expect(formatTenantResourceEvidenceToken("session_scoped", false)).toBe(
      "会话范围",
    );
    expect(text).toContain("因资源新鲜度不足，已转入复核队列");
    expect(text).toContain("资源需要先完成新鲜度复核");
    expect(text).toContain("客户状态");
    expect(text).toContain("最近互动");
    expect(text).toContain("负责人");
    expect(text).toContain("金额或阶段");
    expect(text).toContain("下一步时间");
    expect(text).not.toMatch(/resource_freshness_unknown|review_queue|owner|customer status|recent interaction|next-step time/i);
  });

  it("formats field mapping downgrade reasons before rendering evidence detail", () => {
    const text = formatTenantResourceGuardedWriteText(
      "Downgrade to review because Owner:resource_freshness_unknown, Amount / stage:resource_freshness_unknown, Next-step time:resource_freshness_unknown.",
      false,
    );

    expect(formatTenantResourceEvidenceToken("has_explainable_gaps", false)).toBe(
      "存在可解释缺口",
    );
    expect(formatTenantResourceEvidenceToken("downgraded", false)).toBe(
      "已降级复核",
    );
    expect(text).toContain("因字段缺口转入复核");
    expect(text).toContain("负责人");
    expect(text).toContain("金额 / 阶段");
    expect(text).toContain("下一步时间");
    expect(text).not.toMatch(/Downgrade to review|resource_freshness_unknown|Owner:|Amount \/ stage|Next-step time/i);
  });

  it("formats resource policy and source summaries before settings display", () => {
    const text = formatTenantResourceGuardedWriteText(
      "read:available · read:unavailable · draft:allowed · draft:not_allowed · review:recommended · external write:never allowed · external_write:never_allowed. Review captured evidence before using it for downstream judgement.",
      false,
    );

    expect(text).toContain("读取可用");
    expect(text).toContain("读取不可用");
    expect(text).toContain("草稿可用");
    expect(text).toContain("草稿不可用");
    expect(text).toContain("建议复核");
    expect(text).toContain("外部写入禁止");
    expect(text).toContain("使用前先复核采集依据");
    expect(text).not.toMatch(/read:available|read:unavailable|draft:allowed|draft:not_allowed|review:recommended|external write|external_write|never_allowed|Review captured/i);
  });

  it("formats expanded evidence review reasons before rendering connector details", () => {
    const text = formatTenantResourceGuardedWriteText(
      "Review the submitted proof before closing or learning from the action. Routed to review_queue because resource_not_actionable; Resource requires review before use: review_required. Downgrade to review because Recent interaction:connection_or_manifest_missing, Next-step time:not_connected. under review · reviewer · connection",
      false,
    );

    expect(text).toContain("先复核已提交证据");
    expect(text).toContain("因资源暂不可执行，已转入复核队列");
    expect(text).toContain("使用前必须先复核资源");
    expect(text).toContain("最近互动:连接或声明缺失");
    expect(text).toContain("下一步时间:未连接");
    expect(text).toContain("复核中");
    expect(text).toContain("复核人");
    expect(text).toContain("连接");
    expect(text).not.toMatch(/Review the submitted proof|resource_not_actionable|review_required|connection_or_manifest_missing|not_connected|under review|reviewer/i);
  });
});
