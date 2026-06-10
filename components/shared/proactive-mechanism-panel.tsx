import {
  ActionRail,
  BoundaryNote,
  CollaborationRequestCard,
  DecisionRequestCard,
  EvidenceDrawer,
  NarrativeHeader,
  ReviewSnapshotBlock,
  WhyItMattersBlock,
  WorkerSummary,
} from "@/components/shared/narrative-components";
import type { ReactNode } from "react";
import type {
  ActiveReportAudience,
  ActiveReportDeliveryMode,
  ActiveReportPriority,
  ActiveReportType,
  CollaborationMode,
  ProactiveFlow,
} from "@/lib/presentation/proactive-mechanism";
import { cn } from "@/lib/utils";

export function ProactiveMechanismPanel({
  title,
  description,
  flows,
  english,
  className,
}: {
  title?: string;
  description?: string;
  flows: ProactiveFlow[];
  english: boolean;
  className?: string;
}) {
  return (
    <section
      data-active-reporting="true"
      className={cn(
        "workspace-shell-panel overflow-hidden rounded-[30px] text-[color:var(--foreground)]",
        className,
      )}
    >
      {(title || description) && (
        <div className="border-b border-[color:var(--border)] px-5 py-5 xl:px-6">
          {title ? (
            <p className="text-base font-semibold text-[color:var(--foreground)]">
              {title}
            </p>
          ) : null}
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
      )}

      <div className="space-y-4 px-5 py-5 xl:px-6 xl:py-6">
        {flows.map((flow) => (
          <ProactiveFlowCard
            key={flow.flowId}
            flow={flow}
            english={english}
          />
        ))}
      </div>
    </section>
  );
}

function ProactiveFlowCard({
  flow,
  english,
}: {
  flow: ProactiveFlow;
  english: boolean;
}) {
  const decisionItems = [
    ...(flow.activeReport.activeReportDecisionRequest
      ? [flow.activeReport.activeReportDecisionRequest]
      : []),
    ...(flow.collaboration.collaborationDecisionRequest
      ? [flow.collaboration.collaborationDecisionRequest]
      : []),
  ];

  return (
    <article
      data-proactive-flow={flow.flowId}
      data-active-report-type={flow.activeReport.activeReportType}
      data-collaboration-mode={flow.collaboration.collaborationMode}
      className="workspace-panel rounded-[28px] p-5"
    >
      <div className="flex flex-wrap gap-2 pb-4">
        <FlowBadge>
          {labelForReportType(flow.activeReport.activeReportType, english)}
        </FlowBadge>
        <FlowBadge tone={toneForPriority(flow.activeReport.activeReportPriority)}>
          {labelForPriority(flow.activeReport.activeReportPriority, english)}
        </FlowBadge>
        <FlowBadge tone="violet">
          {labelForDeliveryMode(flow.activeReport.activeReportDeliveryMode, english)}
        </FlowBadge>
        {flow.activeReport.activeReportAudience.map((audience) => (
          <FlowBadge key={audience} tone="emerald">
            {labelForAudience(audience, english)}
          </FlowBadge>
        ))}
      </div>

      <div data-page-layer="frontstage" className="space-y-5">
        <div
          data-frontstage-block="current-summary"
          data-active-report-summary="true"
        >
          <NarrativeHeader
            label={english ? "Current summary" : "当前状态"}
            title={flow.activeReport.activeReportSummary}
            summary={flow.activeReport.activeReportReason}
            prioritySignal={labelForPriority(
              flow.activeReport.activeReportPriority,
              english,
            )}
          />
        </div>

        <div data-frontstage-block="decision-request">
          <DecisionRequestCard
            label={english ? "Decision request" : "待拍板事项"}
            items={
              decisionItems.length
                ? decisionItems
                : [
                    english
                      ? "No explicit decision is blocking this flow yet."
                      : "当前还没有需要立即拍板的事项。",
                  ]
            }
          />
        </div>

        <div data-frontstage-block="next-action">
          <ActionRail
            label={english ? "Next action" : "下一步动作"}
            actions={flow.nextActions}
          />
        </div>

        <div data-frontstage-block="boundary">
          <BoundaryNote
            label={english ? "Boundary" : "边界"}
            items={[
              ...flow.activeReport.activeReportBoundary,
              ...flow.collaboration.collaborationBoundary,
            ]}
            escalationHint={flow.collaboration.collaborationEscalationHint}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 border-t border-[color:var(--border)] pt-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,430px)]">
        <div data-page-layer="midstage" className="space-y-4">
          <ReviewSnapshotBlock
            label={english ? "Prepared actions" : "待确认动作"}
            items={flow.activeReport.activeReportPreparationSummary}
            english={english}
          />

          <CollaborationRequestCard
            label={english ? "Support request" : "需要谁配合"}
            mode={flow.collaboration.collaborationMode}
            summary={flow.collaboration.collaborationSummary}
            request={flow.collaboration.collaborationRequest}
            decisionRequest={flow.collaboration.collaborationDecisionRequest}
            nextSteps={flow.collaboration.collaborationNextStep}
            english={english}
          />

          <div data-worker-assignment="true">
            <WorkerSummary
              label={english ? "Owners and support" : "负责人和配合"}
              items={[
                ...flow.activeReport.activeReportWorkerSummary,
                ...flow.collaboration.collaborationWorkerAssignment,
              ]}
            />
          </div>
        </div>

        <div data-page-layer="backstage">
          <WhyItMattersBlock
            label={english ? "Why this is in front now" : "为什么现在需要处理"}
            reasons={[
              flow.triggerCondition,
              flow.collaboration.collaborationReason,
              flow.collaboration.collaborationSummary,
            ].slice(0, 3)}
          />
        </div>
      </div>

      <div className="mt-5 border-t border-[color:var(--border)] pt-5">
        <div data-page-layer="evidence">
          <EvidenceDrawer
            marker="active"
            label={english ? "Sources and context" : "依据与来源"}
            leadingChip={labelForCollaborationMode(
              flow.collaboration.collaborationMode,
              english,
            )}
            summaryItems={[
              ...flow.activeReport.activeReportEvidenceSummary,
              ...prefixItems(
                english ? "Current prepared scope: " : "当前已准备范围：",
                flow.helmCanDo,
              ),
              ...prefixItems(
                english ? "Still suggestion-only: " : "当前仍只到建议层：",
                flow.helmSuggestsOnly,
              ),
              ...prefixItems(
                english ? "Human decision required: " : "仍需人工拍板：",
                flow.humanDecisionRequired,
              ),
              ...prefixItems(
                english ? "Human-led handling required: " : "仍需人工主导处理：",
                flow.humanLeadRequired,
              ),
            ]}
            links={flow.evidenceLinks}
            countLabel={
              english
                ? `${flow.activeReport.activeReportEvidenceSummary.length} evidence signals`
                : `${flow.activeReport.activeReportEvidenceSummary.length} 条证据信号`
            }
          />
        </div>
      </div>
    </article>
  );
}

function FlowBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "sky" | "amber" | "violet" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "sky"
      ? "border-[color:color-mix(in_oklab,#38bdf8_35%,var(--border)_65%)] bg-[color:color-mix(in_oklab,#38bdf8_12%,var(--background-elevated)_88%)] text-[color:color-mix(in_oklab,#0369a1_68%,var(--foreground)_32%)]"
      : tone === "amber"
        ? "border-[color:color-mix(in_oklab,#f59e0b_35%,var(--border)_65%)] bg-[color:color-mix(in_oklab,#f59e0b_12%,var(--background-elevated)_88%)] text-[color:color-mix(in_oklab,#b45309_68%,var(--foreground)_32%)]"
        : tone === "violet"
          ? "border-[color:color-mix(in_oklab,#8b5cf6_35%,var(--border)_65%)] bg-[color:color-mix(in_oklab,#8b5cf6_12%,var(--background-elevated)_88%)] text-[color:color-mix(in_oklab,#6d28d9_68%,var(--foreground)_32%)]"
          : tone === "emerald"
            ? "border-[color:color-mix(in_oklab,#10b981_35%,var(--border)_65%)] bg-[color:color-mix(in_oklab,#10b981_12%,var(--background-elevated)_88%)] text-[color:color-mix(in_oklab,#047857_68%,var(--foreground)_32%)]"
            : tone === "rose"
              ? "border-[color:color-mix(in_oklab,#f43f5e_35%,var(--border)_65%)] bg-[color:color-mix(in_oklab,#f43f5e_12%,var(--background-elevated)_88%)] text-[color:color-mix(in_oklab,#be123c_68%,var(--foreground)_32%)]"
              : "border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_92%,white_8%)] text-[color:var(--foreground)]";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

function toneForPriority(priority: ActiveReportPriority) {
  if (priority === "urgent") return "amber";
  if (priority === "watch") return "rose";
  return "sky";
}

function labelForReportType(type: ActiveReportType, english: boolean) {
  if (type === "periodic") return english ? "Periodic report" : "周期性汇报";
  if (type === "event") return english ? "Event report" : "事件性汇报";
  return english ? "Request report" : "请求式汇报";
}

function labelForPriority(priority: ActiveReportPriority, english: boolean) {
  if (priority === "urgent") return english ? "Urgent" : "需立即处理";
  if (priority === "watch") return english ? "Watch" : "持续观察";
  return english ? "Operating" : "经营常规";
}

function labelForDeliveryMode(
  mode: ActiveReportDeliveryMode,
  english: boolean,
) {
  if (mode === "event-alert") return english ? "Event alert" : "事件提醒";
  if (mode === "decision-request") {
    return english ? "Decision request" : "拍板请求";
  }
  return english ? "Home brief" : "首页简报";
}

function labelForAudience(audience: ActiveReportAudience, english: boolean) {
  if (audience === "founder") return english ? "Founder" : "创始人";
  if (audience === "sales") return english ? "Sales" : "销售";
  if (audience === "delivery") return english ? "Delivery" : "交付";
  if (audience === "customer-success") {
    return english ? "Customer success" : "客户成功";
  }
  return english ? "Operator" : "操作人";
}

function labelForCollaborationMode(mode: CollaborationMode, english: boolean) {
  if (mode === "helm_drives_human_supervises") {
    return english ? "System drives, human supervises" : "系统推进，人类监督";
  }
  if (mode === "helm_prepares_human_decides") {
    return english ? "System prepares, human decides" : "系统准备，人类拍板";
  }
  return english ? "System reminds, human leads" : "系统提醒，人类主导";
}

function prefixItems(prefix: string, items: string[]) {
  return items.map((item) => `${prefix}${item}`);
}
