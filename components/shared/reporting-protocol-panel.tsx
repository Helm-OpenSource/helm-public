import {
  ActionRail,
  BoundaryNote,
  DecisionRequestCard,
  EvidenceDrawer,
  NarrativeHeader,
  ReviewSnapshotBlock,
  WhyItMattersBlock,
  WorkerSummary,
} from "@/components/shared/narrative-components";
import type { PageReportingProtocol } from "@/lib/presentation/reporting-protocol";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";
import { cn } from "@/lib/utils";

export function ReportingProtocolPanel({
  protocol,
  english,
  className,
}: {
  protocol: PageReportingProtocol;
  english: boolean;
  className?: string;
}) {
  const copy = (value: string | null | undefined) =>
    formatSeededBusinessCopy(value, english);
  const copyItems = (items: string[]) => items.map((item) => copy(item));
  const evidenceGroups = protocol.pageEvidenceGroups?.map((group) => ({
    ...group,
    label: copy(group.label),
    items: group.items.map((item) =>
      typeof item === "string"
        ? copy(item)
        : {
            ...item,
            label: copy(item.label),
            summary: item.summary ? copy(item.summary) : item.summary,
          },
    ),
  }));

  return (
    <section
      data-reporting-protocol="true"
      className={cn(
        "workspace-shell-panel overflow-hidden rounded-[30px] text-[color:var(--foreground)]",
        className,
      )}
    >
      <div className="px-5 py-5 xl:px-6 xl:py-6">
        <div data-page-layer="frontstage" className="space-y-5">
          <div
            data-frontstage-block="current-summary"
            data-page-judgement="true"
          >
            <NarrativeHeader
              label={english ? "Current summary" : "当前状态"}
              title={copy(protocol.pageJudgement)}
              summary={copy(protocol.pageJudgementReason)}
              prioritySignal={copy(protocol.pagePrioritySignal)}
            />
          </div>

          <div
            data-frontstage-block="decision-request"
            data-page-decision-request="true"
          >
            <DecisionRequestCard
              label={english ? "Decision request" : "待拍板事项"}
              items={copyItems(protocol.pageDecisionRequest)}
            />
          </div>

          <div data-frontstage-block="next-action">
            <ActionRail
              label={english ? "Next action" : "下一步动作"}
              actions={protocol.pageNextAction.map((action) => ({
                ...action,
                label: copy(action.label),
              }))}
            />
          </div>

          <div data-frontstage-block="boundary">
            <BoundaryNote
              label={english ? "Boundary" : "边界"}
              items={copyItems(protocol.pageBoundarySummary)}
              escalationHint={copy(protocol.pageEscalationHint)}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_88%,var(--surface-subtle)_12%)] px-5 py-5 xl:px-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,430px)]">
          <div data-page-layer="midstage" className="space-y-4">
            <ReviewSnapshotBlock
              label={english ? "Prepared actions" : "待确认动作"}
              items={copyItems(protocol.pageActionSummary)}
              english={english}
              reviewState={protocol.pageReviewState}
            />

            <WorkerSummary
              label={english ? "Owners and support" : "负责人和配合"}
              items={copyItems(protocol.pageWorkerSummary)}
              assignments={protocol.pageWorkerAssignments?.map(
                (assignment) => ({
                  ...assignment,
                  title: copy(assignment.title),
                  summary: copy(assignment.summary),
                  items: copyItems(assignment.items),
                  chips: assignment.chips?.map((chip) => copy(chip)),
                }),
              )}
            />
          </div>

          <div data-page-layer="backstage">
            <WhyItMattersBlock
              label={english ? "Why this matters now" : "为什么现在需要处理"}
              reasons={copyItems(protocol.pageWhyItMatters)}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--background-elevated)_88%,var(--surface-subtle)_12%)] px-5 py-5 xl:px-6">
        <div data-page-layer="evidence">
          <EvidenceDrawer
            marker="page"
            label={english ? "Supporting context" : "依据与来龙去脉"}
            summaryItems={copyItems(protocol.pageEvidenceSummary)}
            links={protocol.pageEvidenceLinks?.map((link) => ({
              ...link,
              label: copy(link.label),
            }))}
            groups={evidenceGroups}
            countLabel={
              protocol.pageEvidenceGroups?.length
                ? english
                  ? `${protocol.pageEvidenceGroups.length} grouped tracks`
                  : `${protocol.pageEvidenceGroups.length} 组依据`
                : english
                  ? `${protocol.pageEvidenceSummary.length} signals`
                  : `${protocol.pageEvidenceSummary.length} 条信号`
            }
          />
        </div>
      </div>
    </section>
  );
}
