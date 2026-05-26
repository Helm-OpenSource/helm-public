import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ChevronDown,
  FileSearch,
  Handshake,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { ControlledDisclosure } from "@/components/shared/controlled-disclosure";
import { Badge } from "@/components/ui/badge";
import type { CollaborationMode } from "@/lib/presentation/proactive-mechanism";
import type {
  PageDrilldownLink,
  PageEvidenceGroup,
  PageEvidenceTarget,
  PageNextAction,
  PageReviewState,
  PageWorkerAssignment,
} from "@/lib/presentation/reporting-protocol";
import {
  formatPageReviewState,
  getPageReviewStateLegend,
} from "@/lib/presentation/reporting-protocol";
import { cn } from "@/lib/utils";

type AgentDisplayChip = {
  label: string;
  tone: "sky" | "amber" | "violet" | "emerald";
};

export function NarrativeHeader({
  label,
  title,
  summary,
  prioritySignal,
  className,
}: {
  label: string;
  title: string;
  summary: string;
  prioritySignal?: string;
  className?: string;
}) {
  return (
    <section
      data-narrative-header="true"
      className={cn(
        "workspace-accent-card space-y-4 rounded-[28px] px-5 py-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="workspace-accent-card-label text-xs font-medium normal-case tracking-normal">
          {label}
        </p>
        {prioritySignal ? <EvidenceChip label={prioritySignal} tone="sky" /> : null}
      </div>
      <div className="space-y-3">
        <h2 className="workspace-accent-card-value max-w-4xl text-[1.9rem] font-semibold leading-[1.18] tracking-tight">
          {title}
        </h2>
        <p className="workspace-accent-card-detail max-w-4xl text-[1.02rem] leading-8">
          {summary}
        </p>
      </div>
    </section>
  );
}

export function WhyItMattersBlock({
  label,
  reasons,
  defaultExpanded = false,
  className,
}: {
  label: string;
  reasons: string[];
  defaultExpanded?: boolean;
  className?: string;
}) {
  return (
    <NarrativeDisclosure
      dataAttribute="data-why-it-matters-block"
      label={label}
      preview={reasons[0] ?? label}
      itemCount={reasons.length}
      defaultExpanded={defaultExpanded}
      className={className}
    >
      <div className="grid gap-3 lg:grid-cols-3">
        {reasons.map((reason) => (
          <NarrativeNoteCard key={reason}>
            <p className="text-sm leading-7 text-[color:var(--foreground)]">{reason}</p>
          </NarrativeNoteCard>
        ))}
      </div>
    </NarrativeDisclosure>
  );
}

export function HelmDidBlock({
  label,
  items,
  defaultExpanded = false,
  className,
}: {
  label: string;
  items: string[];
  defaultExpanded?: boolean;
  className?: string;
}) {
  return (
    <NarrativeDisclosure
      dataAttribute="data-helm-did-block"
      label={label}
      preview={items[0] ?? label}
      itemCount={items.length}
      defaultExpanded={defaultExpanded}
      className={className}
    >
      <NarrativeListCard
        icon={<Sparkles className="h-4 w-4" />}
        items={items}
        tone="sky"
      />
    </NarrativeDisclosure>
  );
}

export function ReviewSnapshotBlock({
  label,
  items,
  english,
  reviewState = "prepared",
  defaultExpanded = false,
  className,
}: {
  label: string;
  items: string[];
  english: boolean;
  reviewState?: PageReviewState;
  defaultExpanded?: boolean;
  className?: string;
}) {
  const stateLegend = getPageReviewStateLegend(english);

  return (
    <NarrativeDisclosure
      dataAttribute="data-review-snapshot-block"
      label={label}
      preview={items[0] ?? label}
      itemCount={items.length}
      defaultExpanded={defaultExpanded}
      className={className}
      summaryBadge={formatPageReviewState(reviewState, english)}
    >
      <div className="space-y-3">
        <NarrativeListCard
          icon={<Sparkles className="h-4 w-4" />}
          items={items}
          tone="sky"
        />
        <div className="workspace-panel-muted rounded-[22px] px-4 py-4">
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "State legend" : "状态说明"}
          </p>
          <div className="mt-3 space-y-2">
            {stateLegend.map((item) => (
              <div
                key={item.state}
                className={cn(
                  "rounded-[18px] border px-3 py-3",
                  item.state === reviewState
                    ? "border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border)_72%)] bg-[color:color-mix(in_oklab,var(--accent-soft)_64%,white_36%)]"
                    : "border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_92%,white_8%)]",
                )}
              >
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {item.label}
                </p>
                <p className="mt-1 text-sm leading-7 text-[color:var(--muted)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </NarrativeDisclosure>
  );
}

export function DecisionRequestCard({
  label,
  items,
  className,
}: {
  label: string;
  items: string[];
  className?: string;
}) {
  return (
    <section
      data-decision-request-card="true"
      className={cn("space-y-3", className)}
    >
      <SectionEyebrow label={label} />
      <NarrativeListCard
        icon={<BellRing className="h-4 w-4" />}
        items={items}
        tone="amber"
      />
    </section>
  );
}

export function DecisionSummaryCard({
  label,
  items,
  className,
}: {
  label: string;
  items: string[];
  className?: string;
}) {
  return (
    <section
      data-decision-summary-card="true"
      className={cn("space-y-3", className)}
    >
      <SectionEyebrow label={label} />
      <div className="workspace-panel-muted rounded-[26px] px-4 py-4">
        <div className="space-y-2">
          {items.map((item) => (
            <p key={item} className="text-sm leading-7 text-[color:var(--foreground)]">
              {item}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AgentStatusChips({
  chips,
  stageBadge,
  className,
}: {
  chips: AgentDisplayChip[];
  stageBadge?: string;
  className?: string;
}) {
  return (
    <div
      data-agent-status-chips="true"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {chips.map((chip, index) => (
        <EvidenceChip
          key={`${chip.label}-${chip.tone}-${index}`}
          label={chip.label}
          tone={chip.tone}
        />
      ))}
      {stageBadge ? <Badge variant="neutral">{stageBadge}</Badge> : null}
    </div>
  );
}

export function AgentOptionalSummarySection({
  label,
  items,
  className,
}: {
  label?: string;
  items?: string[];
  className?: string;
}) {
  if (!label || !items?.length) {
    return null;
  }

  return <DecisionSummaryCard label={label} items={items} className={className} />;
}

export function AgentResurfaceSection({
  english,
  recentChangesLabel,
  recentChangesItems,
  resurfaceReasonLabel,
  resurfaceReasonItems,
  className,
}: {
  english: boolean;
  recentChangesLabel?: string;
  recentChangesItems?: string[];
  resurfaceReasonLabel?: string;
  resurfaceReasonItems?: string[];
  className?: string;
}) {
  if (!recentChangesItems?.length && !resurfaceReasonItems?.length) {
    return null;
  }

  return (
    <div data-agent-resurface-section="true" className={cn("space-y-5", className)}>
      <AgentOptionalSummarySection
        label={recentChangesLabel ?? (english ? "Recent changes" : "最近变化")}
        items={recentChangesItems}
      />
      <AgentOptionalSummarySection
        label={
          resurfaceReasonLabel ??
          (english ? "Why this is back now" : "为什么这条线又回到这里")
        }
        items={resurfaceReasonItems}
      />
    </div>
  );
}

export function AgentProgressTraceSection({
  english,
  label,
  items,
  className,
}: {
  english: boolean;
  label?: string;
  items?: string[];
  className?: string;
}) {
  return (
    <AgentOptionalSummarySection
      label={label ?? (english ? "Progress trace" : "进度轨迹")}
      items={items}
      className={className}
    />
  );
}

export function CollaborationRequestCard({
  label,
  mode,
  summary,
  request,
  decisionRequest,
  nextSteps,
  className,
}: {
  label: string;
  mode: CollaborationMode;
  summary: string;
  request: string;
  decisionRequest?: string;
  nextSteps: string[];
  className?: string;
}) {
  return (
    <section
      data-collaboration-request-card="true"
      data-collaboration-request="true"
      className={cn("space-y-3", className)}
    >
      <SectionEyebrow label={label} />
      <div className="rounded-[26px] border border-[color:color-mix(in_oklab,#8b5cf6_32%,var(--border)_68%)] bg-[color:color-mix(in_oklab,#8b5cf6_10%,var(--background-elevated)_90%)] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="workspace-note-icon-shell p-2 text-[color:var(--foreground)]">
              <Handshake className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{summary}</p>
              <p className="text-xs font-medium text-[color:color-mix(in_oklab,#6d28d9_62%,var(--muted-foreground)_38%)]">
                {labelForCollaborationMode(mode)}
              </p>
            </div>
          </div>
          <EvidenceChip label={labelForCollaborationMode(mode)} tone="violet" />
        </div>
        <div className="mt-4 space-y-3">
          <NarrativeInlineItem>{request}</NarrativeInlineItem>
          {decisionRequest ? (
            <NarrativeInlineItem>{decisionRequest}</NarrativeInlineItem>
          ) : null}
          {nextSteps.length ? (
            <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_90%,white_10%)] px-3 py-3">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">下一步</p>
              <div className="mt-2 space-y-2">
                {nextSteps.map((step) => (
                  <p key={step} className="text-sm leading-7 text-[color:var(--foreground)]">
                    {step}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ActionRail({
  label,
  actions,
  className,
}: {
  label: string;
  actions: PageNextAction[];
  className?: string;
}) {
  return (
    <section
      data-action-rail="true"
      data-page-next-action="true"
      className={cn("space-y-3", className)}
    >
      <SectionEyebrow label={label} />
      <div className="flex flex-wrap gap-2">
        {actions.map((action, index) => (
          <Link
            key={`${action.href}-${action.label}-${index}`}
            href={action.href}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-medium transition",
              action.variant === "secondary"
                ? "border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_92%,white_8%)] text-[color:var(--foreground)] hover:bg-[color:color-mix(in_oklab,var(--background-elevated)_84%,white_16%)]"
                : action.variant === "ghost"
                  ? "border border-transparent bg-transparent text-[color:var(--muted)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--foreground)]"
                  : "theme-primary-action",
            )}
          >
            {action.label}
            {action.variant === undefined || action.variant === "default" ? (
              <ArrowRight className="h-4 w-4" />
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function BoundaryNote({
  label,
  items,
  escalationHint,
  className,
}: {
  label: string;
  items: string[];
  escalationHint?: string;
  className?: string;
}) {
  return (
    <section data-boundary-note="true" className={cn("space-y-3", className)}>
      <SectionEyebrow label={label} />
      <div className="rounded-[26px] border border-[color:color-mix(in_oklab,#10b981_32%,var(--border)_68%)] bg-[color:color-mix(in_oklab,#10b981_10%,var(--background-elevated)_90%)] px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="workspace-note-icon-shell p-2 text-[color:var(--foreground)]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-2">
            {items.map((item) => (
              <p key={item} className="text-sm leading-7 text-[color:var(--foreground)]">
                {item}
              </p>
            ))}
            {escalationHint ? (
              <div
                data-escalation-note="true"
                className="rounded-[18px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_90%,white_10%)] px-3 py-3"
              >
                <p className="text-sm leading-7 text-[color:var(--foreground)]">
                  {escalationHint}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function WorkerSummary({
  label,
  items,
  assignments,
  className,
}: {
  label: string;
  items: string[];
  assignments?: PageWorkerAssignment[];
  className?: string;
}) {
  return (
    <section
      data-worker-summary="true"
      data-worker-assignment="true"
      className={cn("space-y-3", className)}
    >
      <SectionEyebrow label={label} />
      <div className="rounded-[26px] border border-[color:color-mix(in_oklab,#8b5cf6_32%,var(--border)_68%)] bg-[color:color-mix(in_oklab,#8b5cf6_10%,var(--background-elevated)_90%)] px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="workspace-note-icon-shell p-2 text-[color:var(--foreground)]">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-2">
            {items.map((item) => (
              <p key={item} className="text-sm leading-7 text-[color:var(--foreground)]">
                {item}
              </p>
            ))}
            {assignments?.length ? (
              <div className="grid gap-3 pt-2">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.assignmentId}
                    data-worker-assignment-detail={assignment.assignmentId}
                    className="rounded-[20px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_90%,white_10%)] px-3 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {assignment.title}
                        </p>
                        <p className="text-sm leading-7 text-[color:var(--foreground)]">
                          {assignment.summary}
                        </p>
                      </div>
                      {assignment.chips?.length ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {assignment.chips.map((chip) => (
                            <EvidenceChip
                              key={`${assignment.assignmentId}-${chip}`}
                              label={chip}
                              tone="violet"
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      {assignment.items.map((item) => (
                        <p
                          key={`${assignment.assignmentId}-${item}`}
                          className="text-sm leading-7 text-[color:var(--foreground)]"
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function EvidenceSummaryCard({
  label,
  items,
  className,
}: {
  label: string;
  items: string[];
  className?: string;
}) {
  return (
    <section
      data-evidence-summary-card="true"
      className={cn("space-y-3", className)}
    >
      <SectionEyebrow label={label} />
      <div className="workspace-panel-muted rounded-[26px] px-4 py-4">
        <div className="space-y-2">
          {items.map((item) => (
            <p key={item} className="text-sm leading-7 text-[color:var(--foreground)]">
              {item}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EvidenceChip({
  label,
  tone = "sky",
  className,
}: {
  label: string;
  tone?: "sky" | "amber" | "violet" | "emerald";
  className?: string;
}) {
  const toneClass =
    tone === "amber"
      ? "border-[color:color-mix(in_oklab,#f59e0b_35%,var(--border)_65%)] bg-[color:color-mix(in_oklab,#f59e0b_12%,var(--background-elevated)_88%)] text-[color:color-mix(in_oklab,#b45309_68%,var(--foreground)_32%)]"
      : tone === "violet"
        ? "border-[color:color-mix(in_oklab,#8b5cf6_35%,var(--border)_65%)] bg-[color:color-mix(in_oklab,#8b5cf6_12%,var(--background-elevated)_88%)] text-[color:color-mix(in_oklab,#6d28d9_68%,var(--foreground)_32%)]"
        : tone === "emerald"
          ? "border-[color:color-mix(in_oklab,#10b981_35%,var(--border)_65%)] bg-[color:color-mix(in_oklab,#10b981_12%,var(--background-elevated)_88%)] text-[color:color-mix(in_oklab,#047857_68%,var(--foreground)_32%)]"
          : "border-[color:color-mix(in_oklab,#38bdf8_35%,var(--border)_65%)] bg-[color:color-mix(in_oklab,#38bdf8_12%,var(--background-elevated)_88%)] text-[color:color-mix(in_oklab,#0369a1_68%,var(--foreground)_32%)]";

  return (
    <span
      data-evidence-chip="true"
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-medium break-words",
        toneClass,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function EvidenceDrawer({
  label,
  summaryItems,
  hideSummaryItems,
  links,
  groups,
  leadingChip,
  countLabel,
  children,
  className,
  marker,
}: {
  label: string;
  summaryItems: string[];
  hideSummaryItems?: boolean;
  links?: PageDrilldownLink[];
  groups?: PageEvidenceGroup[];
  leadingChip?: string;
  countLabel?: string;
  children?: ReactNode;
  className?: string;
  marker?: "page" | "active";
}) {
  return (
    <details
      data-evidence-drawer="true"
      data-page-evidence={marker === "page" ? "true" : undefined}
      data-active-evidence={marker === "active" ? "true" : undefined}
      className={cn(
        "workspace-panel-muted w-full min-w-0 max-w-full overflow-hidden rounded-[24px]",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
          <div className="workspace-note-icon-shell p-2 text-[color:var(--muted)]">
            <FileSearch className="h-4 w-4" />
          </div>
          <span className="min-w-0 break-words">{label}</span>
          {leadingChip ? <EvidenceChip label={leadingChip} /> : null}
        </div>
        <div className="inline-flex min-w-0 items-center gap-3 text-xs text-[color:var(--muted-foreground)]">
          <span>{countLabel ?? `${summaryItems.length} 条信号`}</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      </summary>
      <div className="min-w-0 space-y-3 border-t border-[color:var(--border)] px-4 py-4">
        {hideSummaryItems
          ? null
          : summaryItems.map((item) => (
              <NarrativeNoteCard key={item}>
                <p className="text-sm leading-7 text-[color:var(--foreground)]">{item}</p>
              </NarrativeNoteCard>
            ))}
        {groups?.length ? (
          <div className="grid gap-3">
            {groups.map((group) => (
              <div
                key={group.groupId}
                data-evidence-group={group.groupId}
                className="min-w-0 max-w-full overflow-hidden rounded-[20px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_90%,white_10%)] px-4 py-4"
              >
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {group.label}
                </p>
                <div className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    typeof item === "string" ? (
                      <p
                        key={`${group.groupId}-${item}`}
                        className="text-sm leading-7 text-[color:var(--foreground)]"
                      >
                        {item}
                      </p>
                    ) : (
                      <EvidenceTargetCard
                        key={item.itemId}
                        groupId={group.groupId}
                        item={item}
                      />
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {links?.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {links.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_92%,white_8%)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition hover:bg-[color:color-mix(in_oklab,var(--background-elevated)_84%,white_16%)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
        {children ? <div className="space-y-3 pt-1">{children}</div> : null}
      </div>
    </details>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
      {label}
    </p>
  );
}

function NarrativeDisclosure({
  dataAttribute,
  label,
  preview,
  itemCount,
  summaryBadge,
  defaultExpanded = false,
  className,
  children,
}: {
  dataAttribute:
    | "data-why-it-matters-block"
    | "data-helm-did-block"
    | "data-review-snapshot-block";
  label: string;
  preview: string;
  itemCount: number;
  summaryBadge?: string;
  defaultExpanded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const additionalCount = Math.max(itemCount - 1, 0);

  return (
    <section
      {...{ [dataAttribute]: "true" }}
      data-narrative-disclosure="true"
      className={cn("space-y-3", className)}
    >
      <ControlledDisclosure
        className="workspace-panel-muted rounded-[26px]"
        data-default-expanded={defaultExpanded ? "true" : "false"}
        defaultExpanded={defaultExpanded}
        summaryLabel={label}
        summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4"
        bodyClassName="border-t border-[color:var(--border)] px-4 py-4"
        summary={
          <>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SectionEyebrow label={label} />
                {summaryBadge ? (
                  <EvidenceChip
                    label={summaryBadge}
                    tone="violet"
                    className="py-0.5"
                  />
                ) : null}
              </div>
              <p className="text-sm leading-7 text-[color:var(--foreground)]">
                {preview}
              </p>
            </div>
            <div className="inline-flex shrink-0 items-center gap-3 text-xs text-[color:var(--muted-foreground)]">
              {additionalCount > 0 ? <span>+{additionalCount}</span> : null}
              <ChevronDown className="h-4 w-4" />
            </div>
          </>
        }
      >
        {children}
      </ControlledDisclosure>
    </section>
  );
}

function NarrativeListCard({
  icon,
  items,
  tone,
}: {
  icon: ReactNode;
  items: string[];
  tone: "sky" | "amber";
}) {
  const toneClass =
    tone === "amber"
      ? "border-[color:color-mix(in_oklab,#f59e0b_32%,var(--border)_68%)] bg-[color:color-mix(in_oklab,#f59e0b_10%,var(--background-elevated)_90%)]"
      : "border-[color:color-mix(in_oklab,#38bdf8_32%,var(--border)_68%)] bg-[color:color-mix(in_oklab,#38bdf8_10%,var(--background-elevated)_90%)]";

  return (
    <div className={cn("rounded-[26px] border px-4 py-4", toneClass)}>
      <div className="flex items-start gap-3">
        <div className="workspace-note-icon-shell p-2 text-[color:var(--foreground)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {items.map((item) => (
            <NarrativeInlineItem key={item}>{item}</NarrativeInlineItem>
          ))}
        </div>
      </div>
    </div>
  );
}

function NarrativeInlineItem({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_90%,white_10%)] px-3 py-3">
      <p className="text-sm leading-7 text-[color:var(--foreground)]">{children}</p>
    </div>
  );
}

function NarrativeNoteCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_92%,white_8%)] px-4 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function EvidenceTargetCard({
  groupId,
  item,
}: {
  groupId: string;
  item: PageEvidenceTarget;
}) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      data-evidence-target={item.itemId}
      data-evidence-target-group={groupId}
      className="block min-w-0 max-w-full overflow-hidden rounded-[18px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_92%,white_8%)] px-3 py-3 transition hover:bg-[color:color-mix(in_oklab,var(--background-elevated)_84%,white_16%)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="break-words text-sm font-semibold leading-7 text-[color:var(--foreground)]">
            {item.label}
          </p>
          {item.summary ? (
            <p className="break-words text-sm leading-7 text-[color:var(--muted)]">{item.summary}</p>
          ) : null}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]" />
      </div>
    </Link>
  );
}

function labelForCollaborationMode(mode: CollaborationMode) {
  if (mode === "helm_drives_human_supervises") return "Helm 推进，人类监督";
  if (mode === "helm_prepares_human_decides") return "Helm 准备，人类拍板";
  return "Helm 提醒，人类主导";
}
