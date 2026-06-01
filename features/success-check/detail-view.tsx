import { AgentSurfaceDetailView } from "@/components/shared/agent-surface-detail-view";
import type { SuccessCheckPageModel } from "@/features/success-check/detail-model";

export function SuccessCheckDetailView({
  model,
  english,
}: {
  model: SuccessCheckPageModel;
  english: boolean;
}) {
  return (
    <AgentSurfaceDetailView
      wrapperDataAttributes={{
        "data-success-check-agent-surface":
          model.rootDataAttributes["data-success-check-agent-surface"],
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
