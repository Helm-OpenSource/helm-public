import { ImportSourceType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    company: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceImportServiceAccess: vi.fn(),
}));

import { resolveCompanyIdentity } from "@/lib/imports/identity-resolution.service";
import type { ExternalCompany } from "@/lib/imports/crm-types";

function buildCompany(overrides: Partial<ExternalCompany> = {}): ExternalCompany {
  return {
    externalId: "ext-1",
    sourceType: ImportSourceType.HUBSPOT,
    name: "Acme Robotics",
    domain: "acme.io",
    website: "https://acme.io",
    ...overrides,
  } as ExternalCompany;
}

describe("resolveCompanyIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.company.findFirst.mockResolvedValue(null); // no external-id exact match
  });

  it("AUTO_LINKs on a true domain match", async () => {
    dbMock.company.findMany.mockResolvedValue([
      { id: "co-1", name: "Totally Different Name", website: "https://acme.io/contact" },
    ]);
    const decision = await resolveCompanyIdentity({
      workspaceId: "ws-1",
      sourceType: ImportSourceType.HUBSPOT,
      company: buildCompany(),
    });
    expect(decision.status).toBe("AUTO_LINKED");
    expect(decision.internalObjectId).toBe("co-1");
  });

  it("does NOT auto-merge two unrelated same-named companies on different domains", async () => {
    // Import has a domain (acme.io) but the existing company is on a different
    // domain with the same name — must be NEEDS_REVIEW, never AUTO_LINKED.
    dbMock.company.findMany.mockResolvedValue([
      { id: "co-2", name: "Acme Robotics", website: "https://acmerobotics.cn" },
    ]);
    const decision = await resolveCompanyIdentity({
      workspaceId: "ws-1",
      sourceType: ImportSourceType.HUBSPOT,
      company: buildCompany(),
    });
    expect(decision.status).toBe("NEEDS_REVIEW");
    expect(decision.internalObjectId).toBe("co-2");
  });

  it("returns NEW when nothing matches", async () => {
    dbMock.company.findMany.mockResolvedValue([
      { id: "co-3", name: "Unrelated Co", website: "https://unrelated.com" },
    ]);
    const decision = await resolveCompanyIdentity({
      workspaceId: "ws-1",
      sourceType: ImportSourceType.HUBSPOT,
      company: buildCompany({ name: "Brand New Co", domain: "brandnew.io", website: "https://brandnew.io" }),
    });
    expect(decision.status).toBe("CREATE_NEW");
  });
});
