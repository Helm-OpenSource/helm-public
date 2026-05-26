import "server-only";

import { db } from "@/lib/db";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import {
  getOpportunitiesData,
  getWorkspaceDingTalkWorkProgress,
} from "@/features/opportunities/queries";
import {
  findMembershipsWithExistingUsers,
  type MembershipWithUser,
} from "@/lib/auth/membership-with-user";
import { getWorkspaceBusinessLoopGapReadout } from "@/lib/helm-v2/runtime-upgrade";
import type { BusinessLoopGapSummary } from "@/lib/operating-system";

type OpportunityPreset = "all" | "overdue" | "high-risk";
type OpportunityRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type OpportunitySort = "priority" | "due" | "risk" | "updated";
type OpportunityAction = "approval" | "unassigned" | "priority";
type OpportunitiesInitialFilters = {
  preset?: OpportunityPreset | null;
  risk?: OpportunityRisk | null;
  sort?: OpportunitySort | null;
  mine?: boolean;
  overdue?: boolean;
  action?: OpportunityAction | null;
};

type OpportunitySearchParams = Promise<{
  opportunityId?: string;
  preset?: OpportunityPreset | string;
  risk?: OpportunityRisk | string;
  sort?: OpportunitySort | string;
  mine?: string;
  overdue?: string;
  action?: OpportunityAction | string;
}>;

export async function loadOpportunitiesPageData(
  searchParams: OpportunitySearchParams,
): Promise<{
  opportunities: Awaited<ReturnType<typeof getOpportunitiesData>>;
  companies: Awaited<
    ReturnType<
      typeof db.company.findMany<{
        where: { workspaceId: string };
        orderBy: { name: "asc" };
      }>
    >
  >;
  memberships: MembershipWithUser[];
  currentUserId: string;
  initialOpportunityId: string | null;
  initialFilters: OpportunitiesInitialFilters;
  workspaceDingTalkWorkProgress: Awaited<
    ReturnType<typeof getWorkspaceDingTalkWorkProgress>
  >;
  businessLoopGapSummary: BusinessLoopGapSummary;
}> {
  const workspace = await getCurrentWorkspace();
  const user = await requireCurrentUser();
  const { opportunityId, preset, risk, sort, mine, overdue, action } =
    await searchParams;
  const [
    opportunities,
    companies,
    memberships,
    workspaceDingTalkWorkProgress,
    businessLoopGapReadout,
  ] = await Promise.all([
    getOpportunitiesData(workspace.id),
    db.company.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
    }),
    findMembershipsWithExistingUsers({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
    }),
    getWorkspaceDingTalkWorkProgress(workspace.id),
    getWorkspaceBusinessLoopGapReadout(workspace.id),
  ]);

  return {
    opportunities,
    companies,
    memberships,
    businessLoopGapSummary: businessLoopGapReadout.businessLoopGapSummary,
    currentUserId: user.id,
    workspaceDingTalkWorkProgress,
    initialOpportunityId: opportunityId ?? null,
    initialFilters: {
      preset:
        preset === "all" || preset === "overdue" || preset === "high-risk"
          ? preset
          : null,
      risk:
        risk === "LOW" ||
        risk === "MEDIUM" ||
        risk === "HIGH" ||
        risk === "CRITICAL"
          ? risk
          : null,
      sort:
        sort === "priority" ||
        sort === "due" ||
        sort === "risk" ||
        sort === "updated"
          ? sort
          : null,
      mine: mine === "1",
      overdue: overdue === "1",
      action:
        action === "approval" ||
        action === "unassigned" ||
        action === "priority"
          ? action
          : null,
    } satisfies OpportunitiesInitialFilters,
  };
}
