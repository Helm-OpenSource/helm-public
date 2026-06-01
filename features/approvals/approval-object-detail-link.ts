import { buildOpportunityAssetHref } from "@/features/business-assets/hrefs";

export type ApprovalObjectDetailLinkTarget = {
  contact?: { id: string } | null;
  opportunity?: { id: string } | null;
  meeting?: { id: string } | null;
  biSource?: { detailHref: string | null } | null;
};

export function buildBiReportSourceDetailHref(input: {
  skillKey: string | null;
  signalId: string | null;
}) {
  const params = new URLSearchParams({ tab: "bi-report" });
  if (input.skillKey) {
    params.set("skillKey", input.skillKey);
  }
  if (input.signalId) {
    params.set("signalId", input.signalId);
  }

  return `/reports?${params.toString()}`;
}

export function resolveApprovalObjectDetailHref(
  target: ApprovalObjectDetailLinkTarget,
) {
  if (target.contact) {
    return `/contacts/${target.contact.id}`;
  }
  if (target.opportunity) {
    return buildOpportunityAssetHref(target.opportunity.id, "approval");
  }
  if (target.meeting) {
    return `/meetings/${target.meeting.id}`;
  }

  const biDetailHref = target.biSource?.detailHref ?? null;
  if (biDetailHref?.startsWith("/") && !biDetailHref.startsWith("//")) {
    return biDetailHref;
  }

  return null;
}
