import { AgentSurfaceDetailView } from "@/components/shared/agent-surface-detail-view";
import type { InboxFollowupReviewRequestPageModel } from "@/features/inbox-followup-review-request/detail-model";

export function InboxFollowupReviewRequestDetailView({
  model,
  english,
}: {
  model: InboxFollowupReviewRequestPageModel;
  english: boolean;
}) {
  return (
    <AgentSurfaceDetailView
      wrapperDataAttributes={{
        "data-inbox-followup-review-request-page":
          model.rootDataAttributes["data-inbox-followup-review-request-page"],
        "data-inbox-followup-review-request-kind":
          model.rootDataAttributes["data-inbox-followup-review-request-kind"],
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
