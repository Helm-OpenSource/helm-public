import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  CornerDownRight,
  Flag,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DetailOperatingFoundationCard } from "@/components/shared/operating-foundation-summary";
import { buildDetailOperatingFoundationSummary } from "@/lib/operating-system";
import type {
  CrossDetailHandoff,
  UnifiedDetailNavigationLink,
  UnifiedDetailNavigationModel,
} from "@/lib/presentation/unified-detail-navigation";
import { cn } from "@/lib/utils";
import { EvidenceChip } from "@/components/shared/narrative-components";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";

export function UnifiedDetailNavigationPanel({
  navigation,
  english,
  className,
}: {
  navigation: UnifiedDetailNavigationModel;
  english: boolean;
  className?: string;
}) {
  const { currentNode, handoffs } = navigation;
  const text = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);
  const operatingFoundationSummary = buildDetailOperatingFoundationSummary({
    english,
    navigation,
  });
  const displayOperatingFoundationSummary = {
    ...operatingFoundationSummary,
    label: text(operatingFoundationSummary.label),
    title: text(operatingFoundationSummary.title),
    summary: text(operatingFoundationSummary.summary),
    items: operatingFoundationSummary.items.map((item) => ({
      ...item,
      label: text(item.label),
      value: text(item.value),
    })),
    connections: operatingFoundationSummary.connections.map((connection) => ({
      ...connection,
      label: text(connection.label),
      value: text(connection.value),
      description: text(connection.description),
    })),
    note: text(operatingFoundationSummary.note),
  };

  return (
    <section
      data-unified-detail-navigation="true"
      className={cn(
        "theme-detail-shell overflow-hidden rounded-[28px]",
        className,
      )}
    >
      <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] xl:px-6 xl:py-6">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <EvidenceChip
              label={english ? "Detail chain" : "详情经营链"}
              tone="sky"
            />
            <EvidenceChip
              label={labelForPriority(currentNode.detailNodePriority, english)}
              tone={toneForPriority(currentNode.detailNodePriority)}
            />
          </div>

          <div
            data-detail-node-current={currentNode.detailNodeType}
            className="theme-detail-shell-card space-y-4 rounded-[24px] px-4 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-[color:var(--status-info-text)]/78">
                  {english ? "Current node" : "当前节点"}
                </p>
                <h3 className="text-xl font-semibold tracking-tight text-white">
                  {labelForNodeType(currentNode.detailNodeType, english)}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <EvidenceChip label={text(currentNode.detailNodeStage)} tone="violet" />
                <EvidenceChip
                  label={text(currentNode.detailNodeAudienceMode)}
                  tone="sky"
                />
                {currentNode.detailNodeSendabilityMode ? (
                  <EvidenceChip
                    label={text(currentNode.detailNodeSendabilityMode)}
                    tone="emerald"
                  />
                ) : null}
                {currentNode.detailNodeStrengthMode ? (
                  <EvidenceChip
                    label={text(currentNode.detailNodeStrengthMode)}
                    tone="amber"
                  />
                ) : null}
              </div>
            </div>

            <p className="text-sm leading-7 text-[color:var(--dark-inset-muted)]">
              {text(currentNode.detailNodeCurrentReason)}
            </p>

            <div className="rounded-[18px] border border-[color:var(--status-success-border)]/18 bg-[color:var(--accent-success)]/[0.08] px-3 py-3">
              <div className="flex items-start gap-3">
                <div className="workspace-note-icon-shell p-2 text-[color:var(--foreground)]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[color:var(--status-success-text)]/80">
                    {english ? "Current boundary" : "当前边界"}
                  </p>
                  <p className="text-sm leading-7 text-[color:var(--dark-inset-foreground)]">
                    {text(currentNode.detailNodeBoundary)}
                  </p>
                </div>
              </div>
            </div>

            <div className="theme-detail-shell-tile rounded-[18px] px-3 py-3">
              <div className="flex items-start gap-3">
                <div className="workspace-note-icon-shell p-2 text-[color:var(--foreground)]">
                  <Route className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Navigation hint" : "导航提示"}
                  </p>
                  <p className="text-sm leading-7 text-[color:var(--dark-inset-muted)]">
                    {text(currentNode.detailNodeNavigationHint)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <DetailOperatingFoundationCard
            label={displayOperatingFoundationSummary.label}
            title={displayOperatingFoundationSummary.title}
            summary={displayOperatingFoundationSummary.summary}
            items={displayOperatingFoundationSummary.items}
            connections={displayOperatingFoundationSummary.connections}
            note={displayOperatingFoundationSummary.note}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <NavigationLinkCard
              label={english ? "Previous detail" : "上一段详情"}
              link={currentNode.detailNodePrev}
              emptyLabel={english ? "This is the first detail." : "这是当前链路的起点。"}
              dataMarker="prev"
              english={english}
            />
            <NavigationLinkCard
              label={english ? "Next detail" : "下一段详情"}
              link={currentNode.detailNodeNext}
              emptyLabel={
                english ? "Use the next action rail." : "请用下面的下一步动作继续推进。"
              }
              dataMarker="next"
              english={english}
            />
          </div>

          <details
            data-cross-detail-handoff="true"
            className="theme-detail-shell-card rounded-[24px]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="workspace-note-icon-shell p-2 text-[color:var(--foreground)]">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Cross-detail handoff" : "跨详情交接"}
                  </p>
                  <p className="text-sm leading-7 text-[color:var(--dark-inset-muted)]">
                    {english
                      ? "Open when you need the full handoff chain."
                      : "需要完整交接链时再展开。"}
                  </p>
                </div>
              </div>
              <div className="inline-flex shrink-0 items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                <span>{english ? `${handoffs.length} handoffs` : `${handoffs.length} 条`}</span>
                <ChevronDown className="h-4 w-4" />
              </div>
            </summary>

            <div className="grid gap-3 border-t border-[color:var(--border)] px-4 py-4">
              {handoffs.map((handoff) => (
                <HandoffCard
                  key={`${handoff.handoffSource}-${handoff.handoffTarget}-${handoff.handoffHref}`}
                  handoff={handoff}
                  english={english}
                />
              ))}
            </div>
          </details>
        </section>
      </div>
    </section>
  );
}

