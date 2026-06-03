import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const businessLoopGapReadoutGuardedSurfaces = [
  "features/dashboard/goal-driven-home-surface.tsx",
  "features/approvals/approvals-client.tsx",
  "features/opportunities/opportunities-client.tsx",
  "features/customer-success-handoff/queue-view.tsx",
] as const;

const legacyDetailViews = [
  "features/conversation-detail/detail-view.tsx",
  "components/shared/role-conversation-detail-shell.tsx",
  "features/proposal-package/proposal-package-detail-view.tsx",
  "features/commitment-reinforcement-sendability/detail-view.tsx",
  "features/customer-facing-offer-external-proposal/detail-view.tsx",
  "features/external-narrative-detail/detail-view.tsx",
  "features/commercial-narrative-strengthening/detail-view.tsx",
] as const;

const legacyDetailModels = [
  "features/conversation-detail/detail-model.ts",
  "features/proposal-package/detail-model.ts",
  "features/customer-facing-offer-external-proposal/detail-model.ts",
  "features/commitment-reinforcement-sendability/detail-model.ts",
  "features/external-narrative-detail/detail-model.ts",
  "features/commercial-narrative-strengthening/detail-model.ts",
  "features/conversation-chain-extension/detail-model.ts",
  "features/inbox-followup-review-request/detail-model.ts",
  "features/success-check/detail-model.ts",
  "features/expansion-review/detail-model.ts",
  "features/customer-success-handoff/detail-model.ts",
] as const;

const broaderOperationalSurfaces = [
  "components/shared/reporting-protocol-panel.tsx",
  "components/shared/proactive-mechanism-panel.tsx",
  "features/internal-operating-workspace/internal-operating-home.tsx",
  "features/reports/reports-client.tsx",
  "features/imports/imports-client.tsx",
  "features/inbox/inbox-client.tsx",
  "features/diagnostics/diagnostics-client.tsx",
  "features/approvals/approvals-client.tsx",
  "features/opportunities/opportunities-client.tsx",
  "features/customer-success-handoff/queue-view.tsx",
  "features/customer-success-handoff/queue-model.ts",
  "app/(workspace)/dashboard/page.tsx",
  "app/(workspace)/meetings/page.tsx",
] as const;

const sitewideCustomerAssetFocusSurfaces = [
  "features/reports/reports-client.tsx",
  "features/imports/imports-client.tsx",
  "features/settings/settings-client.tsx",
  "features/diagnostics/diagnostics-client.tsx",
  "features/analytics/analytics-client.tsx",
] as const;

const projectSystemspeakAuditSurfaces = [
  "app/programs/page.tsx",
  "components/shared/reporting-protocol-panel.tsx",
  "components/shared/proactive-mechanism-panel.tsx",
  "features/auth/trial-onboarding-surface.tsx",
  "features/approvals/approvals-client.tsx",
  "features/commitment-reinforcement-sendability/detail-model.ts",
  "features/commitment-reinforcement-sendability/detail-view.tsx",
  "features/conversation-chain-extension/detail-model.ts",
  "features/conversation-detail/detail-view.tsx",
  "features/customer-facing-offer-external-proposal/detail-view.tsx",
  "features/customer-success-handoff/external-drafts-panel.tsx",
  "features/customer-success-handoff/queue-model.ts",
  "features/customer-success-handoff/queue-view.tsx",
  "features/expansion-review/detail-model.ts",
  "features/external-narrative-detail/detail-view.tsx",
  "features/imports/imports-client.tsx",
  "features/inbox-followup-review-request/detail-model.ts",
  "features/inbox/inbox-client.tsx",
  "features/internal-operating-workspace/internal-operating-home.tsx",
  "features/meetings/meeting-detail-client.tsx",
  "features/meetings/meeting-v2-draft-comms-card.tsx",
  "features/meetings/meeting-v2-human-action-execution-card.tsx",
  "features/meetings/meeting-v2-opportunity-judge-card.tsx",
  "features/opportunities/opportunities-client.tsx",
  "features/reports/reports-client.tsx",
  "features/settings/settings-client.tsx",
  "features/success-check/detail-model.ts",
  "lib/auth/public-entry.ts",
  "lib/internal-operating-workspace/foundation.ts",
  "lib/operating-system/foundation.ts",
  "lib/presentation/agent-primitives.ts",
] as const;

const bannedSystemspeakPatterns = [
  /What Helm already did/,
  /What Helm already prepared/,
  /What Helm can do now/,
  /Ask Helm in this meeting/,
  /Helm answer/,
  /Why Helm can answer this/,
  /Prepared by Helm/,
  /Helm already prepared the runway/,
  /Helm advisory/,
  /Helm-initiated/,
  /Helm AI work agent/,
  /Helm resurfaced/,
  /Helm (already|has already|still|will|can|prepared|advisory|should|keeps|treats|initiated)/,
  /Helm 已经/,
  /由 Helm/,
  /问 Helm/,
  /Helm 回答/,
] as const;

function expectNoSystemspeak(content: string) {
  for (const pattern of bannedSystemspeakPatterns) {
    expect(content).not.toMatch(pattern);
  }
}

