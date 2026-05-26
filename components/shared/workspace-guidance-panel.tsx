import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { ControlledDisclosure } from "@/components/shared/controlled-disclosure";
import { Badge } from "@/components/ui/badge";

type WorkspaceGuidanceItemBadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "approval"
  | "neutral";

type WorkspaceGuidanceItem = {
  title: string;
  body: string;
  href?: string;
  meta?: string;
  badge?: { label: string; variant?: WorkspaceGuidanceItemBadgeVariant };
};

type WorkspaceGuidancePanelProps = {
  eyebrow: string;
  title: string;
  summary: string;
  recommendations: WorkspaceGuidanceItem[];
  reminders?: WorkspaceGuidanceItem[];
  boundary?: string;
  recommendationsLabel?: string;
  remindersLabel?: string;
  boundaryLabel?: string;
  defaultExpanded?: boolean;
};

function GuidanceEntry({
  item,
  optional = false,
}: {
  item: WorkspaceGuidanceItem;
  optional?: boolean;
}) {
  const content = (
    <article
      className="workspace-guidance-item"
      data-guidance-optional={optional ? "true" : "false"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="workspace-guidance-item-title">{item.title}</p>
        {item.badge ? (
          <Badge variant={item.badge.variant ?? "neutral"}>
            {item.badge.label}
          </Badge>
        ) : null}
      </div>
      <p className="workspace-guidance-item-body">{item.body}</p>
      {item.meta ? (
        <p className="workspace-guidance-item-meta workspace-guidance-detail">
          {item.meta}
        </p>
      ) : null}
    </article>
  );

  if (!item.href) {
    return <li>{content}</li>;
  }

  return (
    <li>
      <Link href={item.href} aria-label={item.title} className="block">
        {content}
      </Link>
    </li>
  );
}

export function WorkspaceGuidancePanel({
  eyebrow,
  title,
  summary,
  recommendations,
  reminders = [],
  boundary,
  recommendationsLabel = "Recommended next moves",
  remindersLabel = "Context reminders",
  boundaryLabel = "Boundary",
  defaultExpanded = false,
}: WorkspaceGuidancePanelProps) {
  const idBase = buildStableGuidanceId(eyebrow, title);
  const titleId = `${idBase}-title`;
  const summaryId = `${idBase}-summary`;
  const recommendationsId = `${idBase}-recommendations`;
  const remindersId = `${idBase}-reminders`;
  const boundaryId = `${idBase}-boundary`;

  return (
    <section
      className="workspace-guidance-card"
      aria-labelledby={titleId}
      aria-describedby={summaryId}
    >
      <ControlledDisclosure
        className="workspace-guidance-disclosure"
        data-default-expanded={defaultExpanded ? "true" : "false"}
        defaultExpanded={defaultExpanded}
        summaryLabel={title}
        summaryClassName="workspace-guidance-summary"
        bodyClassName="workspace-guidance-body space-y-4 border-t border-[color:var(--border)] pt-4"
        summary={
          <>
            <div className="min-w-0 space-y-2">
              <p className="workspace-eyebrow">{eyebrow}</p>
              <h2
                id={titleId}
                className="workspace-guidance-heading font-semibold tracking-tight text-[color:var(--foreground)]"
              >
                {title}
              </h2>
              <div className="workspace-guidance-meta-row">
                <span className="workspace-guidance-meta-pill">
                  {compactGuidanceSummaryLabel(
                    "Primary",
                    "主项",
                    recommendationsLabel,
                  )} · {recommendations.length}
                </span>
                {reminders.length ? (
                  <span className="workspace-guidance-meta-pill">
                    {compactGuidanceSummaryLabel("More", "附注", remindersLabel)} · {reminders.length}
                  </span>
                ) : null}
                {boundary ? (
                  <span className="workspace-guidance-meta-pill">
                    {compactGuidanceSummaryLabel("Rules", "规则", boundaryLabel)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="workspace-guidance-toggle">
              <ChevronDown className="h-4 w-4" />
            </div>
          </>
        }
      >
        <p
          id={summaryId}
          className="workspace-guidance-summary-copy max-w-4xl text-sm leading-7 text-[color:var(--muted-foreground)]"
        >
          {summary}
        </p>
        <div className="workspace-guidance-grid">
          <div className="space-y-3">
            <p id={recommendationsId} className="workspace-guidance-section-label">
              {recommendationsLabel}
            </p>
            <ul
              className="space-y-3 workspace-guidance-list"
              aria-labelledby={recommendationsId}
            >
              {recommendations.map((item, index) => (
                <GuidanceEntry
                  key={guidanceEntryKey("recommendation", item, index)}
                  item={item}
                />
              ))}
            </ul>
          </div>

          {reminders.length ? (
            <div className="space-y-3 workspace-guidance-detail">
              <p id={remindersId} className="workspace-guidance-section-label">
                {remindersLabel}
              </p>
              <ul
                className="space-y-3 workspace-guidance-list"
                aria-labelledby={remindersId}
              >
                {reminders.map((item, index) => (
                  <GuidanceEntry
                    key={guidanceEntryKey("reminder", item, index)}
                    item={item}
                    optional
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {boundary ? (
          <div className="workspace-guidance-boundary workspace-guidance-detail">
            <p id={boundaryId} className="workspace-guidance-section-label">
              {boundaryLabel}
            </p>
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              {boundary}
            </p>
          </div>
        ) : null}
      </ControlledDisclosure>
    </section>
  );
}

function buildStableGuidanceId(eyebrow: string, title: string) {
  const input = `${eyebrow}-${title}`.toLowerCase();
  const slug = input
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (slug.length > 0) {
    return `workspace-guidance-${slug}`;
  }

  return "workspace-guidance-default";
}

function compactGuidanceSummaryLabel(
  englishLabel: string,
  chineseLabel: string,
  currentLabel: string,
) {
  return /[\u4e00-\u9fa5]/.test(currentLabel) ? chineseLabel : englishLabel;
}

function guidanceEntryKey(
  scope: string,
  item: WorkspaceGuidanceItem,
  index: number,
) {
  return `${scope}-${item.href ?? "static"}-${item.title}-${index}`;
}
