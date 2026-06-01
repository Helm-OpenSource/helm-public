import { AgentSurfaceDetailView } from "@/components/shared/agent-surface-detail-view";
import type { CustomerSuccessHandoffPageModel } from "@/features/customer-success-handoff/detail-model";
import { formatCustomerSuccessHandoffDetailModel } from "@/features/customer-success-handoff/display-copy";
import { CustomerSuccessExternalDraftsPanel } from "@/features/customer-success-handoff/external-drafts-panel";
import { CustomerSuccessInternalActionsPanel } from "@/features/customer-success-handoff/internal-actions-panel";

export function CustomerSuccessHandoffDetailView({
  model,
  english,
}: {
  model: CustomerSuccessHandoffPageModel;
  english: boolean;
}) {
  const displayModel = formatCustomerSuccessHandoffDetailModel(model, english);

  return (
    <AgentSurfaceDetailView
      wrapperDataAttributes={{
        "data-customer-success-handoff-kind":
          displayModel.rootDataAttributes["data-customer-success-handoff-kind"],
      }}
      rootDataAttributes={displayModel.rootDataAttributes}
      english={english}
      eyebrow={displayModel.eyebrow}
      title={displayModel.title}
      description={displayModel.description}
      actions={displayModel.actions}
      briefingLabel={displayModel.briefingLabel}
      navigation={displayModel.navigation}
      protocol={displayModel.protocol}
      chips={displayModel.chips}
      secondarySummaryItems={displayModel.secondarySummaryItems}
      recentChangesLabel={displayModel.recentChangesLabel}
      recentChangesItems={displayModel.recentChangesItems}
      resurfaceReasonLabel={displayModel.resurfaceReasonLabel}
      resurfaceReasonItems={displayModel.resurfaceReasonItems}
      advisoryLabel={displayModel.processAdvisoryLabel}
      advisoryItems={displayModel.processAdvisoryItems}
      policyLabel={displayModel.policyLabel}
      policyItems={displayModel.policyItems}
      actionSummaryLabel={displayModel.actionSummaryLabel}
      decisionRequestLabel={displayModel.decisionRequestLabel}
      decisionLabel={displayModel.decisionLabel}
      decisionItems={displayModel.decisionItems}
      boundaryLabel={displayModel.boundaryLabel}
      evidenceSummaryLabel={displayModel.evidenceSummaryLabel}
      firstScreenEvidenceItems={
        english ? displayModel.protocol.pageEvidenceSummary : []
      }
      actionLabel={displayModel.actionLabel}
      actionExecutionPanel={
        <CustomerSuccessInternalActionsPanel
          opportunityId={displayModel.opportunityId}
          label={displayModel.internalActionsLabel}
          actions={displayModel.internalActions}
          english={english}
        />
      }
      draftsPanel={
        <CustomerSuccessExternalDraftsPanel
          label={displayModel.externalDraftsLabel}
          drafts={displayModel.externalDrafts}
          english={english}
        />
      }
      progressTraceLabel={displayModel.progressTraceLabel}
      progressTraceItems={displayModel.progressTraceItems}
      evidenceLabel={displayModel.evidenceLabel}
      evidenceCountLabel={displayModel.evidenceCountLabel}
      evidenceGroups={displayModel.evidenceGroups}
      stageBadge={displayModel.stageBadge}
    />
  );
}
