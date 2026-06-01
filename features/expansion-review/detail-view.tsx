import { AgentSurfaceDetailView } from "@/components/shared/agent-surface-detail-view";
import type { ExpansionReviewPageModel } from "@/features/expansion-review/detail-model";

export function ExpansionReviewDetailView({
  model,
  english,
}: {
  model: ExpansionReviewPageModel;
  english: boolean;
}) {
  return (
    <AgentSurfaceDetailView
      wrapperDataAttributes={{
        "data-expansion-review-agent-surface":
          model.rootDataAttributes["data-expansion-review-agent-surface"],
        "data-shared-agent-surface":
          model.rootDataAttributes["data-shared-agent-surface"],
      }}
      rootDataAttributes={model.rootDataAttributes}
      english={english}
      eyebrow={model.eyebrow}
      title={model.title}
      description={model.description}
      actions={model.actions}
      briefingLabel={model.briefingLabel}
      navigation={model.navigation}
      protocol={model.protocol}
      chips={model.chips}
      secondarySummaryItems={model.secondarySummaryItems}
      recentChangesLabel={model.recentChangesLabel}
      recentChangesItems={model.recentChangesItems}
      resurfaceReasonLabel={model.resurfaceReasonLabel}
      resurfaceReasonItems={model.resurfaceReasonItems}
      policyLabel={model.policyLabel}
      policyItems={model.policyItems}
      boundaryLabel={model.boundaryLabel}
      firstScreenEvidenceItems={model.protocol.pageEvidenceSummary}
      actionLabel={model.actionLabel}
      progressTraceLabel={model.progressTraceLabel}
      progressTraceItems={model.progressTraceItems}
      evidenceLabel={model.evidenceLabel}
      evidenceCountLabel={model.evidenceCountLabel}
      evidenceGroups={model.evidenceGroups}
      stageBadge={model.stageBadge}
    />
  );
}
