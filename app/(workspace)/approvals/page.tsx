import { ApprovalsClient } from "@/features/approvals/approvals-client";
import { loadApprovalsPageData } from "@/features/approvals/page-loader";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ approvalId?: string; evidenceOpen?: string }>;
}) {
  const {
    actionGovernance,
    candidateGovernance,
    approvalId,
    evidenceOpen,
    tasks,
    governedCandidates,
    learningPanels,
    businessLoopGapSummary,
    firstLoopModel,
    biBoardContribution,
  } =
    await loadApprovalsPageData(searchParams);

  return (
    <ApprovalsClient
      actionGovernance={actionGovernance}
      candidateGovernance={candidateGovernance}
      governedCandidates={governedCandidates}
      tasks={tasks}
      learningPanels={learningPanels}
      businessLoopGapSummary={businessLoopGapSummary}
      firstLoopModel={firstLoopModel}
      biBoardContribution={biBoardContribution}
      initialApprovalId={approvalId}
      initialEvidencePanelOpen={evidenceOpen}
    />
  );
}
