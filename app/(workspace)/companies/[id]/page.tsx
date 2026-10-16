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

  const {
    company,
    emailThreads,
    english,
    pendingReviewRequestId,
    recommendations,
    stageLabels,
  } = detail;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentInteractionCount =
    [...company.meetings.map((meeting) => meeting.startsAt), ...company.memoryEntries.map((entry) => entry.createdAt)]
      .filter((date) => date.getTime() >= thirtyDaysAgo.getTime()).length;

  const customerSuccessOpportunityId = company.opportunities[0]?.id ?? null;

  const chainModel = buildCompanyConversationChainExtensionModel({
    company,
    english,
    stageLabels,
    pendingReviewRequestId,
    customerSuccessOpportunityId,
  });
  const companyRouteIdentity = { sourcePage: `/companies/${company.id}` as const };

  // Object first: the company client owns the page header and renders the
  // chain shell inside its single closing system judgement block.
  return (
    <div className="space-y-6" data-source-page={companyRouteIdentity.sourcePage}>
      <div data-conversation-chain-object-detail="company-detail">
        <CompanyDetailClient
          company={company}
          emailThreads={emailThreads}
          recentInteractionCount={recentInteractionCount}
          recommendations={recommendations}
          relatedLinks={chainModel.actions}
          supplementary={
            <ConversationChainExtensionDetailView model={chainModel} english={english} />
          }
        />
      </div>
    </div>
  );
}
