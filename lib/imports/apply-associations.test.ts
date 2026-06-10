import { ImportSourceType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    contact: { update: vi.fn().mockResolvedValue({}) },
    opportunity: { update: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { applyAssociations } from "@/lib/imports/crm-orchestrator.service";
import type { CrmDataset } from "@/lib/imports/crm-types";

function datasetWith(associations: CrmDataset["associations"]): CrmDataset {
  return {
    sourceType: ImportSourceType.HUBSPOT,
    owners: [],
    contacts: [],
    companies: [],
    opportunities: [],
    meetings: [],
    notes: [],
    tasks: [],
    associations,
    usedMock: false,
  } as unknown as CrmDataset;
}

describe("applyAssociations multi-company binding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("binds a contact to its FIRST company association only (no last-writer clobber)", async () => {
    const result = await applyAssociations({
      contactByExternalId: new Map([["c-ext", "contact-1"]]),
      companyByExternalId: new Map([
        ["co-parent", "company-parent"],
        ["co-sub", "company-sub"],
      ]),
      opportunityByExternalId: new Map(),
      dataset: datasetWith([
        { fromType: "CONTACT", fromId: "c-ext", toType: "COMPANY", toId: "co-parent" },
        { fromType: "CONTACT", fromId: "c-ext", toType: "COMPANY", toId: "co-sub" },
      ]),
    });

    // Exactly one update, to the first (parent) company.
    expect(dbMock.contact.update).toHaveBeenCalledTimes(1);
    expect(dbMock.contact.update).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { companyId: "company-parent" },
    });
    expect(result.contactCompanyLinks).toBe(1);
  });

  it("binds an opportunity to its first company association only", async () => {
    await applyAssociations({
      contactByExternalId: new Map(),
      companyByExternalId: new Map([
        ["co-a", "company-a"],
        ["co-b", "company-b"],
      ]),
      opportunityByExternalId: new Map([["o-ext", "opp-1"]]),
      dataset: datasetWith([
        { fromType: "OPPORTUNITY", fromId: "o-ext", toType: "COMPANY", toId: "co-a" },
        { fromType: "OPPORTUNITY", fromId: "o-ext", toType: "COMPANY", toId: "co-b" },
      ]),
    });

    expect(dbMock.opportunity.update).toHaveBeenCalledTimes(1);
    expect(dbMock.opportunity.update).toHaveBeenCalledWith({
      where: { id: "opp-1" },
      data: { companyId: "company-a" },
    });
  });
});
