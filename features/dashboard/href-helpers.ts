import {
  MEMORY_PAGE_ANCHORS,
  OPPORTUNITY_PAGE_ANCHORS,
  buildSectionHref,
} from "@/lib/presentation/page-section-anchors";
import {
  buildCustomerAssetHref,
  buildOpportunityAssetHref,
} from "@/features/business-assets/hrefs";

export function buildDashboardMemoryHref(
  objectType?: string | null,
  objectId?: string | null,
  anchorId: string = MEMORY_PAGE_ANCHORS.timeline,
) {
  if (
    objectId &&
    (objectType === "CONTACT" ||
      objectType === "COMPANY" ||
      objectType === "OPPORTUNITY" ||
      objectType === "MEETING")
  ) {
    return buildSectionHref(
      `/memory?objectType=${objectType}&objectId=${objectId}`,
      anchorId,
    );
  }

  return buildSectionHref("/memory", anchorId);
}

export function buildDashboardObjectHref(input: {
  opportunity?: { id: string } | null;
  contact?: { id: string } | null;
  meeting?: { id: string } | null;
  company?: { id: string } | null;
  opportunityAnchor?: string;
}) {
  if (input.opportunity) {
    return input.opportunityAnchor
      ? buildSectionHref(
          `/opportunities?opportunityId=${input.opportunity.id}`,
          input.opportunityAnchor ?? OPPORTUNITY_PAGE_ANCHORS.briefing,
        )
      : buildOpportunityAssetHref(input.opportunity.id, "dashboard");
  }

  if (input.contact) {
    return `/contacts/${input.contact.id}`;
  }

  if (input.meeting) {
    return `/meetings/${input.meeting.id}`;
  }

  if (input.company) {
    return buildCustomerAssetHref(input.company.id, "dashboard");
  }

  return "/dashboard";
}

export function buildTopPriorityHref(item: {
  objectType: string;
  objectId: string;
}) {
  if (item.objectType === "CONTACT") return `/contacts/${item.objectId}`;
  if (item.objectType === "MEETING") return `/meetings/${item.objectId}`;
  if (item.objectType === "COMPANY") {
    return buildCustomerAssetHref(item.objectId, "dashboard-priority");
  }
  return buildOpportunityAssetHref(item.objectId, "dashboard-priority");
}

export function hasEvidenceTarget<T>(value: T | null | undefined): value is T {
  return Boolean(value);
}