describe("shared surface hierarchy guards", () => {
  it("keeps shared reporting and proactive panels on the same frontstage budget before any explanation layer", () => {
    const reportingPanel = read(
      "components/shared/reporting-protocol-panel.tsx",
    );
    const proactivePanel = read(
      "components/shared/proactive-mechanism-panel.tsx",
    );

    for (const panel of [reportingPanel, proactivePanel]) {
      expect(panel).toContain('data-page-layer="frontstage"');
      expect(panel).toContain('data-page-layer="midstage"');
      expect(panel).toContain('data-page-layer="backstage"');
      expect(panel).toContain('data-page-layer="evidence"');
      expect(panel.match(/data-frontstage-block=/g) ?? []).toHaveLength(4);
      expect(panel).toContain('data-frontstage-block="current-summary"');
      expect(panel).toContain('data-frontstage-block="decision-request"');
      expect(panel).toContain('data-frontstage-block="next-action"');
      expect(panel).toContain('data-frontstage-block="boundary"');
      expect(panel).not.toContain("What Helm already prepared");
      expect(panel).not.toContain("What Helm already did");
      expect(panel).not.toContain("Worker summary");
    }
  });

  it("keeps shared-agent detail shell from repeating the same route judgement in two first-screen hero blocks", () => {
    const shell = read("components/shared/role-conversation-detail-shell.tsx");
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const navigationPanel = read(
      "components/shared/unified-detail-navigation-panel.tsx",
    );

    expect(shell.match(/protocol\.pageJudgement\b/g) ?? []).toHaveLength(1);
    expect(shell.match(/protocol\.pageJudgementReason\b/g) ?? []).toHaveLength(
      1,
    );
    expect(shell).toContain("protocol.pagePrioritySignal");
    expect(
      queueView.match(/model\.protocol\.pageJudgement\b/g) ?? [],
    ).toHaveLength(1);
    expect(
      queueView.match(/model\.protocol\.pageJudgementReason\b/g) ?? [],
    ).toHaveLength(1);
    expect(navigationPanel).not.toContain("currentNode.detailNodeSummary");
    expect(navigationPanel).toContain(
      "labelForNodeType(currentNode.detailNodeType",
    );
  });

  it("keeps the demo sidebar narrative visible without turning it into a competing page heading", () => {
    const sidebar = read("components/layout/sidebar.tsx");
    const pageHeader = read("components/shared/page-header.tsx");
    const contactDetailClient = read(
      "features/contacts/contact-detail-client.tsx",
    );
    const companyDetailClient = read(
      "features/companies/company-detail-client.tsx",
    );
    const meetingDetailClient = read(
      "features/meetings/meeting-detail-client.tsx",
    );

    expect(sidebar).toContain("demoShellCopy ?? messages.shell.shellHeadline");
    expect(sidebar).toContain("客户推进样例");
    expect(sidebar.match(/<h2\b/g) ?? []).toHaveLength(0);
    expect(pageHeader).toContain('titleAs?: "h1" | "h2"');
    expect(contactDetailClient).toContain('titleAs="h2"');
    expect(companyDetailClient).toContain('titleAs="h2"');
    expect(meetingDetailClient).toContain('titleAs="h2"');
  });

  it("keeps disclosure trigger names short while preserving rich visible summaries", () => {
    const controlledDisclosure = read(
      "components/shared/controlled-disclosure.tsx",
    );
    const workspaceGuidancePanel = read(
      "components/shared/workspace-guidance-panel.tsx",
    );
    const homeSecondaryDisclosure = read(
      "components/shared/home-surface-secondary-disclosure.tsx",
    );
    const narrativeComponents = read(
      "components/shared/narrative-components.tsx",
    );

    expect(controlledDisclosure).toContain("summaryLabel?: string");
    expect(controlledDisclosure).toContain("aria-label={summaryLabel}");
    expect(workspaceGuidancePanel).toContain("summaryLabel={title}");
    expect(homeSecondaryDisclosure).toContain("summaryLabel={title}");
    expect(narrativeComponents).toContain("summaryLabel={label}");
  });

  it("keeps shared workspace guidance styled instead of falling back to browser defaults", () => {
    const globals = read("app/globals.css");

    expect(globals).toContain("html body .workspace-panel");
    expect(globals).toContain("html body .demo-shell-panel");
    expect(globals).toContain("html body .theme-detail-shell");
    expect(globals).toContain("html body .theme-detail-shell-card");
    expect(globals).toContain("html body .theme-detail-shell-tile");
    expect(globals).toContain(
      "html body .theme-detail-shell .text-white",
    );
    expect(globals).toContain("--dark-inset-foreground: var(--foreground)");
    expect(globals).toContain("html body .workspace-guidance-card");
    expect(globals).toContain("container-type: inline-size");
    expect(globals).toContain("@container (min-width: 720px)");
    expect(globals).toContain("html body .workspace-guidance-summary");
    expect(globals).toContain("html body .workspace-guidance-summary::marker");
    expect(globals).toContain(
      "html body .workspace-guidance-summary::-webkit-details-marker",
    );
    expect(globals).toContain("html body .workspace-guidance-list");
    expect(globals).toContain(
      'html[data-workspace-guidance="focused"] body .workspace-guidance-detail',
    );
    expect(globals).toContain(
      'html body .workspace-preference-option[data-active="true"]',
    );
    expect(globals).toContain(
      "html[data-theme=\"dark\"] body a.theme-primary-action",
    );
    expect(globals).toContain(
      "html[data-theme=\"dark\"] body a.theme-primary-action:hover",
    );
    expect(globals).toContain(
      "html body a.theme-primary-action :where(span, svg)",
    );
    expect(globals).toContain(
      'html body [data-testid="mobile-hero-action-primary"]',
    );
    expect(globals).toContain(
      'html body a[href*="/approvals?source=mobile"]',
    );
    expect(globals).toContain("-webkit-text-fill-color");
    expect(globals).toContain(
      'html:not([data-theme="dark"]) a:not([class*="text-"])',
    );
    expect(globals).toContain(
      'html[data-theme="dark"] a:not([class*="text-"])',
    );
  });

  it("keeps repeated role handoff labels from reusing React list keys", () => {
    const pageHeader = read("components/shared/page-header.tsx");
    const guidance = read("components/shared/workspace-guidance-panel.tsx");
    const roleSurface = read(
      "features/internal-operating-workspace/role-handoff-surface.tsx",
    );
    const objectCard = read(
      "features/internal-operating-workspace/object-card.tsx",
    );

    expect(pageHeader).toContain("key={`takeaway-${index}-${item}`}");
    expect(pageHeader).toContain("key={`decision-${index}-${item}`}");
    expect(guidance).toContain(
      'key={guidanceEntryKey("recommendation", item, index)}',
    );
    expect(guidance).toContain(
      'key={guidanceEntryKey("reminder", item, index)}',
    );
    expect(roleSurface).toContain("key={attachmentKey(title, item, index)}");
    expect(roleSurface).toContain("key={attachmentKey(scene.id, item, index)}");
    expect(roleSurface).toContain('key={`handoff-card-${card.id}-${index}`}');
    expect(objectCard).toContain("key={attachmentKey(title, item, index)}");
  });

  it("keeps breadcrumb links large enough for pointer and touch navigation", () => {
    const breadcrumb = read("components/shared/breadcrumb-trail.tsx");

    expect(breadcrumb).toContain("const linkClassName =");
    expect(breadcrumb).toContain("inline-flex min-h-7 items-center");
    expect(breadcrumb).toContain("className={linkClassName}");
  });

  it("keeps high-traffic queue controls large enough for touch targets", () => {
    const opportunities = read(
      "features/opportunities/opportunities-client.tsx",
    );
    const approvals = read("features/approvals/approvals-client.tsx");
    const inbox = read("features/inbox/inbox-client.tsx");

    expect(opportunities).toContain(
      'className="h-5 w-5 cursor-pointer accent-[color:var(--accent)]"',
    );
    expect(opportunities).toContain(
      'className="h-5 w-5 shrink-0 cursor-pointer accent-[color:var(--accent)]"',
    );
    expect(approvals).toContain(
      "inline-flex min-h-7 items-center rounded-lg px-1.5 font-medium",
    );
    expect(inbox).toContain(
      "inline-flex min-h-7 items-center rounded-lg px-1.5 text-xs",
    );
  });

  it("keeps high-traffic cards from nesting interactive controls inside interactive cards", () => {
    const opportunities = read(
      "features/opportunities/opportunities-client.tsx",
    );
    const approvals = read("features/approvals/approvals-client.tsx");
    const topbar = read("components/layout/topbar.tsx");

    expect(opportunities).toContain("cursor-grab");
    expect(opportunities).toContain("Move opportunity card:");
    expect(opportunities).not.toContain("{...listeners}\n      {...attributes}");
    expect(approvals).toContain("<article");
    expect(approvals).toContain('data-approval-queue-preview-button="true"');
    expect(approvals).not.toContain("<button\n                  key={task.id}");
    expect(topbar).toContain("<Button\n              asChild");
    expect(topbar).not.toContain('<Link\n              href="/search"\n              className="md:hidden"');
  });

  it("keeps inbox thread selection from racing against full-detail navigation", () => {
    const inbox = read("features/inbox/inbox-client.tsx");

    expect(inbox).toContain("window.history.replaceState");
    expect(inbox).not.toContain("router.replace(`/inbox?threadId=${thread.id}`)");
  });

  it("keeps legacy detail views from repeating the same page judgement in a second hero card", () => {
    for (const relativePath of legacyDetailViews) {
      const view = read(relativePath);

      expect(view).toContain("protocol.pagePrioritySignal");
      expect(view).not.toContain("NarrativeHeader");
      expect(view).toContain('data-page-layer="frontstage"');
      expect(view).toContain('data-page-layer="midstage"');
      expect(view).toContain('data-page-layer="backstage"');
    }
  });

  it("keeps legacy detail views on the frontstage four-block budget before any system explanation", () => {
    for (const relativePath of legacyDetailViews) {
      const view = read(relativePath);

      expect(view.match(/data-frontstage-block=/g) ?? []).toHaveLength(4);
      expect(view).toContain('data-frontstage-block="current-summary"');
      expect(view).toContain('data-frontstage-block="decision-request"');
      expect(view).toContain('data-frontstage-block="next-action"');
      expect(view).toContain('data-frontstage-block="boundary"');
      expect(
        view.indexOf('data-frontstage-block="current-summary"'),
      ).toBeLessThan(view.indexOf('data-frontstage-block="decision-request"'));
      expect(
        view.indexOf('data-frontstage-block="decision-request"'),
      ).toBeLessThan(view.indexOf('data-frontstage-block="next-action"'));
      expect(view.indexOf('data-frontstage-block="next-action"')).toBeLessThan(
        view.indexOf('data-frontstage-block="boundary"'),
      );
      expect(view.indexOf("<ReviewSnapshotBlock")).toBeGreaterThan(
        view.indexOf('data-page-layer="midstage"'),
      );
      expect(view.indexOf("<WhyItMattersBlock")).toBeGreaterThan(
        view.indexOf('data-page-layer="backstage"'),
      );
    }
  });

  it("keeps legacy detail pages away from first-screen system self-narration copy", () => {
    for (const relativePath of legacyDetailViews) {
      const view = read(relativePath);

      expect(view).not.toContain("What Helm already prepared");
      expect(view).not.toContain("Helm 已经准备了什么");
      expect(view).not.toContain("Worker summary");
      expect(view).not.toContain("AI 与团队分工");
      expect(view).not.toContain("Worker 汇总");
      expect(view).toContain("ReviewSnapshotBlock");
      expect(view).toContain("Coordination handoff");
    }
  });

  it("keeps legacy detail models away from systemspeak self-narration and agent-centered labels", () => {
    for (const relativePath of legacyDetailModels) {
      const model = read(relativePath);

      expect(model).not.toContain("Helm AI work agent");
      expect(model).not.toContain("Helm resurfaced");
      expect(model).not.toContain("Helm already");
      expect(model).not.toContain("Helm has already");
      expect(model).not.toContain("Helm is already");
      expect(model).not.toContain("Helm 已经");
      expect(model).not.toContain("Worker summary");
    }
  });

  it("keeps Chinese conversation-chain detail copy free of implementation terms", () => {
    const model = read("features/conversation-chain-extension/detail-model.ts");
    const bannedMixedChineseFragments = [
      "关系路由 detail",
      "follow-up、meeting 或 conversation hop",
      "挂在 live commercial thread",
      "outward claim 出现前",
      "warmth、risk 和 ownership",
      "sales follow-up、meeting review",
      "泛化 notes",
      "说成 customer-facing certainty 前",
      "当前 contact chain 判断",
      "当前 company chain 判断",
      "沟通链 / Company detail",
      "company chain 详情",
      "打开 contact detail",
      "打开 sales follow-up",
      "打开 conversation detail",
      "保持 customer-facing-with-boundary",
      "退回 non-commitment。",
      "具体的 meeting follow-through",
      "更具体的 meeting evidence",
      "制造 delivery certainty",
    ];

    for (const fragment of bannedMixedChineseFragments) {
      expect(model).not.toContain(fragment);
    }
    expect(model).toContain("当前应先把联系人页当作关系路由详情");
    expect(model).toContain("当前应先把公司页当作账户路由详情");
    expect(model).toContain("面向客户但带边界");
    expect(model).toContain(
      "formatContactRelationshipStage(contact.relationshipStage, english)",
    );
    expect(model).toContain("const briefingSummary = normalizeDisplayText(");
    expect(model).toContain("contact.briefingSnapshot?.payload.summary");
    expect(model).not.toContain("contact.relationshipStage ??");
  });

  it("keeps Chinese commercial detail labels free of English fallback cue labels", () => {
    const externalNarrativeView = read("features/external-narrative-detail/detail-view.tsx");
    const reinforcementView = read("features/commitment-reinforcement-sendability/detail-view.tsx");
    const commercialStrengtheningView = read("features/commercial-narrative-strengthening/detail-view.tsx");
    const commercialStrengtheningModel = read("features/commercial-narrative-strengthening/detail-model.ts");
    const commercialSources = [
      externalNarrativeView,
      reinforcementView,
      commercialStrengtheningView,
      commercialStrengtheningModel,
    ].join("\n");

    for (const fragment of [
      'text("founder cue")',
      'text("sales cue")',
      'text("delivery cue")',
      'text("customer-visible strengthening")',
      'text("internal-only wording")',
      'text("打开加固变体s 页面")',
      'text("Commercial 叙事加固判断")',
      '"打开加固变体s 页面"',
      "打开加固变体s 并确认下一层加固",
      "回到加固变体s",
    ]) {
      expect(commercialSources).not.toContain(fragment);
    }

    expect(externalNarrativeView).toContain('text("创始人提示")');
    expect(externalNarrativeView).toContain('text("销售提示")');
    expect(externalNarrativeView).toContain('text("交付提示")');
    expect(reinforcementView).toContain('text("客户可见加固")');
    expect(reinforcementView).toContain('text("仅内部话术")');
    expect(commercialStrengtheningView).toContain('text("打开加固变体页面")');
    expect(commercialStrengtheningView).toContain('text("商业叙事加固判断")');
    expect(commercialStrengtheningModel).toContain('"打开加固变体页面"');
    expect(commercialStrengtheningModel).toContain("打开加固变体并确认下一层加固");
  });

  it("keeps Chinese runtime operator empty-state copy free of mixed English fragments", () => {
    const runtimeOperatorPanel = read("features/internal-operating-workspace/runtime-operator-panel.tsx");

    for (const fragment of [
      "当前还没有交接 资料et",
      "经营记忆 write",
      "当前还没有 主动跑动",
      "当前没有 open 问题空间",
      "当前没有 player-coach 摘要",
      "当前没有协同轨迹 bridge",
      "Reflection 延续",
      "reflection 延续",
      "当前没有反思 job",
      "当前没有 整合 job",
      "当前还没有操作员线索 summary",
      "当前还没有操作员下一动作 summary",
      "当前还没有操作员start point",
      "当前还没有操作员复核 summary",
      "当前还没有操作员work summary",
      "当前还没有操作员控制 summary",
      "context miss、验证 fail 和 policy block",
      "运行时 path",
      "当前没有 composition failure",
      "pilot 连续性 失败类型",
      "当前还没有 expanded cohort family",
      "当前还没有可用的 SOP highlight",
      "当前还没有可用的 SOP highlight，需要等待更多 pilot 失败类型",
      "recovery state、remediation analytics",
      "repeat-pattern evidence，以及 有边界的runbook 指引",
      "execution权限",
      "当前没有 连续性 队列",
    ]) {
      expect(runtimeOperatorPanel).not.toContain(fragment);
    }

    expect(runtimeOperatorPanel).toContain("当前还没有交接资料。");
    expect(runtimeOperatorPanel).toContain("当前没有开放问题空间。");
    expect(runtimeOperatorPanel).toContain("负责人提示 ${item.ownerHint}");
    expect(runtimeOperatorPanel).toContain("当前没有陪跑教练摘要。");
    expect(runtimeOperatorPanel).toContain("当前没有协同轨迹桥。");
    expect(runtimeOperatorPanel).toContain("当前没有反思任务。");
    expect(runtimeOperatorPanel).toContain("当前没有组合失败记录。");
    expect(runtimeOperatorPanel).toContain("当前还没有扩展队列族。");
    expect(runtimeOperatorPanel).toContain("当前没有连续性队列。");
  });

  it("keeps Chinese meeting runtime empty-state copy free of mixed English fragments", () => {
    const meetingRuntimeCard = read("features/meetings/meeting-v2-runtime-card.tsx");

    for (const fragment of [
      "当前还没有可见的协同轨迹 bridge",
      "当前还没有反思 job",
      "当前还没有反思 延续 候选",
      "当前还没有 整合 job",
    ]) {
      expect(meetingRuntimeCard).not.toContain(fragment);
    }

    expect(meetingRuntimeCard).toContain("当前还没有可见的协同轨迹桥。");
    expect(meetingRuntimeCard).toContain("当前还没有反思任务。");
    expect(meetingRuntimeCard).toContain("当前还没有反思延续候选。");
    expect(meetingRuntimeCard).toContain("当前还没有整合任务。");
  });

  it("keeps Chinese meeting runtime action copy free of mixed English fragments", () => {
    const meetingActions = read("features/meetings/actions.ts");
    const meetingRuntimeCard = read("features/meetings/meeting-v2-runtime-card.tsx");
    const runtimeOperatorPanel = read("features/internal-operating-workspace/runtime-operator-panel.tsx");
    const sources = `${meetingActions}\n${meetingRuntimeCard}\n${runtimeOperatorPanel}`;

    for (const fragment of [
      "整合 job 不存在",
      "human input 检查点 request",
      "请求 human input 检查点失败",
      "接管跟进闭环 request 参数错误",
      "操作员接管 follow-through",
      "接管跟进闭环 resolve 参数错误",
      "human input 检查点 已确认",
      "Human input checkpoint 已确认",
      "Artifact复核 记录",
      "Kill（close request）",
    ]) {
      expect(sources).not.toContain(fragment);
    }

    expect(meetingActions).toContain("整合任务不存在");
    expect(meetingActions).toContain("人工输入检查点请求参数错误");
    expect(meetingRuntimeCard).toContain("人工输入检查点确认已记录");
    expect(meetingRuntimeCard).toContain("产物复核记录");
    expect(runtimeOperatorPanel).toContain("终止（请求关闭）");
  });

  it("keeps Chinese customer-success handoff copy free of recently fixed mixed English fragments", () => {
    const detailModel = read("features/customer-success-handoff/detail-model.ts");
    const queueModel = read("features/customer-success-handoff/queue-model.ts");
    const sources = `${detailModel}\n${queueModel}`;

    for (const fragment of [
      "success 跟进闭环",
      "拓展 read",
      "普通客户成功 path 上",
      "Issue 跟进闭环",
      "meaningful post-send 结果",
      "meaningful post-send 信号",
      "当前 post-send",
      "人工 send 交接",
      "silence 或人工交接",
      "拓展已 ready",
      "复核-limited",
      "commercial motion 时",
      "intervention 压力",
      "交接 evidence",
      "ready-to-send、客户安全",
      "当前已经足够 resolved / unblocked",
      "已 backing",
      "明确 backing",
      "Outcome 已解除阻塞",
      "Outcome 收紧了边界",
      "Customer success 接手面",
      "Customer success 链",
      "company 跟进闭环",
      "当前应把 客户成功验收 当作",
      "扩大 ownership",
      "把 adoption、阻塞",
      "承诺-like 动作",
      "dedicated success 交接",
      "success 验证",
      "扩大 负责人压力",
      "accountable 动作",
      "commercial-safe，",
      "或 unblocker",
      "安全 playbook",
      "仅 advisory",
      "user 审批路径",
      "policy 线",
      "这一面 仍然禁用",
      "check-in 草稿",
      "已经 settle",
      "下一条 请求",
      "下一步 加温",
      "commercial 方案包线",
      "success 问题修复",
      "success 收件箱",
      "sales-owned commercial 跟进",
      "当前 success 边界",
      "跳过 success 画面",
      "company detail 应",
      "客户成功 路由",
      "客户成功 triage",
      "widened 压力",
      "收件箱 triage",
      "派生 success",
      "复核 持守",
      "active 升级",
      "Queue 项",
      "Issue 跟进",
      "Success 收件箱线程",
      "advisory 路由",
      "inbound 回应",
      "widened 判断",
      "Success 跟进",
      "当前对外姿态 ",
      "判断姿态 ",
      "公司详情面 后面",
      "客户成功验收 和拓展路由",
      "交接 路由",
      "扩大后的 负责人",
      "更高 执行风险",
      "内部 playbook",
      "发送评估姿态 仍",
      "复核话术 关闭",
      "已经 agreed",
      "复核姿态 仍",
      "边界姿态 仍",
      "非承诺优先 治理",
      "缺失的 请求",
      "边界话术 和判断姿态",
      "可拓展 的措辞",
      "交接 面",
      "路由 线索",
      "复核请求 或泛化",
      "工作流 或",
      "阶段模型 派生",
      "新的 权威对象",
      "诚实的 经营入口",
      "路由和 负责人",
      "当前证据 说得",
      "交接 reason",
      "回复 请求",
      "禁用 对外发送",
      "对外发送 和承诺",
      "持守中 草稿",
      "当前证据 更实",
    ]) {
      expect(sources).not.toContain(fragment);
    }

    expect(detailModel).toContain("客户成功接手面");
    expect(detailModel).toContain("客户成功链 /");
    expect(detailModel).toContain("负责人归属");
    expect(detailModel).toContain("仅建议");
    expect(detailModel).toContain("客户成功跟进闭环说成对外确定性");
    expect(detailModel).toContain("值得进入拓展研判");
    expect(detailModel).toContain("有意义的发送后结果");
    expect(detailModel).toContain("显式介入压力");
    expect(detailModel).toContain("交接证据会继续保留");
    expect(detailModel).toContain("商业方案包线");
    expect(detailModel).toContain("客户成功收件箱线程");
    expect(detailModel).toContain("交接路由已经收在这里");
    expect(detailModel).toContain("非承诺优先治理约束");
    expect(queueModel).toContain("问题跟进闭环");
    expect(queueModel).toContain("普通客户成功路径上");
    expect(queueModel).toContain("当前沉默仍然不等于确认");
    expect(queueModel).toContain("派生客户成功队列");
    expect(queueModel).toContain("客户成功收件箱仍是派生面");
    expect(queueModel).toContain("最新入站回应正在要求澄清");
    expect(queueModel).toContain("很薄的收件箱路线线索");
    expect(queueModel).toContain("这一面仍继续禁用对外发送和承诺");
  });

  it("keeps customer-facing offer and external proposal copy free of recently fixed mixed fragments", () => {
    const detailModel = read(
      "features/customer-facing-offer-external-proposal/detail-model.ts",
    );

    for (const fragment of [
      "对外安全 动作",
      "经营记忆事实 和完整发送评估",
      "跟进安全语言 和异议",
      "创始人 /操作员",
      "信任敏感 措辞",
      "决定 可对外措辞",
      "一版 可对外提案",
      "对外闸口 前",
      "提案 面",
      "仅讨论 措辞",
      "发送前复核闸口 由谁",
      "依赖清理 或",
      "把 可对外叙事",
      "下一步 号召动作",
      "becomes可发送",
      "可发送 之前",
      "使用 可对外提案",
      "提案安全 版本",
      "as可发送 copy",
    ]) {
      expect(detailModel).not.toContain(fragment);
    }

    expect(detailModel).toContain("下一步对外安全动作由谁接");
    expect(detailModel).toContain("经营记忆事实和完整发送评估轨迹");
    expect(detailModel).toContain("跟进安全语言和异议安全备选表达");
    expect(detailModel).toContain("创始人 / 操作员复核");
    expect(detailModel).toContain("信任敏感措辞");
    expect(detailModel).toContain("一版可对外提案结构");
    expect(detailModel).toContain("对外闸口前");
    expect(detailModel).toContain("同一个提案面");
    expect(detailModel).toContain("仅讨论措辞");
    expect(detailModel).toContain("下一步号召动作");
    expect(detailModel).toContain("anything becomes sendable");
    expect(detailModel).toContain("sendable copy");
  });

  it("keeps conversation and external narrative detail copy free of recently fixed mixed fragments", () => {
    const conversationDetailModel = read(
      "features/conversation-detail/detail-model.ts",
    );
    const conversationDetailView = read(
      "features/conversation-detail/detail-view.tsx",
    );
    const externalNarrativeDetailModel = read(
      "features/external-narrative-detail/detail-model.ts",
    );
    const externalNarrativeDetailView = read(
      "features/external-narrative-detail/detail-view.tsx",
    );
    const sources = [
      conversationDetailModel,
      conversationDetailView,
      externalNarrativeDetailModel,
      externalNarrativeDetailView,
    ].join("\n");

    for (const fragment of [
      "把 机会压力",
      "对话 guidance",
      "经营记忆事实 和完整对话",
      "scenario 轨迹",
      "边界话术 挂在前台",
      "把 时点",
      "边界安全 的客户可见",
      "对话 guidance",
      "话术 已经",
      "可复用的 对外叙事层",
      "停留在 场景层提示",
      "打开 对外叙事详情面",
      "把 对外叙事压力",
      "internal 措辞",
      "探索性 叙事",
      "script 和线索 资料",
      "叙事 pass",
      "经营记忆事实 和完整叙事",
      "提案-supporting",
      "提案 support",
      "把 时点",
      "回到 按场景 的对话 detail",
      "打开叙事兜底 detail",
      "打开对话 detail",
    ]) {
      expect(sources).not.toContain(fragment);
    }

    expect(conversationDetailModel).toContain("对话指引可以改变重点");
    expect(conversationDetailModel).toContain("经营记忆事实和完整对话轨迹");
    expect(conversationDetailModel).toContain("场景轨迹和历史变更");
    expect(conversationDetailView).toContain("场景化对话指引");
    expect(conversationDetailView).toContain("可复用的对外叙事层");
    expect(externalNarrativeDetailModel).toContain("内部措辞、探索性叙事");
    expect(externalNarrativeDetailModel).toContain("零散脚本和线索资料");
    expect(externalNarrativeDetailModel).toContain("下一轮叙事修订");
    expect(externalNarrativeDetailModel).toContain("提案支撑");
    expect(externalNarrativeDetailView).toContain("按场景组织的对话详情");
    expect(externalNarrativeDetailView).toContain("打开叙事兜底详情");
  });

  it("keeps inbox follow-up review request copy free of recently fixed mixed fragments", () => {
    const detailModel = read(
      "features/inbox-followup-review-request/detail-model.ts",
    );

    for (const fragment of [
      "完整机会 框架",
      "范围、price",
      "时点 或结果",
      "contact 负责人",
      "复核请求 分开了",
      "跟进文案 压力",
      "审批-敏感",
      "复核请求 之前",
      "跟进详情面 可以",
      "交接时点 的清晰度",
      "把 草稿压力",
      "下一步 路由",
      "Follow-up 判断",
      "当前 下动作",
      "复核请求 不应该",
      "边界优先 处理",
      "复核请求 仍",
      "仅复核 和非承诺",
      "原始复核姿态 中",
      "复核请求 面",
      "success 跟进闭环",
      "success 边界",
      "打开方案包 detail",
      "打开 对外叙事详情面",
      "共享对话场景 已经",
      "范围、terms",
      "文案 里回答",
      "信任敏感 措辞",
      "打开创始人对话 detail",
      "rollout 澄清",
      "打开交付对话 detail",
      "打开销售对话 detail",
      "dedicated 客户成功交接",
      "company 级 proxy",
      "company detail 必须",
      "success 判断",
      "复核请求 误当成",
      "更宽的 客户成功边界",
      "不知不觉中 过度承诺",
      "范围或 上线节奏澄清",
      "进入 专门的客户成功交接面",
      "躲在 公司级代理路由后面",
      "接管 客户成功判断",
    ]) {
      expect(detailModel).not.toContain(fragment);
    }

    expect(detailModel).toContain("完整机会框架");
    expect(detailModel).toContain("范围、价格、时点或结果确定性");
    expect(detailModel).toContain("联系人负责人");
    expect(detailModel).toContain("跟进文案压力");
    expect(detailModel).toContain("跟进详情面可以提高节奏");
    expect(detailModel).toContain("跟进判断");
    expect(detailModel).toContain("当前下一步动作");
    expect(detailModel).toContain("复核请求不应该");
    expect(detailModel).toContain("仅复核和非承诺");
    expect(detailModel).toContain("客户成功跟进闭环");
    expect(detailModel).toContain("打开方案包详情");
    expect(detailModel).toContain("打开对外叙事详情面");
    expect(detailModel).toContain("专门的客户成功交接面");
    expect(detailModel).toContain("公司详情必须继续只是账户上下文");
    expect(detailModel).toContain("更宽的客户成功边界");
    expect(detailModel).toContain("不知不觉中过度承诺");
    expect(detailModel).toContain("范围或上线节奏澄清");
  });

  it("keeps billing and tenant resource readiness copy free of recently fixed mixed fragments", () => {
    const settlementBatchPanels = read(
      "features/settings/components/billing-settlement-batch-panels.tsx",
    );
    const tenantResourceReadinessPanel = read(
      "features/settings/components/tenant-resource-readiness-panel.tsx",
    );
    const sources = `${settlementBatchPanels}\n${tenantResourceReadinessPanel}`;

    for (const fragment of [
      "进入 closeout",
      "Optional 已确认 note",
      "review / 已确认 seam",
    ]) {
      expect(sources).not.toContain(fragment);
    }

    expect(settlementBatchPanels).toContain("已导出的批次才能进入收口");
    expect(tenantResourceReadinessPanel).toContain(
      "Optional acknowledgement note.",
    );
    expect(tenantResourceReadinessPanel).toContain(
      "local candidate / review / acknowledgement seam",
    );
  });

  it("keeps meeting detail prompts and prepared-summary answers object-first", () => {
    const meetingDetail = read("features/meetings/meeting-detail-client.tsx");

    expect(meetingDetail).not.toContain("What Helm already prepared");
    expect(meetingDetail).not.toContain("Helm 已经从这场会议准备了什么");
    expect(meetingDetail).toContain(
      "What is already prepared from this meeting",
    );
  });

  it("keeps broader queue, workspace and panel surfaces away from Helm-centered first-screen narration", () => {
    for (const relativePath of broaderOperationalSurfaces) {
      const surface = read(relativePath);

      expect(surface).not.toContain("What Helm");
      expect(surface).not.toContain("Helm 已经");
      expect(surface).not.toContain("Helm 平台");
    }
  });

  it("keeps secondary operating pages customer-asset first before reference layers", () => {
    for (const relativePath of sitewideCustomerAssetFocusSurfaces) {
      const surface = read(relativePath);

      expect(surface).toContain("CustomerAssetFocusStrip");
      expect(surface).toMatch(/Object state|Current asset/);
      expect(surface).toContain("Blocker");
      expect(surface).toMatch(/Pending decision|Decision/);
    }

    for (const relativePath of sitewideCustomerAssetFocusSurfaces.filter(
      (pathName) => pathName !== "features/analytics/analytics-client.tsx",
    )) {
      expect(read(relativePath)).toContain("LazyDisclosure");
    }
  });

  it("keeps project-level operating and detail surfaces away from systemspeak self-narration copy", () => {
    for (const relativePath of projectSystemspeakAuditSurfaces) {
      expectNoSystemspeak(read(relativePath));
    }
  });

  it("keeps customer-success detail page marker owned by the root surface instead of duplicating it in the wrapper", () => {
    const detailView = read(
      "features/customer-success-handoff/detail-view.tsx",
    );

    expect(detailView).not.toContain('"data-customer-success-handoff-page":');
    expect(detailView).toContain('"data-customer-success-handoff-kind":');
  });

  it("keeps operating summary connection links short in assistive navigation", () => {
    const summary = read(
      "components/shared/object-context-operating-summary.tsx",
    );
    const guidance = read("components/shared/workspace-guidance-panel.tsx");
    const opportunities = read(
      "features/opportunities/opportunities-client.tsx",
    );
    const inbox = read("features/inbox/inbox-client.tsx");
    const meetings = read("app/(workspace)/meetings/page.tsx");
    const reports = read("features/reports/reports-client.tsx");
    const narrativeComponents = read(
      "components/shared/narrative-components.tsx",
    );
    const search = read("app/(workspace)/search/page.tsx");
    const operatingFoundation = read(
      "components/shared/operating-foundation-summary.tsx",
    );
    const detailOperatingSummary = read(
      "components/shared/detail-operating-summary-card.tsx",
    );
    const internalOperatingHome = read(
      "features/internal-operating-workspace/internal-operating-home.tsx",
    );
    const internalOperatingObjectCard = read(
      "features/internal-operating-workspace/object-card.tsx",
    );
    const dashboard = read("features/dashboard/goal-driven-home-surface.tsx");
    const roleDetailShell = read(
      "components/shared/role-conversation-detail-shell.tsx",
    );
    const workspacePreferences = read(
      "components/shared/workspace-surface-preferences.tsx",
    );

    expect(summary).toContain("getOperatingSummaryConnectionAriaLabel");
    expect(summary).toContain("connection.actionLabel");
    expect(summary).toContain(
      "return [connection.label, compactValue, compactAction]",
    );
    expect(workspacePreferences).toContain(
      'aria-label={`${label}: ${description}`}',
    );
    expect(guidance).toContain("aria-label={item.title}");
    expect(narrativeComponents).toContain("aria-label={item.label}");
    expect(operatingFoundation).toContain("aria-label={connection.label}");
    expect(detailOperatingSummary).toContain("return [connection.label, compactValue]");
    expect(detailOperatingSummary).not.toContain(
      "return [connection.label, connection.value, connection.description]",
    );
    expect(internalOperatingHome).toContain("aria-label={copy(item.label)}");
    expect(internalOperatingHome).toContain("aria-label={item.title}");
    expect(internalOperatingObjectCard).toContain(
      "aria-label={copy(card.title)}",
    );
    expect(dashboard).toContain("aria-label={item.label}");
    const dashboardSecondaryDisclosure = read(
      "components/shared/dashboard-home-secondary-disclosure.tsx",
    );
    expect(dashboardSecondaryDisclosure).toContain("aria-label={title}");
    expect(roleDetailShell).toContain(
      "getRoleOperatingSummaryConnectionAriaLabel",
    );
    expect(roleDetailShell).toContain(
      "getRoleOperatingSummaryConnectionDescription(connection)",
    );
    expect(roleDetailShell).toContain("return [connection.label, compactValue]");
    expect(roleDetailShell).not.toContain(
      "return [\n    connection.label,\n    connection.value,\n    getRoleOperatingSummaryConnectionDescription(connection),\n  ]",
    );
    expect(roleDetailShell).toContain("const nextActionDescription =");
    expect(search).toContain("Open contact:");
    expect(opportunities).toContain("Open opportunity:");
    expect(opportunities).toContain('actionLabel: english ? "Open account"');
    expect(opportunities).toContain('actionLabel: english ? "Open contact"');
    expect(opportunities).toContain("归你负责");
    expect(opportunities).not.toContain("owner-focused 视角");
    expect(inbox).toContain("Open thread:");
    expect(meetings).toContain("Open meeting:");
    expect(reports).toContain("Select last week report");
  });

  it("keeps searched and drawer-driven paths action-first and localized", () => {
    const search = read("app/(workspace)/search/page.tsx");
    const opportunities = read(
      "features/opportunities/opportunities-client.tsx",
    );

    expect(search).toContain("先定位对象，再进入对应页面处理");
    expect(search).toContain("提问只返回来源和下一步");
    expect(search).toContain("不外发、不改状态");
    expect(search).toContain("提问");
    expect(search).toContain("Questions return sources and a next step");
    expect(search).not.toContain("搜索页是跳转入口");
    expect(search).not.toContain("搜索结果可以直接跳转");

    expect(opportunities).toContain(
      'closeLabel={english ? "Close opportunity details" : "关闭机会详情"}',
    );
    expect(opportunities).not.toContain("直接编辑下一步动作");
    expect(opportunities).not.toContain("完成大部分推进更新");
  });

  it("keeps workspace sheet close actions explicit for both locales", () => {
    const sheetUsageFiles = [
      "components/layout/command-palette.tsx",
      "components/layout/topbar.tsx",
      "features/approvals/approvals-client.tsx",
      "features/conversation-capture/capture-session-panel.tsx",
      "features/meetings/meeting-detail-client.tsx",
      "features/opportunities/opportunities-client.tsx",
    ] as const;

    for (const relativePath of sheetUsageFiles) {
      const source = read(relativePath);
      const sheetContentTags = source.match(/<SheetContent\b[\s\S]*?>/g) ?? [];

      expect(sheetContentTags.length).toBeGreaterThan(0);
      for (const tag of sheetContentTags) {
        expect(tag).toContain("closeLabel=");
      }
    }
  });

  it("keeps topbar sheets described for screen reader navigation", () => {
    const topbar = read("components/layout/topbar.tsx");

    expect(topbar).toContain("SheetDescription");
    expect(topbar).toContain(
      "Review approval pressure, risk signals and policy changes",
    );
    expect(topbar).toContain(
      "Create opportunities, contacts and meetings from any page",
    );
    expect(topbar).toContain(
      "Navigate today, customer work, reviews, memory and the workspace foundation.",
    );
    expect(topbar).toContain(
      "进入今天要处理的事、客户资产、复核记录和工作区设置。",
    );
    expect(topbar).not.toContain("Missing `Description`");
  });

  it("keeps capture reachable as a secondary workspace tool instead of only a recording button", () => {
    const sidebar = read("components/layout/sidebar.tsx");
    const topbar = read("components/layout/topbar.tsx");

    expect(sidebar).toContain('href: "/capture"');
    expect(sidebar).toContain("messages.shell.nav.capture");
    expect(sidebar).toContain("Mic className=");

    expect(topbar).toContain('{ href: "/capture", label: messages.shell.nav.capture }');
    expect(topbar).toContain(
      "Data sources, field notes, outcome change and readiness checks",
    );
    expect(topbar).toContain(
      "数据接入、现场记录、效果变化和就绪检查统一留在基础层。",
    );
  });

  it("keeps workspace navigation grouped by user workstream instead of flat product modules", () => {
    const sidebar = read("components/layout/sidebar.tsx");
    const topbar = read("components/layout/topbar.tsx");
    const homeWorkEntry = read("features/dashboard/home-work-entry-surface.tsx");

    expect(sidebar).toContain("今天要处理");
    expect(sidebar).toContain("客户资产");
    expect(sidebar).toContain("复核与记录");
    expect(sidebar).toContain('href: "/inbox"');
    expect(sidebar).toContain("messages.shell.nav.mobile");

    expect(topbar).toContain("primaryNavSections");
    expect(topbar).toContain("客户资产");
    expect(topbar).toContain("复核与记录");
    expect(topbar).toContain('href: "/inbox"');

    expect(homeWorkEntry).toContain(
      'data-dashboard-work-entry-supporting-context="true"',
    );
    expect(homeWorkEntry).toContain("展开候选项与依据");
    expect(homeWorkEntry).not.toContain("Helm 已把本批分案汇总");
  });

  it("keeps capture result policy copy from reading as automatic external execution", () => {
    const panel = read(
      "features/conversation-capture/capture-result-panel.tsx",
    );
    const displayCopy = read("features/conversation-capture/display-copy.ts");

    expect(panel).toContain("CaptureActionModeBadge");
    expect(panel).toContain("Prepared inside policy boundary");
    expect(panel).toContain("策略内准备");
    expect(panel).toContain("governed routing chain");
    expect(panel).toContain("受控路由链");
    expect(panel).not.toContain("<ActionModeBadge");
    expect(panel).not.toContain("actionModeLabels");
    expect(displayCopy).toContain("条件内准备");
    expect(displayCopy).toContain("受控路由链路");
  });

  it("keeps conversation capture Chinese copy localized without changing capture boundaries", () => {
    const capturePage = read("app/(workspace)/capture/page.tsx");
    const sessionPanel = read(
      "features/conversation-capture/capture-session-panel.tsx",
    );
    const resultPanel = read(
      "features/conversation-capture/capture-result-panel.tsx",
    );
    const combined = `${capturePage}\n${sessionPanel}\n${resultPanel}`;

    expect(capturePage).toContain("改写客户关系管理系统");
    expect(capturePage).toContain("Helm会在后台生成转写文本");
    expect(capturePage).toContain("Helm会先把会话里的阻塞");
    expect(sessionPanel).toContain("Helm会把转写文本转成事实");
    expect(sessionPanel).toContain("浏览器录音最小可用版");
    expect(sessionPanel).toContain("Helm会改用你输入的速记文本");
    expect(resultPanel).toContain("Helm已经把转写文本里最重要的经营信号提出来");
    expect(resultPanel).toContain("Helm会把这条动作继续送入受控路由链");
    expect(resultPanel).toContain("Helm不会强行制造新的建议");

    expect(combined).not.toMatch(
      /改写 CRM|Helm 会|Helm 已经|Helm 不会|浏览器录音 MVP/,
    );
  });

  it("keeps the highest-traffic business surfaces focused on action before guidance and secondary explanation", () => {
    const operating = read(
      "features/internal-operating-workspace/internal-operating-home.tsx",
    );
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const opportunities = read(
      "features/opportunities/opportunities-client.tsx",
    );
    const approvals = read("features/approvals/approvals-client.tsx");
    const imports = read("features/imports/imports-client.tsx");
    const inbox = read("features/inbox/inbox-client.tsx");
    const reports = read("features/reports/reports-client.tsx");
    const diagnostics = read("features/diagnostics/diagnostics-client.tsx");

    expect(operating).not.toContain("<BusinessFirstSurfaceSummary");
    expect(operating).not.toContain("<WorkspaceGuidancePanel");
    expect(operating).not.toContain("<WorkspaceSurfacePreferences");

    expect(queueView.indexOf("<DetailOperatingSummaryCard")).toBeGreaterThan(
      -1,
    );
    expect(queueView.indexOf("<DetailOperatingSummaryCard")).toBeLessThan(
      queueView.indexOf("<DecisionRequestCard"),
    );
    expect(queueView.indexOf("<DetailOperatingSummaryCard")).toBeLessThan(
      queueView.indexOf("<WhyItMattersBlock"),
    );

    expect(opportunities).not.toContain("<BusinessFirstSurfaceSummary");
    expect(opportunities).not.toContain("<WorkspaceGuidancePanel");
    expect(opportunities).not.toContain("<WorkspaceSurfacePreferences");
    expect(opportunities).toContain('id="opportunity-workspace"');

    expect(approvals).toContain('id="approval-queue"');
    expect(approvals).not.toContain("<BusinessFirstSurfaceSummary");
    expect(approvals).not.toContain("<WorkspaceGuidancePanel");

    for (const surface of [imports, inbox, reports, diagnostics]) {
      expect(surface).not.toContain("<BusinessFirstSurfaceSummary");
      expect(surface).not.toContain("<WorkspaceGuidancePanel");
      expect(surface).not.toContain("<WorkspaceSurfacePreferences");
    }
  });

  it("keeps the business-first summary contract anchored on the same four categories", () => {
    const contract = read(
      "lib/presentation/business-first-surface-contract.ts",
    );
    const sharedComponent = read(
      "components/shared/business-first-surface-summary.tsx",
    );
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const operating = read(
      "features/internal-operating-workspace/internal-operating-home.tsx",
    );
    const opportunities = read(
      "features/opportunities/opportunities-client.tsx",
    );
    const approvals = read("features/approvals/approvals-client.tsx");
    const imports = read("features/imports/imports-client.tsx");
    const inbox = read("features/inbox/inbox-client.tsx");
    const reports = read("features/reports/reports-client.tsx");
    const diagnostics = read("features/diagnostics/diagnostics-client.tsx");

    expect(contract).toContain(
      'objectState: english ? "Object state" : "对象状态"',
    );
    expect(contract).toContain('blocker: english ? "Blocker" : "阻塞"');
    expect(contract).toContain(
      'pendingDecision: english ? "Pending decision" : "待决策"',
    );
    expect(contract).toContain(
      'nextAction: english ? "Next action" : "下一步动作"',
    );
    expect(contract).toContain("buildBusinessFirstSummaryItems");
    expect(sharedComponent).toContain("buildBusinessFirstSummaryItems");

    expect(queueView).toContain("getBusinessFirstSummaryLabels(english)");

    for (const surface of [
      operating,
      opportunities,
      approvals,
      imports,
      inbox,
      reports,
      diagnostics,
    ]) {
      expect(surface).not.toContain("<BusinessFirstSurfaceSummary");
    }
  });

  it("keeps operator-heavy surfaces from re-expanding explanation above the business-first summary", () => {
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const operating = read(
      "features/internal-operating-workspace/internal-operating-home.tsx",
    );
    const opportunities = read(
      "features/opportunities/opportunities-client.tsx",
    );
    const approvals = read("features/approvals/approvals-client.tsx");
    const imports = read("features/imports/imports-client.tsx");
    const inbox = read("features/inbox/inbox-client.tsx");
    const reports = read("features/reports/reports-client.tsx");
    const diagnostics = read("features/diagnostics/diagnostics-client.tsx");

    expect(queueView).not.toContain("briefing={{");
    expect(queueView).not.toContain("briefing={model");
    expect(queueView.match(/data-frontstage-block=/g) ?? []).toHaveLength(4);
    expect(
      queueView.indexOf('data-frontstage-block="current-summary"'),
    ).toBeLessThan(
      queueView.indexOf('data-frontstage-block="decision-request"'),
    );
    expect(
      queueView.indexOf('data-frontstage-block="decision-request"'),
    ).toBeLessThan(queueView.indexOf('data-frontstage-block="next-action"'));
    expect(
      queueView.indexOf('data-frontstage-block="next-action"'),
    ).toBeLessThan(queueView.indexOf('data-frontstage-block="boundary"'));
    expect(queueView.indexOf("<DetailOperatingSummaryCard")).toBeLessThan(
      queueView.indexOf("<ReviewSnapshotBlock"),
    );
    expect(queueView.indexOf("<ReviewSnapshotBlock")).toBeLessThan(
      queueView.indexOf("<WhyItMattersBlock"),
    );

    for (const surface of [operating, imports, inbox, reports, diagnostics]) {
      expect(surface).not.toContain("briefing={");
      expect(surface).not.toContain("<BusinessFirstSurfaceSummary");
      expect(surface).not.toContain("<WorkspaceGuidancePanel");
    }

    expect(opportunities).not.toContain("briefing={");
    expect(opportunities).toContain("<HomeSurfaceArrivalBanner");
    expect(opportunities).not.toContain("<BusinessFirstSurfaceSummary");
    expect(opportunities).not.toContain("<WorkspaceGuidancePanel");

    expect(approvals).not.toContain("briefing={");
    expect(approvals).toContain("<HomeSurfaceArrivalBanner");
    expect(approvals).toContain('id="approval-queue"');
    expect(approvals).not.toContain("<BusinessFirstSurfaceSummary");
    expect(approvals).not.toContain("<WorkspaceGuidancePanel");
  });

  it("keeps repeat-use guidance and system self-narration behind disclosures by default", () => {
    const guidancePanel = read(
      "components/shared/workspace-guidance-panel.tsx",
    );
    const controlledDisclosure = read(
      "components/shared/controlled-disclosure.tsx",
    );
    const narrativeComponents = read(
      "components/shared/narrative-components.tsx",
    );
    const dashboard = read("features/dashboard/goal-driven-home-surface.tsx");
    const meetingDetail = read("features/meetings/meeting-detail-client.tsx");

    expect(guidancePanel).toContain("ControlledDisclosure");
    expect(controlledDisclosure).toContain("<details");
    expect(guidancePanel).toContain("defaultExpanded = false");
    expect(guidancePanel).toContain("workspace-guidance-meta-pill");
    expect(narrativeComponents).toContain("data-narrative-disclosure");
    expect(narrativeComponents).toContain(
      'dataAttribute="data-why-it-matters-block"',
    );
    expect(narrativeComponents).toContain(
      'dataAttribute="data-review-snapshot-block"',
    );
    expect(dashboard).not.toContain("items={model.helmDid}");
    expect(dashboard).not.toContain("what Helm already moved");
    expect(dashboard).not.toContain("what is already moving");
    expect(meetingDetail).toContain("data-meeting-review-snapshot");
    expect(meetingDetail).toContain("meetingReviewSnapshotSummary");
    expect(meetingDetail).toContain("Review snapshot");
    expect(meetingDetail).not.toContain("当前 review posture 与已准备内容");
    expect(meetingDetail).not.toContain(
      "Helm is already using these linked objects to shape briefing",
    );
  });

  it("keeps dashboard home work-entry ahead of explanatory readouts and pushes secondary context behind disclosures", () => {
    const dashboardPage = read("app/(workspace)/dashboard/page.tsx");
    const homeWorkEntry = read("features/dashboard/home-work-entry.ts");
    const surfaceRouting = read("features/dashboard/home-surface-routing.ts");
    const arrivalBanner = read(
      "components/shared/home-surface-arrival-banner.tsx",
    );
    const homeSurfaceSecondaryDisclosure = read(
      "components/shared/home-surface-secondary-disclosure.tsx",
    );
    const opportunities = read(
      "features/opportunities/opportunities-client.tsx",
    );
    const approvals = read("features/approvals/approvals-client.tsx");
    const memory = read("features/memory/memory-client.tsx");
    const contacts = read("features/contacts/contact-detail-client.tsx");
    const companies = read("features/companies/company-detail-client.tsx");
    const meetings = read("features/meetings/meeting-detail-client.tsx");

    expect(dashboardPage).not.toContain("briefing={headerBriefing}");
    expect(dashboardPage).toContain("<DashboardHomeWorkEntrySurface");
    expect(dashboardPage).not.toContain("<DashboardHomeSecondaryDisclosure");
    expect(dashboardPage).not.toContain("dashboardHomeSecondaryVisibility");
    expect(dashboardPage).not.toContain("<GoalDrivenHomeSurface");
    expect(dashboardPage).not.toContain("<DashboardHomeSurfaceRoutingPanel");
    expect(dashboardPage).not.toContain('kind="detailed-readouts"');
    expect(dashboardPage).not.toContain(
      "dashboardHomeSecondaryVisibility.showDetailedReadouts",
    );
    expect(homeWorkEntry).toContain(
      "export function getDashboardHomeSecondaryVisibility",
    );
    expect(homeWorkEntry).toContain('case "empty-new"');
    expect(homeWorkEntry).not.toContain("showDetailedReadouts");
    expect(homeWorkEntry).toContain("showSurfaceRouting: true");
    expect(surfaceRouting).toContain('id: "detail"');
    expect(surfaceRouting).toContain('id: "approvals"');
    expect(surfaceRouting).toContain('id: "memory"');
    expect(surfaceRouting).toContain('entry", `home-surface-${kind}`');
    expect(surfaceRouting).toContain('searchParams.set("focus", focus)');
    expect(arrivalBanner).toContain("export function useHomeSurfaceArrival");
    expect(arrivalBanner).toContain("data-home-surface-arrival-cta");
    expect(arrivalBanner).toContain("This page owns");
    expect(arrivalBanner).toContain("Start here");
    expect(homeSurfaceSecondaryDisclosure).toContain(
      "data-home-surface-secondary",
    );
    expect(homeSurfaceSecondaryDisclosure).toContain("<ControlledDisclosure");
    expect(homeSurfaceSecondaryDisclosure).toContain("Next layer");
    expect(opportunities).toContain("<HomeSurfaceArrivalBanner");
    expect(opportunities).toContain('useHomeSurfaceArrival("detail")');
    expect(opportunities).not.toContain("<BusinessFirstSurfaceSummary");
    expect(opportunities).not.toContain("<WorkspaceGuidancePanel");
    expect(opportunities).toContain('id="opportunity-workspace"');
    expect(approvals).toContain("<HomeSurfaceArrivalBanner");
    expect(approvals).toContain('useHomeSurfaceArrival("approvals")');
    expect(approvals).toContain('id="approval-queue"');
    expect(approvals).not.toContain("<BusinessFirstSurfaceSummary");
    expect(approvals).not.toContain("<WorkspaceGuidancePanel");
    expect(memory).toContain("<HomeSurfaceArrivalBanner");
    expect(memory).toContain("<HomeSurfaceSecondaryDisclosure");
    expect(memory).toContain('kind="memory"');
    expect(memory).toContain("contract={{");
    expect(memory).toContain('useHomeSurfaceArrival("memory")');
    expect(memory).toContain("ctaHref: `#${memoryLandingAnchor}`");
    expect(memory).toContain("memoryHomeArrival.isHomeSurfaceArrival ? (");
    expect(memory).toContain("const memoryLandingDeferredContext = (");
    expect(memory).toContain(
      "const memoryMeetingWorkspaceContext = meetingStateSnapshot ? (",
    );
    expect(memory).toContain('data-memory-home-meeting-secondary="true"');
    expect(memory).toContain(
      "Open meeting follow-through, governance and replay context only when needed",
    );
    expect(contacts).toContain("<HomeSurfaceArrivalBanner");
    expect(contacts).toContain('kind="detail"');
    expect(contacts).toContain("<WorkspaceGuidancePanel");
    expect(companies).toContain("<HomeSurfaceArrivalBanner");
    expect(companies).toContain('kind="detail"');
    expect(companies).toContain("<WorkspaceGuidancePanel");
    expect(meetings).toContain("<HomeSurfaceArrivalBanner");
    expect(meetings).toContain('kind="detail"');
    expect(meetings).toContain("<WorkspaceGuidancePanel");
  });

  it("keeps the operating home free of the old business-first summary shell", () => {
    const operating = read(
      "features/internal-operating-workspace/internal-operating-home.tsx",
    );
    expect(operating).not.toContain("<BusinessFirstSurfaceSummary");
    expect(operating).not.toContain("<WorkspaceGuidancePanel");
    expect(operating).not.toContain("<WorkspaceSurfacePreferences");
  });

  it("keeps dashboard reusing the shared business-loop gap readout while reports stay on direct work surfaces", () => {
    const _dashboardPage = read("app/(workspace)/dashboard/page.tsx");
    const dashboardLoader = read("features/dashboard/page-loader.ts");
    const dashboardSurface = read(
      "features/dashboard/goal-driven-home-surface.tsx",
    );
    const reportsSurface = read("features/reports/reports-client.tsx");
    const runtimeUpgrade = read("lib/helm-v2/runtime-upgrade.ts");

    expect(dashboardLoader).toContain("getWorkspaceBusinessLoopGapReadout");
    expect(dashboardSurface).toContain("buildBusinessLoopGapReadout");
    expect(reportsSurface).not.toContain("<BusinessFirstSurfaceSummary");
    expect(reportsSurface).not.toContain("<WorkspaceGuidancePanel");
    expect(runtimeUpgrade).toContain(
      "export async function getWorkspaceBusinessLoopGapReadout",
    );
  });

  it("keeps inbox and diagnostics reusing the shared business-loop gap readout instead of forking page-local logic", () => {
    const inboxPage = read("app/(workspace)/inbox/page.tsx");
    const inboxSurface = read("features/inbox/inbox-client.tsx");
    const diagnosticsPage = read("app/(workspace)/diagnostics/page.tsx");
    const diagnosticsSurface = read(
      "features/diagnostics/diagnostics-client.tsx",
    );
    const runtimeUpgrade = read("lib/helm-v2/runtime-upgrade.ts");

    expect(inboxPage).toContain("getWorkspaceBusinessLoopGapReadout");
    expect(inboxSurface).toContain("buildBusinessLoopGapReadout");
    expect(diagnosticsPage).toContain("getWorkspaceBusinessLoopGapReadout");
    expect(diagnosticsSurface).toContain("buildBusinessLoopGapReadout");
    expect(runtimeUpgrade).toContain(
      "export async function getWorkspaceBusinessLoopGapReadout",
    );
  });

  it("keeps approvals and imports reusing the shared business-loop gap readout instead of forking page-local logic", () => {
    const approvalsLoader = read("features/approvals/page-loader.ts");
    const approvalsSurface = read("features/approvals/approvals-client.tsx");
    const importsPage = read("app/(workspace)/imports/page.tsx");
    const importsSurface = read("features/imports/imports-client.tsx");
    const runtimeUpgrade = read("lib/helm-v2/runtime-upgrade.ts");

    expect(approvalsLoader).toContain("getWorkspaceBusinessLoopGapReadout");
    expect(approvalsSurface).toContain("buildBusinessLoopGapReadout");
    expect(importsPage).toContain("getWorkspaceBusinessLoopGapReadout");
    expect(importsSurface).toContain("buildBusinessLoopGapReadout");
    expect(runtimeUpgrade).toContain(
      "export async function getWorkspaceBusinessLoopGapReadout",
    );
  });

  it("keeps opportunities reusing the shared business-loop gap readout instead of forking page-local logic", () => {
    const opportunitiesPage = read("app/(workspace)/opportunities/page.tsx");
    const opportunitiesLoader = read("features/opportunities/page-loader.ts");
    const opportunitiesSurface = read(
      "features/opportunities/opportunities-client.tsx",
    );
    const runtimeUpgrade = read("lib/helm-v2/runtime-upgrade.ts");

    expect(opportunitiesPage).toContain(
      "businessLoopGapSummary={businessLoopGapSummary}",
    );
    expect(opportunitiesLoader).toContain("getWorkspaceBusinessLoopGapReadout");
    expect(opportunitiesSurface).toContain("buildBusinessLoopGapReadout");
    expect(runtimeUpgrade).toContain(
      "export async function getWorkspaceBusinessLoopGapReadout",
    );
  });

  it("keeps customer-success queue reusing the shared business-loop gap readout instead of forking page-local logic", () => {
    const customerSuccessPage = read(
      "app/(workspace)/customer-success/page.tsx",
    );
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const runtimeUpgrade = read("lib/helm-v2/runtime-upgrade.ts");

    expect(customerSuccessPage).toContain("getWorkspaceBusinessLoopGapReadout");
    expect(customerSuccessPage).toContain(
      "businessLoopGapReadout.businessLoopGapSummary",
    );
    expect(queueView).toContain("buildBusinessLoopGapReadout");
    expect(runtimeUpgrade).toContain(
      "export async function getWorkspaceBusinessLoopGapReadout",
    );
  });

  it("keeps the shared business-loop gap helper as the only allowed page-level mapping entrypoint", () => {
    for (const relativePath of businessLoopGapReadoutGuardedSurfaces) {
      const surface = read(relativePath);

      expect(surface).toContain("buildBusinessLoopGapReadout");
      expect(surface).toContain(
        "const businessLoopGapReadout = buildBusinessLoopGapReadout",
      );
      expect(surface).not.toContain("businessLoopGapSummary.primaryGap");
    }
  });

  it("keeps Computer Use surfaced Chinese paths away from raw system wording", () => {
    const firstLoop = [
      read("lib/operating-system/first-loop.ts"),
      read("components/shared/first-loop-surface-summary.tsx"),
    ].join("\n");
    const browsedSurfaces = [
      read("features/analytics/analytics-client.tsx"),
      read("features/imports/imports-client.tsx"),
      read("features/inbox/inbox-client.tsx"),
      read("features/diagnostics/diagnostics-client.tsx"),
      read("features/settings/settings-client.tsx"),
    ].join("\n");
    const commandPalette = read("components/layout/command-palette.tsx");
    const alertDisplayCopy = read("components/layout/alert-display-copy.ts");
    const seededBusinessCopy = read("lib/presentation/seeded-business-copy.ts");
    const topbar = read("components/layout/topbar.tsx");
    const internalOperatingHome = read(
      "features/internal-operating-workspace/internal-operating-home.tsx",
    );
    const gtmCapabilityPlanReadout = read(
      "lib/gtm-capability-plan-readout.ts",
    );
    const accountSettings = read(
      "features/settings/components/account-settings-tab.tsx",
    );
    const labels = read("lib/i18n/labels.ts");
    const constants = read("data/constants.ts");

    expect(firstLoop).toContain("回到事项");
    expect(firstLoop).not.toMatch(/推导锚点|大概率应该先重开/);

    expect(browsedSurfaces).not.toMatch(/这页应该先|导入页应该先|设置页应该先/);
    expect(browsedSurfaces).not.toContain("事件埋点");
    expect(browsedSurfaces).not.toContain("当前阻碍");
    expect(browsedSurfaces).not.toContain("阻碍命中");
    expect(browsedSurfaces).not.toContain("自动发送路径");
    expect(browsedSurfaces).toContain(
      "const policyName = formatSettingsCommercialText",
    );
    expect(browsedSurfaces).toContain("不启用无人确认的发送路径");
    expect(labels).not.toContain("内部纪要可自动发送");
    expect(labels).toContain("内部纪要按规则发送");
    expect(constants).not.toContain("内部纪要可自动发送");
    expect(constants).toContain("内部纪要按规则发送");
    expect(browsedSurfaces).not.toContain(
      'recommendationsLabel={english ? "Recommended next moves" : "建议先看"}',
    );
    expect(browsedSurfaces).not.toContain(
      'remindersLabel={english ? "Context reminders" : "上下文提醒"}',
    );

    expect(commandPalette).not.toMatch(/演示时快速切页|顺着讲 demo/);
    expect(commandPalette).toContain(
      'english ? "Ask workspace" : "问当前工作区"',
    );
    expect(commandPalette).not.toContain("问 Helm");
    expect(commandPalette).not.toContain("Ask Helm");
    expect(commandPalette).toContain(
      "formatShellAlertText(alert.body, english)",
    );
    expect(commandPalette).toContain(
      "formatShellAlertText(alert.title, english)",
    );
    expect(topbar).toContain("formatShellAlertText(alert.title, english)");
    expect(topbar).toContain("formatShellAlertText(alert.body, english)");
    expect(accountSettings).toContain(
      "formatShellAlertText(notification.title, english)",
    );
    expect(accountSettings).toContain(
      "formatShellAlertText(notification.body, english)",
    );
    expect(internalOperatingHome).toContain('"交接检查"');
    expect(internalOperatingHome).toContain(
      'english ? "ActionItem + ApprovalTask" : "动作项 + 审批任务"',
    );
    expect(internalOperatingHome).toContain("gtmControlStatusLabel");
    expect(internalOperatingHome).toContain(
      "当前没有可生成客户需求简报草稿候选的申请。",
    );
    expect(internalOperatingHome).not.toContain("Clean handoff 检查");
    expect(internalOperatingHome).not.toContain(
      "当前没有可生成 CustomerDemandBrief 草稿候选的申请。",
    );
    expect(gtmCapabilityPlanReadout).toContain("保留干净交接");
    expect(gtmCapabilityPlanReadout).toContain("销售预填与自助进入共用同一份客户需求简报契约");
    expect(gtmCapabilityPlanReadout).toContain("客户可见摘要必须先人工复核");
    expect(gtmCapabilityPlanReadout).toContain("试用初始化数据不夹带转介绍、结算或贡献归因");
    expect(alertDisplayCopy).toContain('[/\\bblocker\\b/gi, "阻塞"]');
    expect(alertDisplayCopy).toContain('[/\\bdeals\\b/gi, "机会"]');
    expect(alertDisplayCopy).toContain('[/\\bnotes\\b/gi, "记录"]');
    expect(alertDisplayCopy).toContain('[/today focus/gi, "今日重点"]');
    expect(alertDisplayCopy).toContain('[/meeting_followup/g, "会后跟进"]');
    expect(seededBusinessCopy).toContain('[/\\bchampion\\b/gi, "支持人"]');
  });

  it("keeps customer offer and commercial narrative Chinese boundary copy free of mixed spacing", () => {
    const customerOfferModel = read(
      "features/customer-facing-offer-external-proposal/detail-model.ts",
    );
    const customerOfferView = read(
      "features/customer-facing-offer-external-proposal/detail-view.tsx",
    );
    const commercialModel = read(
      "features/commercial-narrative-strengthening/detail-model.ts",
    );
    const commercialView = read(
      "features/commercial-narrative-strengthening/detail-view.tsx",
    );
    const combined = [
      customerOfferModel,
      customerOfferView,
      commercialModel,
      commercialView,
    ].join("\n");

    expect(customerOfferModel).toContain(
      "仅讨论表示当前页面只适合讨论，不适合承诺、强化预期或暗示承诺。",
    );
    expect(customerOfferView).toContain("客户可见提案详情页");
    expect(customerOfferView).toContain("复核闸口前面");
    expect(customerOfferView).toContain("打开对外叙事详情面");
    expect(commercialModel).toContain("信任敏感措辞");
    expect(commercialModel).toContain(
      "内部异议、依赖修复和未解决的信任备注仍然只适合仅内部。",
    );
    expect(commercialModel).toContain("受复核约束");
    expect(commercialModel).toContain("边界优先复核");
    expect(commercialModel).toContain("轻量客户可见措辞");
    expect(commercialModel).toContain("仅讨论措辞");
    expect(commercialView).toContain("商业叙事加固详情页");

    expect(combined).not.toMatch(
      /仅讨论 表示|客户可见提案 详情页|复核闸口 前面|打开 对外叙事详情面|信任敏感 措辞|internal 异议|复核-bound|边界-led|客户可见-light|仅讨论 措辞|commercial 加固详情页/,
    );
  });

  it("keeps role definition and participant portal copy free of mixed Chinese fragments", () => {
    const rolePresets = read("lib/definitions/role-presets.ts");
    const roleFoundations = read("lib/definitions/role-foundations.ts");
    const participantActions = read("features/participant-portal/actions.ts");
    const combined = [rolePresets, roleFoundations, participantActions].join(
      "\n",
    );

    expect(rolePresets).toContain("把需复核的对外动作留在可见边界内");
    expect(rolePresets).toContain("哪些动作需要先内部同步");
    expect(rolePresets).toContain("招聘团队的推进节奏连续");
    expect(rolePresets).toContain("候选人简报不等于正式录用通知");
    expect(rolePresets).toContain("把后续跟进写回客户上下文");
    expect(rolePresets).toContain("明确交付下一步和负责人");
    expect(rolePresets).toContain("向客户成功说明上线后跟进");
    expect(rolePresets).toContain("内部就绪度不等于对外可用");
    expect(rolePresets).toContain("仍需保留复核和发布守卫");
    expect(rolePresets).toContain("向负责人 / 管理员升级治理问题");
    expect(rolePresets).toContain("向复核面补齐证据");
    expect(roleFoundations).toContain("试点就绪度诊断");
    expect(roleFoundations).toContain("这只是起步能力建议资料。");
    expect(roleFoundations).toContain("本周优先动作");
    expect(roleFoundations).toContain("提案澄清和异议处理");
    expect(roleFoundations).toContain("帮助客户销售更快产出");
    expect(roleFoundations).toContain("帮助客户成功在客户沉默");
    expect(roleFoundations).toContain("季度业务回顾");
    expect(roleFoundations).toContain("实施启动会");
    expect(roleFoundations).toContain("拆动作项");
    expect(roleFoundations).toContain("起步能力姿态仍需要继续");
    expect(participantActions).toContain(
      "Please complete profile, payout details, and contribution terms acknowledgement.",
    );

    expect(combined).not.toMatch(
      /复核-required|哪些动作需要先 internal sync|哪些沟通要先 internal sync|hiring 判断|hiring team 的|hiring 负责人|正式 offer|issue 升级|把 follow-through|向 CS 说明上线后 follow-through|交付 下一步|识别 时间线|向运营说明 rollout 节奏|内部 就绪度|对外 ready|仍需保留复核和 rollout guard|负责人\/admin|复核面 补齐|试点 就绪度|starter skill suggestion 资料|候选 capability|正式 skill|top 动作|提案 clarifications|时间线 或|帮助 AE|帮助 CS|issue 等待|适用于 QBR|实施 kick-off|动作item|starter skills 已|starter skill姿态|contribution terms 已确认/,
    );
  });

  it("keeps meeting action-pack runtime Chinese copy free of mixed operational fragments", () => {
    const actionPackRuntime = read(
      "lib/helm-v2/meeting-action-pack-runtime.ts",
    );

    expect(actionPackRuntime).toContain("从风险提醒或会中风险提示里抽出的推断");
    expect(actionPackRuntime).toContain("会议动作资料需要更强人工确认");
    expect(actionPackRuntime).toContain("会议 / 公司层");
    expect(actionPackRuntime).toContain("当前会议还没有关联公司");
    expect(actionPackRuntime).toContain("事实与推导继续分层保存");
    expect(actionPackRuntime).toContain("## 未决问题");
    expect(actionPackRuntime).toContain("暂无额外未决问题");
    expect(actionPackRuntime).toContain("先由人工确认动作资料");
    expect(actionPackRuntime).toContain("动作资料仍带有未决问题");
    expect(actionPackRuntime).toContain("总体继续沿会议动作资料推进");
    expect(actionPackRuntime).toContain("会议分析已把会议摘要");

    expect(actionPackRuntime).not.toMatch(
      /风险 alerts|meeting 动作资料|meeting \/ company|关联 company|明确 下一步|facts 与 推导|推导 默认不 晋升|Open questions|open question|确认 动作资料|动作资料 仍带有 未决问题|沿 meeting 动作资料|会议分析 已/,
    );
  });

  it("keeps Helm v2 event-flow and layered-memory descriptions free of mixed Chinese fragments", () => {
    const eventFlow = read("lib/helm-v2/event-flow.ts");
    const layeredMemory = read("lib/helm-v2/layered-memory.ts");
    const combined = `${eventFlow}\n${layeredMemory}`;

    expect(eventFlow).toContain("草稿已形成，需要进入风险与承诺边界检查。");
    expect(eventFlow).toContain("可继续低风险仅草稿行动层。");
    expect(eventFlow).toContain("交接资料已生成，可进入交付或客户成功接手面。");
    expect(eventFlow).toContain("人工确认会议事实，并触发对象经营记忆晋升。");
    expect(eventFlow).toContain("生成主管关注标记。");
    expect(eventFlow).toContain("交接资料和交付检查清单。");
    expect(layeredMemory).toContain("当前工作区的经营摘要始终可见。");
    expect(layeredMemory).toContain("已承诺范围、未决风险和前 14 天计划。");
    expect(layeredMemory).toContain("权威系统边界、审批矩阵和最近确认记录。");
    expect(layeredMemory).toContain("会议结束后加载相关会议 / 机会 / 客户摘要");
    expect(layeredMemory).toContain("最近执行证明");
    expect(layeredMemory).toContain("临时草稿只用于临时推理");
    expect(layeredMemory).toContain("学习到的模式必须先经人工确认");
    expect(layeredMemory).toContain("当前晋升规则为不晋升");
    expect(layeredMemory).toContain("权威系统校验");

    expect(combined).not.toMatch(
      /draft 已形成|低风险 draft-only 行动层|交接 资料|CS 接手面|触发 Meeting Analyst|人工确认 meeting facts|object 经营记忆 晋升|主管关注 标记|对 draft 制品|交付 checklist|当前 workspace 的经营摘要|promised 范围|open risks|first 14 day plan|进入 正式write 意图阶段|system-of-record 边界|最近 acknowledgement|相关 meeting \/ 机会|正式write 意图创建|受控正式集成 边界|执行 proof|scratch 只用于|learned pattern 必须|晋升 rule 当前是 none|system-of-record 校验/,
    );
  });

  it("keeps opportunity judge runtime Chinese output copy free of mixed operational fragments", () => {
    const opportunityJudge = read(
      "lib/helm-v2/opportunity-judge-runtime.ts",
    );

    expect(opportunityJudge).toContain("当前还缺少足够的决策标准");
    expect(opportunityJudge).toContain("当前仍缺少明确支持人 / 负责人");
    expect(opportunityJudge).toContain("预算或采购决策标准仍未确认");
    expect(opportunityJudge).toContain("需要主管复核措辞和让步边界");
    expect(opportunityJudge).toContain("升级给主管 / 操作员共同复核");
    expect(opportunityJudge).toContain("当前无需额外主管升级");
    expect(opportunityJudge).toContain("历史时间线当前主要指向");
    expect(opportunityJudge).toContain("已复用对象经营记忆");
    expect(opportunityJudge).toContain("当前支持人 / 负责人仍不明确");
    expect(opportunityJudge).toContain("已批准只表示允许把判断消费进阴影摘要");
    expect(opportunityJudge).toContain("下一步摘要已生成");
    expect(opportunityJudge).toContain("机会判断套件已就绪：阶段差异");
    expect(opportunityJudge).toContain("当前没有新增主管关注标记");
    expect(opportunityJudge).toContain("当前没有新增主管升级信号");

    expect(opportunityJudge).not.toMatch(
      /decision criteria|champion \/ 负责人|主管 复核|主管 \/操作员|额外 主管|仅阴影 复核|历史 timeline|object 经营记忆|判断 消费进阴影摘要|下一步摘要 已生成|操作员\/ 主管|stage差异|套件 已就绪|新增 主管 升级/,
    );
  });

  it("keeps human action execution runtime Chinese boundary copy free of mixed CRM spacing", () => {
    const humanAction = read("lib/helm-v2/human-action-execution-runtime.ts");

    expect(humanAction).toContain("正式CRM已更新");
    expect(humanAction).toContain("Helm已记录人工动作");
    expect(humanAction).toContain("已人工完成CRM/管线步骤");
    expect(humanAction).toContain("未自动替你写正式CRM");
    expect(humanAction).toContain("人工CRM/管线步骤");
    expect(humanAction).toContain("不是Helm自动正式写回");
    expect(humanAction).toContain("当前没有新增主管关注");
    expect(humanAction).toContain("正式CRM写回权限");

    expect(humanAction).not.toMatch(
      /正式 CRM|Helm 已记录|CRM 步骤|CRM \/ 管线|人工 scheduling|新增 主管关注|Helm 自动正式写回/,
    );
  });

  it("keeps public home Chinese entry copy localized for delivery engineers", () => {
    const publicHome = read("app/page.tsx");

    expect(publicHome).toContain("AI平台给你乐高积木");
    expect(publicHome).toContain("可复用的Apache-2.0核心工程");
    expect(publicHome).toContain("复用这套工具集");
    expect(publicHome).toContain("复刻仓库，用黄金路径检查链");
    expect(publicHome).toContain("投资回报材料今天不发");
    expect(publicHome).toContain("客户关系管理阶段还停在");
    expect(publicHome).toContain("这四条Helm都接住了");
    expect(publicHome).toContain("关键写路径打追踪编号");
    expect(publicHome).toContain("可复刻核心工程 · 先复核黄金路径");
    expect(publicHome).toContain("客户关系管理和人力系统");
    expect(publicHome).toContain("自己克隆仓库并跑黄金路径检查链");

    expect(publicHome).not.toMatch(
      /AI 平台|企业 AI|可 fork|Fork 这套|fork 仓库|Golden Path 检查链|ROI 材料|ROI 问题|CRM 阶段|关键写路径打 trace ID|Helm 已经|Helm 是|CRM 和 HR|clone 并跑/,
    );
  });

  it("keeps public login Chinese entry copy free of mixed Helm spacing", () => {
    const loginPage = read("app/(auth)/login/page.tsx");

    expect(loginPage).toContain("你的Helm组织");
    expect(loginPage).toContain("Helm已经知道你是谁");
    expect(loginPage).toContain("开通你的Helm试点工作区");
    expect(loginPage).toContain("回到你的Helm工作区");
    expect(loginPage).toContain("申请Helm Cloud试用");

    expect(loginPage).not.toMatch(
      /你的 Helm 组织|Helm 已经|开通你的 Helm 试点工作区|回到你的 Helm 工作区|申请 Helm Cloud 试用/,
    );
  });

  it("keeps global metadata and database banner Chinese copy localized", () => {
    const rootLayout = read("app/layout.tsx");
    const databaseBanner = read("components/shared/database-connection-banner.tsx");

    expect(rootLayout).toContain("面向企业AI交付工程师");
    expect(rootLayout).toContain("可复刻");
    expect(rootLayout).toContain("行业样板、连接器、评估门禁和商业智能制品");
    expect(databaseBanner).toContain("先连上公司VPN");
    expect(databaseBanner).toContain("VPN连接");
    expect(databaseBanner).toContain("请先连接公司VPN");

    expect(`${rootLayout}\n${databaseBanner}`).not.toMatch(
      /企业 AI|可 fork|vertical 样板|BI artefacts|先连上 VPN|VPN 连接|公司 VPN/,
    );
  });

  it("keeps public trial and demo Chinese entry copy localized", () => {
    const trialPage = read("app/trial/page.tsx");
    const demoPage = read("app/demo/page.tsx");
    const demoLoading = read("app/demo/loading.tsx");
    const combined = `${trialPage}\n${demoPage}\n${demoLoading}`;

    expect(trialPage).toContain("面向企业AI交付工程师");
    expect(trialPage).toContain("直接复刻开源仓库");
    expect(trialPage).toContain("在 GitHub 上复刻");
    expect(trialPage).toContain("Helm 会自动运行什么");
    expect(trialPage).toContain("会在哪些边界停下来");
    expect(trialPage).toContain("第一次一对一导览");
    expect(demoPage).toContain("团队第一天可复刻的行业样板");
    expect(demoPage).toContain("通用行业样板");
    expect(demoPage).toContain("客户关系管理导入");
    expect(demoPage).toContain("打开完整读数");
    expect(demoPage).toContain("不会写入CRM");
    expect(demoPage).toContain("自己克隆仓库并跑黄金路径检查链");
    expect(demoLoading).toContain("不会写回真实CRM");

    expect(combined).not.toMatch(
      /企业 AI|直接 fork|去 GitHub fork|Helm 自动跑什么|在哪条线停下来|day-1|vertical 样板|通用 vertical|CRM 导入|完整 readout|写 CRM|clone 并跑|Golden Path 检查链|真实 CRM/,
    );
  });
});
