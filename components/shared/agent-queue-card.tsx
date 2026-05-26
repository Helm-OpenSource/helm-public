import type { ReactNode } from "react";
import {
  AgentStatusChips,
} from "@/components/shared/narrative-components";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AgentQueueCardChip = {
  label: string;
  tone: "sky" | "amber" | "violet" | "emerald";
};

type AgentQueueCardItem = {
  label: string;
  value: string;
};

export function AgentQueueCardHeader({
  title,
  subtitle,
  stageBadge,
  chips,
  className,
}: {
  title: string;
  subtitle?: string;
  stageBadge?: string;
  chips: AgentQueueCardChip[];
  className?: string;
}) {
  return (
    <CardHeader className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle ? <p className="text-sm text-[color:var(--muted-foreground)]">{subtitle}</p> : null}
        </div>
        <AgentQueueCardStatusChips stageBadge={stageBadge} chips={chips} />
      </div>
    </CardHeader>
  );
}

export function AgentQueueCardStatusChips({
  stageBadge,
  chips,
  className,
}: {
  stageBadge?: string;
  chips: AgentQueueCardChip[];
  className?: string;
}) {
  return (
    <div data-agent-queue-card-status-chips="true">
      <AgentStatusChips
        chips={chips}
        stageBadge={stageBadge}
        className={className}
      />
    </div>
  );
}

export function AgentQueueCardCopyBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p>{value}</p>
    </div>
  );
}

export function AgentQueueCardResurfaceSummary({
  sinceLastSeenLabel,
  sinceLastSeenValue,
  resurfacedBecauseLabel,
  resurfacedBecauseValue,
  stillWaitingLabel,
  stillWaitingValue,
  stillBlockedLabel,
  stillBlockedValue,
  className,
}: {
  sinceLastSeenLabel: string;
  sinceLastSeenValue: string;
  resurfacedBecauseLabel: string;
  resurfacedBecauseValue: string;
  stillWaitingLabel?: string;
  stillWaitingValue?: string | null;
  stillBlockedLabel?: string;
  stillBlockedValue?: string | null;
  className?: string;
}) {
  return (
    <div
      data-agent-queue-card-resurface-summary="true"
      className={cn("space-y-3", className)}
    >
      <AgentQueueCardCopyBlock
        label={sinceLastSeenLabel}
        value={sinceLastSeenValue}
      />
      <AgentQueueCardCopyBlock
        label={resurfacedBecauseLabel}
        value={resurfacedBecauseValue}
      />
      {stillWaitingLabel && stillWaitingValue ? (
        <AgentQueueCardCopyBlock
          label={stillWaitingLabel}
          value={stillWaitingValue}
        />
      ) : null}
      {stillBlockedLabel && stillBlockedValue ? (
        <AgentQueueCardCopyBlock
          label={stillBlockedLabel}
          value={stillBlockedValue}
        />
      ) : null}
    </div>
  );
}

export function AgentQueueCardProgressSummary({
  items,
  className,
}: {
  items: AgentQueueCardItem[];
  className?: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div
      data-agent-queue-card-progress-summary="true"
      className={cn("space-y-3", className)}
    >
      {items.map((item) => (
        <AgentQueueCardCopyBlock
          key={`${item.label}-${item.value}`}
          label={item.label}
          value={item.value}
        />
      ))}
    </div>
  );
}

export function AgentQueueCardMetaGrid({
  items,
  className,
}: {
  items: AgentQueueCardItem[];
  className?: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div
      data-agent-queue-card-meta-grid="true"
      className={cn("grid gap-3 md:grid-cols-4", className)}
    >
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="theme-detail-shell-tile rounded-[18px] px-3 py-3"
        >
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {item.label}
          </p>
          <p className="mt-2 text-sm leading-7 text-[color:var(--dark-inset-foreground)]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function AgentQueueCardView({
  wrapperDataAttributes,
  title,
  subtitle,
  stageBadge,
  chips,
  sections,
  metaItems,
  footer,
  className,
}: {
  wrapperDataAttributes?: Record<string, string | undefined>;
  title: string;
  subtitle?: string;
  stageBadge?: string;
  chips: AgentQueueCardChip[];
  sections: ReactNode;
  metaItems?: AgentQueueCardItem[];
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      {...wrapperDataAttributes}
      data-agent-queue-card-view="true"
      className={cn("theme-detail-shell-card", className)}
    >
      <AgentQueueCardHeader
        title={title}
        subtitle={subtitle}
        stageBadge={stageBadge}
        chips={chips}
      />
      <CardContent className="space-y-3 text-sm leading-7 text-[color:var(--dark-inset-muted)]">
        {sections}
        <AgentQueueCardMetaGrid items={metaItems ?? []} />
        {footer}
      </CardContent>
    </Card>
  );
}
