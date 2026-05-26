import {
  MEMORY_PAGE_ANCHORS,
  OPPORTUNITY_PAGE_ANCHORS,
  buildSectionHref,
} from "@/lib/presentation/page-section-anchors";

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
    return buildSectionHref(
      `/opportunities?opportunityId=${input.opportunity.id}`,
      input.opportunityAnchor ?? OPPORTUNITY_PAGE_ANCHORS.briefing,
    );
  }

  if (input.contact) {
    return `/contacts/${input.contact.id}`;
  }

  if (input.meeting) {
    return `/meetings/${input.meeting.id}`;
  }

  if (input.company) {
    return `/companies/${input.company.id}`;
  }

  return "/dashboard";
}

export function buildTopPriorityHref(item: {
  objectType: string;
  objectId: string;
}) {
  if (item.objectType === "CONTACT") return `/contacts/${item.objectId}`;
  if (item.objectType === "MEETING") return `/meetings/${item.objectId}`;
  if (item.objectType === "COMPANY") return `/companies/${item.objectId}`;
  return `/opportunities?opportunityId=${item.objectId}`;
}

export function hasEvidenceTarget<T>(value: T | null | undefined): value is T {
  return Boolean(value);
}
