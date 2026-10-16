import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    contact: { findMany: vi.fn() },
    company: { findMany: vi.fn() },
    opportunity: { findMany: vi.fn() },
    meeting: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  RECENT_SEARCH_OBJECTS_PER_TYPE,
  loadRecentSearchObjects,
} from "@/features/search/queries";

describe("recent search objects for an empty query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.contact.findMany.mockResolvedValue([{ id: "contact-1" }]);
    dbMock.company.findMany.mockResolvedValue([{ id: "company-1" }]);
    dbMock.opportunity.findMany.mockResolvedValue([]);
    dbMock.meeting.findMany.mockResolvedValue([{ id: "meeting-1" }]);
  });

  it("returns the search result shape from real, workspace-scoped and bounded queries", async () => {
    const result = await loadRecentSearchObjects("workspace-1");

    expect(result).toEqual({
      contacts: [{ id: "contact-1" }],
      companies: [{ id: "company-1" }],
      opportunities: [],
      meetings: [{ id: "meeting-1" }],
    });
    expect(dbMock.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "workspace-1", archivedAt: null },
        take: RECENT_SEARCH_OBJECTS_PER_TYPE,
        orderBy: { updatedAt: "desc" },
      }),
    );
    for (const model of [dbMock.company, dbMock.opportunity, dbMock.meeting]) {
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: "workspace-1" },
          take: RECENT_SEARCH_OBJECTS_PER_TYPE,
          orderBy: { updatedAt: "desc" },
        }),
      );
    }
    expect(RECENT_SEARCH_OBJECTS_PER_TYPE).toBeLessThanOrEqual(10);
  });
});
