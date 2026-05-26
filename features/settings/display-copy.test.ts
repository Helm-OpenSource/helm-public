import { describe, expect, it } from "vitest";
import {
  formatSettingsBoundaryNote,
  formatSettingsCapabilityCategory,
  formatSettingsCommercialText,
  formatSettingsConnectorAuthMode,
  formatSettingsConnectorRuntimeText,
  formatSettingsConnectorStatus,
  formatSettingsCurrentModelProvider,
  formatSettingsModelProviderDetail,
  formatSettingsModelProviderName,
  formatSettingsModelSelection,
  formatSettingsPromptDescription,
  formatSettingsPromptName,
  formatSettingsPromptTaskType,
  formatSettingsPromptVersion,
  formatSettingsSkillSuggestionText,
} from "@/features/settings/display-copy";

describe("settings display copy", () => {
  it("hides raw provider and model identifiers in Chinese settings surfaces", () => {
    const rendered = [
      formatSettingsModelProviderName(
        { provider: "openai", label: "OpenAI" },
        false,
      ),
      formatSettingsModelProviderDetail("openai", false),
      formatSettingsCurrentModelProvider("openai", true, false),
      formatSettingsModelSelection("gpt-4.1-mini", false),
    ].join(" / ");

    expect(rendered).toBe("主辅助服务 / 已登记服务 / 辅助服务已启用 / 已指定");
    expect(rendered).not.toMatch(/OpenAI|GPT|LLM|openai|gpt/i);
  });

  it("maps prompt registry entries into user-facing Chinese labels", () => {
    const rendered = [
      formatSettingsPromptName("recommendation-explanation", false),
      formatSettingsPromptVersion("recommendation-explanation-v1", false),
      formatSettingsPromptTaskType("RECOMMENDATION_EXPLANATION", false),
      formatSettingsPromptDescription(
        "增强 recommendation explanation，但不改变排序和策略边界。",
        false,
      ),
    ].join(" / ");

    expect(rendered).toContain("建议说明");
    expect(rendered).toContain("版本 1");
    expect(rendered).not.toMatch(/recommendation|explanation|prompt/i);
  });

  it("keeps skill suggestions out of raw system wording on Chinese settings pages", () => {
    const rendered = [
      formatSettingsCapabilityCategory("execution", false),
      formatSettingsSkillSuggestionText(
        "预算阻碍澄清包 draft-only review-first boundary incident formal review",
        false,
      ),
    ].join(" / ");

    expect(rendered).toContain("执行辅助");
    expect(rendered).toContain("预算阻塞澄清包");
    expect(rendered).toContain("仅草稿");
    expect(rendered).toContain("先复核");
    expect(rendered).not.toMatch(
      /execution|draft-only|review-first|boundary incident|formal review|阻碍/i,
    );
  });

  it("localizes org-admin boundary notes before rendering Chinese settings pages", () => {
    const rendered = [
      formatSettingsBoundaryNote(
        "Retention, export, delete, and session posture remain review-first governance controls.",
        false,
      ),
      formatSettingsBoundaryNote(
        "Connector and import ingress remain tenant-scoped and review-first; they do not imply workflow or execution authority.",
        false,
      ),
      formatSettingsBoundaryNote(
        "Billing, registry, participant-portal, program-governance, and settlement follow-through remain tenant-scoped governance readouts, not a finance or marketplace platform.",
        false,
      ),
      formatSettingsBoundaryNote(
        "Identity-match records remain tenant-scoped import follow-through truth and do not broaden execution or tenant-admin authority.",
        false,
      ),
      formatSettingsBoundaryNote(
        "Entry-source truth stays on the auth session record; action-source truth for rotate/revoke audits is tracked separately for operator review.",
        false,
      ),
      formatSettingsBoundaryNote(
        "Workspace-switch marker gaps are session-governance anomalies, not implicit proof of tenant isolation failure.",
        false,
      ),
      formatSettingsBoundaryNote(
        "Webhook duplicate chains and mapped callback exceptions are tenant-scoped follow-through signals; hinted unresolved callbacks remain external boundary signals, not workspace audit truth.",
        false,
      ),
      formatSettingsBoundaryNote(
        "Membership, workspace governance, auth-session, and support-pack follow-through remain tenant-scoped audit truth, not a broader tenant-admin platform.",
        false,
      ),
    ].join(" ");

    expect(rendered).toContain("会话状态");
    expect(rendered).toContain("执行权限");
    expect(rendered).toContain("公开市场平台");
    expect(rendered).toContain("入口来源真实状态");
    expect(rendered).toContain("工作区切换标记缺口");
    expect(rendered).toContain("后续治理信号");
    expect(rendered).toContain("不是更宽的租户管理平台");
    expect(rendered).not.toMatch(
      /posture|workflow|execution authority|review-first|tenant-scoped|marketplace platform|tenant-admin authority|Entry-source|action-source|operator review|Workspace-switch|implicit proof|follow-through signals|support-pack/i,
    );
  });

  it("cleans connector runtime messages before rendering Chinese settings pages", () => {
    const rendered = [
      formatSettingsConnectorRuntimeText(
        "DingTalk MCP read-only ingest persisted 28 payloads. 4 scopes remain unresolved in current repo truth.",
        false,
      ),
      formatSettingsConnectorRuntimeText(
        "MANUAL_CAPTURE · HUMAN INPUT · PROOF · Review captured evidence before use",
        false,
      ),
      formatSettingsConnectorStatus("CONNECTED", false),
      formatSettingsConnectorAuthMode("MOCK", false),
    ].join(" ");

    expect(rendered).toContain("28 资料");
    expect(rendered).toContain("4 范围");
    expect(rendered).toContain("当前仓库真实状态");
    expect(rendered).toContain("人工记录");
    expect(rendered).toContain("人工录入");
    expect(rendered).toContain("证据");
    expect(rendered).toContain("使用前先复核采集依据");
    expect(rendered).toContain("已连接");
    expect(rendered).toContain("演示连接");
    expect(rendered).not.toMatch(
      /payloads|scopes|unresolved|repo truth|MANUAL_CAPTURE|HUMAN INPUT|PROOF|MOCK|CONNECTED|Review captured/i,
    );
  });

  it("cleans seeded commercial notes before rendering Chinese billing settings", () => {
    const rendered = [
      formatSettingsCommercialText(
        "Seeded sales referral proof line for manual settlement readiness.",
        false,
      ),
      formatSettingsCommercialText(
        "For contributors who can provide reusable worker capability. This is not a public marketplace.",
        false,
      ),
      formatSettingsCommercialText(
        "Helm first-party worker publisher / Internal first-party publisher profile for add-on worker revenue attribution.",
        false,
      ),
      formatSettingsCommercialText(
        "helm_first_party / Worker Studio / Bank transfer (manual)",
        false,
      ),
      formatSettingsCommercialText(
        "Custom Partner Program Terms v1 / custom integration / finance-console / public discovery",
        false,
      ),
      formatSettingsCommercialText(
        "For contributors who can provide reusable worker 能力 and worker contributions. Seeded reversal evidence for readiness gate.",
        false,
      ),
      formatSettingsCommercialText(
        "custom implementation proof batch / sales referral proof batch / worker proof batch",
        false,
      ),
    ].join(" ");

    expect(rendered).toContain("人工结算准备度");
    expect(rendered).toContain("能力贡献");
    expect(rendered).toContain("公开市场");
    expect(rendered).toContain("Helm 内部能力发布方");
    expect(rendered).toContain("结算归因");
    expect(rendered).toContain("已登记");
    expect(rendered).toContain("能力工作室");
    expect(rendered).toContain("银行转账（人工）");
    expect(rendered).toContain("定制交付伙伴计划条款 v1");
    expect(rendered).toContain("定制集成");
    expect(rendered).toContain("财务控制台");
    expect(rendered).toContain("公开发现");
    expect(rendered).toContain("工作流能力");
    expect(rendered).toContain("冲回演示依据");
    expect(rendered).toContain("定制实施证明批次");
    expect(rendered).toContain("销售转介绍证明批次");
    expect(rendered).toContain("能力贡献证明批次");
    expect(rendered).not.toMatch(
      /manual settlement|readiness|worker|publisher|marketplace|revenue attribution|helm_first_party|Bank transfer|finance-console|public discovery|reversal|proof batch/i,
    );
  });

  it("keeps settings strategy summaries away from autonomous-send wording", () => {
    expect(formatSettingsCommercialText("内部纪要可自动发送", false)).toBe(
      "内部纪要按规则发送",
    );
    expect(formatSettingsCommercialText("内部纪要自动发送", false)).toBe(
      "内部纪要按规则发送",
    );
    expect(formatSettingsCommercialText("不启用自动发送路径", false)).toBe(
      "不启用无人确认的发送路径",
    );

    const candidateCapabilityBoundary = formatSettingsSkillSuggestionText(
      "这只是一条仅草稿的候选能力，不代表 Helm 自动发送外部消息或替人决定承诺内容。",
      false,
    );

    expect(candidateCapabilityBoundary).toContain("不代表 Helm 获得对外发送权限");
    expect(candidateCapabilityBoundary).not.toContain("自动发送");
  });

  it("maps opportunity stage enums inside candidate capability suggestions", () => {
    const rendered = formatSettingsSkillSuggestionText(
      "ADVANCING 阶段最近出现 5 条停滞机会；INTERNAL_SYNC 阶段最近出现 2 条。当前值：AUTO_WITHIN_THRESHOLD；建议值：REQUIRES_APPROVAL。已把 meeting_followup 的默认时间窗口收敛到 within_48h_preferred。",
      false,
    );

    expect(rendered).toContain("推进中");
    expect(rendered).toContain("需内部协同");
    expect(rendered).toContain("低风险可自动");
    expect(rendered).toContain("需逐条审批");
    expect(rendered).toContain("会后跟进");
    expect(rendered).toContain("48 小时内优先跟进");
    expect(rendered).not.toMatch(
      /ADVANCING|INTERNAL_SYNC|AUTO_WITHIN_THRESHOLD|REQUIRES_APPROVAL|meeting_followup|within_48h_preferred/,
    );
  });
});