function NavigationLinkCard({
  label,
  link,
  emptyLabel,
  dataMarker,
  english,
}: {
  label: string;
  link: UnifiedDetailNavigationLink | null;
  emptyLabel: string;
  dataMarker: "prev" | "next";
  english: boolean;
}) {
  return (
    <div
      data-detail-node-link={dataMarker}
      data-detail-node-prev={dataMarker === "prev" && link ? link.type : undefined}
      data-detail-node-next={dataMarker === "next" && link ? link.type : undefined}
      className="theme-detail-shell-card rounded-[22px] px-4 py-4"
    >
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      {link ? (
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <p className="text-base font-semibold text-white">
              {formatRoleDetailDisplayText(link.label, english)}
            </p>
            <p className="text-sm leading-7 text-[color:var(--dark-inset-muted)]">
              {formatRoleDetailDisplayText(link.summary, english)}
            </p>
          </div>
          <Link
            href={link.href}
            className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--status-info-text)] transition hover:text-white"
          >
            {labelForOpenDetail(link.type, english)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-7 text-[color:var(--muted-foreground)]">{emptyLabel}</p>
      )}
    </div>
  );
}

function HandoffCard({
  handoff,
  english,
}: {
  handoff: CrossDetailHandoff;
  english: boolean;
}) {
  return (
    <div
      data-handoff-source={handoff.handoffSource}
      data-handoff-target={handoff.handoffTarget}
      data-handoff-boundary="true"
      data-handoff-next-action="true"
      className="theme-detail-shell-tile rounded-[20px] px-4 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="workspace-note-icon-shell p-2 text-[color:var(--foreground)]">
            <CornerDownRight className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              {labelForNodeType(handoff.handoffSource, english)}{" "}
              <span className="text-[color:var(--muted-foreground)]">→</span>{" "}
              {labelForNodeType(handoff.handoffTarget, english)}
            </p>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {labelForVisibilityMode(handoff.handoffVisibilityMode, english)}
            </p>
          </div>
        </div>
        <Link
          href={handoff.handoffHref}
          className="theme-detail-shell-link inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition"
        >
          {labelForOpenDetail(handoff.handoffTarget, english)}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <HandoffCell
          label={english ? "Handoff reason" : "交接原因"}
          value={formatRoleDetailDisplayText(handoff.handoffReason, english)}
        />
        <HandoffCell
          label={english ? "Boundary" : "当前边界"}
          value={formatRoleDetailDisplayText(handoff.handoffBoundary, english)}
        />
        <HandoffCell
          label={english ? "Decision request" : "当前拍板请求"}
          value={formatRoleDetailDisplayText(handoff.handoffDecisionRequest, english)}
        />
        <HandoffCell
          label={english ? "Next action" : "下一步动作"}
          value={formatRoleDetailDisplayText(handoff.handoffNextAction, english)}
        />
        {handoff.handoffPrerequisite ? (
          <HandoffCell
            label={english ? "Prerequisite" : "前置条件"}
            value={formatRoleDetailDisplayText(handoff.handoffPrerequisite, english)}
          />
        ) : null}
        {handoff.handoffDependency ? (
          <HandoffCell
            label={english ? "Dependency" : "依赖条件"}
            value={formatRoleDetailDisplayText(handoff.handoffDependency, english)}
          />
        ) : null}
        <HandoffCell
          label={english ? "Risk note" : "风险说明"}
          value={formatRoleDetailDisplayText(handoff.handoffRisk, english)}
        />
        <div className="theme-detail-shell-tile rounded-[16px] px-3 py-3">
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "Worker and evidence" : "协作与依据"}
          </p>
          <div className="mt-2 space-y-2">
            {handoff.handoffWorkerSummary.slice(0, 2).map((item) => (
              <div key={item} className="flex items-start gap-2">
                <Flag className="mt-1 h-3.5 w-3.5 text-[color:var(--accent)]" />
                <p className="text-sm leading-7 text-[color:var(--dark-inset-muted)]">
                  {formatRoleDetailDisplayText(item, english)}
                </p>
              </div>
            ))}
            {handoff.handoffEvidenceSummary.slice(0, 2).map((item) => (
              <div key={item} className="flex items-start gap-2">
                <Sparkles className="mt-1 h-3.5 w-3.5 text-[color:var(--status-info-text)]" />
                <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {formatRoleDetailDisplayText(item, english)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HandoffCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-detail-shell-tile rounded-[16px] px-3 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--dark-inset-foreground)]">{value}</p>
    </div>
  );
}

function toneForPriority(priority: UnifiedDetailNavigationModel["currentNode"]["detailNodePriority"]) {
  if (priority === "urgent") return "amber";
  if (priority === "important") return "violet";
  return "sky";
}

function labelForPriority(priority: UnifiedDetailNavigationModel["currentNode"]["detailNodePriority"], english: boolean) {
  if (priority === "urgent") return english ? "Urgent handoff" : "紧急交接";
  if (priority === "important") return english ? "Important transition" : "重要切换";
  return english ? "Watch the chain" : "继续观察";
}

function labelForNodeType(type: CrossDetailHandoff["handoffSource"], english: boolean) {
  switch (type) {
    case "proposal":
      return english ? "Proposal" : "方案";
    case "package":
      return english ? "Package" : "方案包";
    case "package-stage-variants":
      return english ? "Package stage" : "方案阶段";
    case "company-detail":
      return english ? "Company detail" : "公司详情";
    case "contact-detail":
      return english ? "Contact detail" : "联系人详情";
    case "meeting-detail":
      return english ? "Meeting detail" : "会议详情";
    case "customer-success":
      return english ? "Customer success handoff" : "客户成功接手";
    case "success-check":
      return english ? "Success check" : "成功复盘";
    case "expansion-review":
      return english ? "Expansion review" : "扩展复盘";
    case "inbox-detail":
      return english ? "Inbox detail" : "收件详情";
    case "follow-up-detail":
      return english ? "Follow-up detail" : "跟进详情";
    case "review-request-detail":
      return english ? "Review request detail" : "复核请求详情";
    case "conversation":
      return english ? "Conversation" : "对话详情";
    case "founder-conversation":
      return english ? "Founder conversation" : "创始人对话";
    case "founder-qa":
      return english ? "Founder Q&A" : "创始人问答";
    case "sales-conversation":
      return english ? "Sales conversation" : "销售对话";
    case "sales-objection":
      return english ? "Sales objection" : "销售异议";
    case "sales-follow-up":
      return english ? "Sales follow-up" : "销售跟进";
    case "delivery-conversation":
      return english ? "Delivery conversation" : "交付对话";
    case "delivery-walkthrough":
      return english ? "Delivery walkthrough" : "交付演示";
    case "delivery-review":
      return english ? "Delivery review" : "交付复核";
    case "customer-facing-offer":
      return english ? "Customer offer" : "客户报价";
    case "external-proposal":
      return english ? "External proposal" : "对外方案";
    case "external-narrative":
      return english ? "External narrative" : "对外说明";
    case "narrative-fallback":
      return english ? "Narrative fallback" : "说明回退";
    case "reinforcement":
      return english ? "Reinforcement" : "强化判断";
    case "sendability":
      return english ? "Sendability" : "发送边界";
    case "package-variants":
      return english ? "Package variants" : "方案变体";
    case "reinforcement-variants":
      return english ? "Reinforcement variants" : "强化变体";
    case "commercial-strengthening":
      return english
        ? "Commercial strengthening"
        : "商业强化";
    default:
      return english ? "Variants" : "变体";
  }
}

function labelForOpenDetail(
  type: CrossDetailHandoff["handoffSource"],
  english: boolean,
) {
  return english ? "Open detail" : `打开${labelForNodeType(type, false)}`;
}

function labelForVisibilityMode(
  mode: CrossDetailHandoff["handoffVisibilityMode"],
  english: boolean,
) {
  switch (mode) {
    case "customer-facing":
      return english ? "Customer-facing handoff" : "可对外交接";
    case "customer-facing-with-boundary":
      return english ? "Customer-facing with boundary" : "带边界的对外交接";
    case "review-before-send":
      return english ? "Review before send" : "发送前复核";
    case "boundary-only":
      return english ? "Boundary only" : "仅边界";
    default:
      return english ? "Internal only" : "仅内部";
  }
}
