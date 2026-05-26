import { OpportunitiesClient } from "@/features/opportunities/opportunities-client";
import { loadOpportunitiesPageData } from "@/features/opportunities/page-loader";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    opportunityId?: string;
    preset?: string;
    risk?: string;
    sort?: string;
    mine?: string;
    overdue?: string;
    action?: string;
  }>;
}) {
  const {
    businessLoopGapSummary,
    companies,
    currentUserId,
    initialFilters,
    initialOpportunityId,
    memberships,
    opportunities,
    workspaceDingTalkWorkProgress,
  } = await loadOpportunitiesPageData(searchParams);

  return (
    <OpportunitiesClient
      opportunities={opportunities}
      companies={companies}
      memberships={memberships}
      currentUserId={currentUserId}
      workspaceDingTalkWorkProgress={workspaceDingTalkWorkProgress}
      initialOpportunityId={initialOpportunityId}
      initialFilters={initialFilters}
      businessLoopGapSummary={businessLoopGapSummary}
    />
  );
}
