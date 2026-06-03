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

    for (const fragment of [
      'text("founder cue")',
      'text("sales cue")',
      'text("delivery cue")',
      'text("customer-visible strengthening")',
      'text("internal-only wording")',
    ]) {
      expect(`${externalNarrativeView}\n${reinforcementView}`).not.toContain(fragment);
    }

    expect(externalNarrativeView).toContain('text("创始人提示")');
    expect(externalNarrativeView).toContain('text("销售提示")');
    expect(externalNarrativeView).toContain('text("交付提示")');
    expect(reinforcementView).toContain('text("客户可见加固")');
    expect(reinforcementView).toContain('text("仅内部话术")');
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
});
