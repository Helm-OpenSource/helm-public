import Link from "next/link";
import type { PageReportingProtocol } from "@/lib/presentation/reporting-protocol";
import type { UnifiedDetailNavigationModel } from "@/lib/presentation/unified-detail-navigation";
import { trimText } from "@/lib/utils";

type OperatingSummaryProtocol = {
  pageJudgement: string;
  pageJudgementReason: string;
  pageNextAction: Array<{ label: string }>;
  pageDecisionRequest: string[];
  pageBoundarySummary: string[];
  pageEvidenceSummary: string[];
  pageWorkerSummary: string[];
};

export type DetailOperatingSummaryItem = {
  label: string;
  value: string;
};

export type DetailOperatingSummaryConnection = {
  label: string;
  value: string;
  description: string;
  href?: string;
};

function getDetailOperatingSummaryConnectionAriaLabel(
  connection: DetailOperatingSummaryConnection,
) {
  const compactValue = trimText(connection.value, 44);

  return [connection.label, compactValue]
    .filter(Boolean)
    .join("：");
}

export function DetailOperatingSummaryCard({
  label,
  items,
  connectionsLabel,
  connections,
}: {
  label: string;
  items: DetailOperatingSummaryItem[];
  connectionsLabel?: string;
  connections?: DetailOperatingSummaryConnection[];
}) {
  return (
    <section className="theme-detail-shell-card space-y-3 rounded-[26px] px-4 py-4">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
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
      {connections?.length ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {connectionsLabel}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {connections.map((connection) => {
              const content = (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {connection.label}
                  </p>
                  <p className="text-sm font-medium leading-7 text-[color:var(--dark-inset-foreground)]">
                    {connection.value}
                  </p>
                  <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {connection.description}
                  </p>
                </div>
              );

              if (connection.href) {
                return (
                  <Link
                    key={`${connection.label}-${connection.value}`}
                    href={connection.href}
                    aria-label={getDetailOperatingSummaryConnectionAriaLabel(
                      connection,
                    )}
                    className="theme-detail-shell-tile rounded-[18px] px-3 py-3 transition hover:border-[color:rgba(148,163,184,0.34)] hover:bg-[color:rgba(15,23,42,0.86)]"
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <div
                  key={`${connection.label}-${connection.value}`}
                  className="theme-detail-shell-tile rounded-[18px] px-3 py-3"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function buildObjectContextDetailOperatingSummaryItems({
  english,
  protocol,
  objectStateLine,
}: {
  english: boolean;
  protocol: OperatingSummaryProtocol;
  objectStateLine: string;
}): DetailOperatingSummaryItem[] {
  return [
    {
      label: english ? "Current object and status" : "当前对象与状态",
      value: trimText(objectStateLine, 96),
    },
    {
      label: english ? "Single next step" : "最重要下一步",
      value: trimText(
        protocol.pageNextAction[0]?.label ??
          protocol.pageDecisionRequest[0] ??
          protocol.pageJudgement,
        96,
      ),
    },
    {
      label: english ? "Current boundary" : "当前边界",
      value: trimText(
        protocol.pageBoundarySummary[0] ?? protocol.pageJudgementReason,
        110,
      ),
    },
    {
      label: english ? "Source context" : "支撑上下文",
      value: trimText(
        protocol.pageEvidenceSummary[0] ??
          protocol.pageWorkerSummary[0] ??
          protocol.pageJudgementReason,
        110,
      ),
    },
  ];
}

export function buildDetailOperatingSummaryConnections({
  english,
  navigation,
  protocol,
}: {
  english: boolean;
  navigation: UnifiedDetailNavigationModel;
  protocol: Pick<
    PageReportingProtocol,
    "pageNextAction" | "pageEvidenceLinks" | "pageEvidenceSummary" | "pageJudgementReason"
  >;
}): DetailOperatingSummaryConnection[] {
  const previousDetail = navigation.currentNode.detailNodePrev;
  const nextDetail = navigation.currentNode.detailNodeNext;
  const handoff = navigation.handoffs[0];
  const evidenceLink = protocol.pageEvidenceLinks?.[0];
  const primaryNextAction = protocol.pageNextAction[0];
  const nextActionDescription =
    handoff?.handoffNextAction?.trim() &&
    handoff.handoffNextAction.trim() !== primaryNextAction?.label.trim()
      ? handoff.handoffNextAction
      : protocol.pageJudgementReason;

  const connections: Array<DetailOperatingSummaryConnection | undefined> = [
    previousDetail
      ? {
          label: english ? "Previous context" : "上一步上下文",
          value: previousDetail.label,
          description: trimText(previousDetail.summary, 88),
          href: previousDetail.href,
        }
      : undefined,
    handoff
      ? {
          label: english ? "Current handoff" : "当前交接说明",
          value: trimText(handoff.handoffDecisionRequest, 72),
          description: trimText(
            `${handoff.handoffReason} ${handoff.handoffBoundary}`,
            110,
          ),
          href: handoff.handoffHref,
        }
      : nextDetail
        ? {
            label: english ? "Next context" : "下一步上下文",
            value: nextDetail.label,
            description: trimText(nextDetail.summary, 88),
            href: nextDetail.href,
          }
        : undefined,
    primaryNextAction
      ? {
          label: english ? "Next action" : "下一步动作",
          value: primaryNextAction.label,
          description: trimText(nextActionDescription, 96),
          href: primaryNextAction.href,
        }
      : undefined,
    evidenceLink
      ? {
          label: english ? "Open supporting context" : "查看依据",
          value: evidenceLink.label,
          description: trimText(
            protocol.pageEvidenceSummary[0] ?? protocol.pageJudgementReason,
            96,
          ),
          href: evidenceLink.href,
        }
      : undefined,
  ];

  return connections.filter(
    (item): item is DetailOperatingSummaryConnection => Boolean(item),
  );
}
