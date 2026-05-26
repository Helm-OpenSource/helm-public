import type { AskHelmGroundedObject } from "@/features/search/ask-helm-interpreter";
import type { SearchWorkspaceEntitiesResult } from "@/features/search/queries";
import { trimText } from "@/lib/utils";

export function buildAskHelmRelatedObjectsFromSearchResults(
  results: SearchWorkspaceEntitiesResult,
): AskHelmGroundedObject[] {
  return [
    ...results.opportunities.map((opportunity) => ({
      objectType: "opportunity" as const,
      objectId: opportunity.id,
      displayName: opportunity.title,
      status: String(opportunity.stage),
      deepLink: `/opportunities?opportunityId=${opportunity.id}`,
    })),
    ...results.companies.map((company) => ({
      objectType: "company" as const,
      objectId: company.id,
      displayName: company.name,
      status: trimText(company.industry ?? "Company", 48),
      deepLink: `/companies/${company.id}`,
    })),
    ...results.contacts.map((contact) => ({
      objectType: "contact" as const,
      objectId: contact.id,
      displayName: contact.name,
      status: trimText(contact.title ?? contact.company?.name ?? "Contact", 48),
      deepLink: `/contacts/${contact.id}`,
    })),
    ...results.meetings.map((meeting) => ({
      objectType: "meeting" as const,
      objectId: meeting.id,
      displayName: meeting.title,
      status: meeting.startsAt.toISOString().slice(0, 10),
      deepLink: `/meetings/${meeting.id}`,
    })),
  ];
}
