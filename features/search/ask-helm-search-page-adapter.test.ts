import { describe, expect, it } from "vitest";
import { buildAskHelmRelatedObjectsFromSearchResults } from "@/features/search/ask-helm-search-page-adapter";

describe("Ask Helm search page adapter", () => {
  it("maps existing search results into grounded related objects", () => {
    const relatedObjects = buildAskHelmRelatedObjectsFromSearchResults({
      opportunities: [
        {
          id: "opp_1",
          title: "Atlas renewal",
          stage: "QUALIFIED",
        },
      ],
      companies: [
        {
          id: "company_1",
          name: "星河连锁",
          industry: "SaaS",
        },
      ],
      contacts: [
        {
          id: "contact_1",
          name: "宋岚",
          title: "增长负责人",
          company: { name: "星河连锁" },
        },
      ],
      meetings: [
        {
          id: "meeting_1",
          title: "Renewal review",
          startsAt: new Date("2026-04-25T10:00:00.000Z"),
        },
      ],
    } as never);

    expect(relatedObjects).toEqual([
      {
        objectType: "opportunity",
        objectId: "opp_1",
        displayName: "Atlas renewal",
        status: "QUALIFIED",
        deepLink: "/opportunities?opportunityId=opp_1",
      },
      {
        objectType: "company",
        objectId: "company_1",
        displayName: "星河连锁",
        status: "SaaS",
        deepLink: "/companies/company_1",
      },
      {
        objectType: "contact",
        objectId: "contact_1",
        displayName: "宋岚",
        status: "增长负责人",
        deepLink: "/contacts/contact_1",
      },
      {
        objectType: "meeting",
        objectId: "meeting_1",
        displayName: "Renewal review",
        status: "2026-04-25",
        deepLink: "/meetings/meeting_1",
      },
    ]);
  });
});
