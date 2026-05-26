import { notFound } from "next/navigation";
import { loadCompanyDetailPageData } from "@/features/companies/page-loader";
import { CompanyDetailClient } from "@/features/companies/company-detail-client";
import { ConversationChainExtensionDetailView } from "@/features/conversation-chain-extension/detail-view";
import { buildCompanyConversationChainExtensionModel } from "@/features/conversation-chain-extension/detail-model";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadCompanyDetailPageData(id);

  if (!detail) return notFound();

  const { approvalTasks, company, english, recommendations, stageLabels } = detail;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentInteractionCount =
    [...company.meetings.map((meeting) => meeting.startsAt), ...company.memoryEntries.map((entry) => entry.createdAt)]
      .filter((date) => date.getTime() >= thirtyDaysAgo.getTime()).length;

  const companyOpportunityIds = new Set(company.opportunities.map((item) => item.id));
  const pendingReviewRequest =
    approvalTasks.find(
      (task) =>
        task.status === "PENDING" &&
        task.actionItem.opportunity?.id &&
        companyOpportunityIds.has(task.actionItem.opportunity.id),
    ) ?? null;
  const customerSuccessOpportunityId = company.opportunities[0]?.id ?? null;

  const chainModel = buildCompanyConversationChainExtensionModel({
    company,
    english,
    stageLabels,
    pendingReviewRequestId: pendingReviewRequest?.id ?? null,
    customerSuccessOpportunityId,
  });
  const companyRouteIdentity = { sourcePage: `/companies/${company.id}` as const };

  return (
    <div className="space-y-6" data-source-page={companyRouteIdentity.sourcePage}>
      <ConversationChainExtensionDetailView model={chainModel} english={english} />
      <div data-conversation-chain-object-detail="company-detail">
        <CompanyDetailClient
          company={company}
          recentInteractionCount={recentInteractionCount}
          recommendations={recommendations}
        />
      </div>
    </div>
  );
}
