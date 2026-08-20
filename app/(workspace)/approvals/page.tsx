import { ApprovalsClient } from "@/features/approvals/approvals-client";
import { loadApprovalsPageData } from "@/features/approvals/page-loader";
import { Stage1DecisionQueue } from "@/features/approvals/stage1-decision-queue";
import { loadStage1OwnerDecisionQueue } from "@/features/approvals/stage1-decision-queue-loader";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ approvalId?: string; evidenceOpen?: string }>;
}) {
  const [{
    actionGovernance,
    candidateGovernance,
    approvalId,
    evidenceOpen,
    tasks,
    governedCandidates,
    memberSignalCandidates,
    learningPanels,
    businessLoopGapSummary,
    firstLoopModel,
    biBoardContribution,
  }, stage1DecisionQueue] = await Promise.all([
    loadApprovalsPageData(searchParams),
    loadStage1OwnerDecisionQueue(),
  ]);

  return (
    <>
      <Stage1DecisionQueue {...stage1DecisionQueue} />
      <ApprovalsClient
        actionGovernance={actionGovernance}
        candidateGovernance={candidateGovernance}
        governedCandidates={governedCandidates}
        memberSignalCandidates={memberSignalCandidates}
        tasks={tasks}
        learningPanels={learningPanels}
        businessLoopGapSummary={businessLoopGapSummary}
        firstLoopModel={firstLoopModel}
        biBoardContribution={biBoardContribution}
        initialApprovalId={approvalId}
        initialEvidencePanelOpen={evidenceOpen}
      />
    </>
  );
}
