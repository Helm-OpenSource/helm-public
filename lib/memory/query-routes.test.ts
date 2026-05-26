import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStatus } from "@prisma/client";

const {
  sessionMock,
  ownershipMock,
  analyticsMock,
  memoryFactServiceMock,
  permissionsMock,
  dbMock,
} = vi.hoisted(() => ({
  sessionMock: {
    requireCurrentUser: vi.fn(),
    getCurrentWorkspace: vi.fn(),
    getCurrentWorkspaceSession: vi.fn(),
  },
  ownershipMock: {
    assertWorkspaceObjectOwnership: vi.fn(),
    isWorkspaceOwnershipError: vi.fn(),
  },
  analyticsMock: {
    logEvent: vi.fn(),
  },
  memoryFactServiceMock: {
    createMemoryFact: vi.fn(),
    getMemoryFacts: vi.fn(),
  },
  permissionsMock: {
    canManageWorkspaceMemory: vi.fn(),
    getMemoryManagementDeniedMessage: vi.fn(),
  },
  dbMock: {
    memoryFact: { findMany: vi.fn() },
    commitment: { findMany: vi.fn() },
    blocker: { findMany: vi.fn() },
    memoryCorrection: { findMany: vi.fn() },
    memoryEntry: { findMany: vi.fn() },
    meeting: { findMany: vi.fn() },
    actionItem: { findMany: vi.fn() },
    approvalTask: { findMany: vi.fn() },
    emailThread: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: sessionMock.requireCurrentUser,
  getCurrentWorkspace: sessionMock.getCurrentWorkspace,
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceObjectOwnership: ownershipMock.assertWorkspaceObjectOwnership,
  isWorkspaceOwnershipError: ownershipMock.isWorkspaceOwnershipError,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: analyticsMock.logEvent,
}));

vi.mock("@/lib/memory/memory-fact.service", () => ({
  createMemoryFact: memoryFactServiceMock.createMemoryFact,
  getMemoryFacts: memoryFactServiceMock.getMemoryFacts,
}));

vi.mock("@/lib/memory/permissions", () => ({
  canManageWorkspaceMemory: permissionsMock.canManageWorkspaceMemory,
  getMemoryManagementDeniedMessage: permissionsMock.getMemoryManagementDeniedMessage,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import { GET as getMemoryFactsRoute } from "@/app/api/memory/facts/route";
import { GET as getMemoryTimelineRoute } from "@/app/api/memory/timeline/route";

function buildFact(index: number) {
  return {
    id: `fact-${String(index).padStart(3, "0")}`,
    objectType: "CONTACT",
    objectId: "contact-1",
    factType: "SUMMARY",
    title: `Fact ${index}`,
    content: `Fact content ${index}`,
    sourceType: "MEETING_NOTE",
    sourceId: `meeting-${index}`,
    status: MemoryStatus.ACTIVE,
    importance: 100 - index,
    createdAt: new Date(Date.UTC(2026, 3, 20, 8, 0, index)),
    updatedAt: new Date(Date.UTC(2026, 3, 20, 8, 0, index)),
  };
}

describe("memory query routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.requireCurrentUser.mockResolvedValue({ id: "user-1", name: "Owner" });
    sessionMock.getCurrentWorkspace.mockResolvedValue({ id: "workspace-1", defaultLocale: "zh-CN" });
    ownershipMock.assertWorkspaceObjectOwnership.mockResolvedValue(undefined);
    ownershipMock.isWorkspaceOwnershipError.mockReturnValue(false);
    analyticsMock.logEvent.mockResolvedValue(undefined);
    memoryFactServiceMock.getMemoryFacts.mockResolvedValue([]);

    dbMock.memoryFact.findMany.mockResolvedValue([]);
    dbMock.commitment.findMany.mockResolvedValue([]);
    dbMock.blocker.findMany.mockResolvedValue([]);
    dbMock.memoryCorrection.findMany.mockResolvedValue([]);
    dbMock.memoryEntry.findMany.mockResolvedValue([]);
    dbMock.meeting.findMany.mockResolvedValue([]);
    dbMock.actionItem.findMany.mockResolvedValue([]);
    dbMock.approvalTask.findMany.mockResolvedValue([]);
    dbMock.emailThread.findMany.mockResolvedValue([]);
  });

  it("bounds memory facts limit and returns pageInfo with a next cursor", async () => {
    memoryFactServiceMock.getMemoryFacts.mockResolvedValue(
      Array.from({ length: 101 }, (_, index) => buildFact(index)),
    );

    const response = await getMemoryFactsRoute(
      new Request("http://localhost/api/memory/facts?objectType=CONTACT&objectId=contact-1&limit=500"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(memoryFactServiceMock.getMemoryFacts).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        objectType: "CONTACT",
        objectId: "contact-1",
        limit: 101,
      }),
    );
    expect(body.data.items).toHaveLength(100);
    expect(body.data.pageInfo).toMatchObject({
      limit: 100,
      maxLimit: 100,
      hasNextPage: true,
      bounded: true,
    });
    expect(body.data.pageInfo.nextCursor).toEqual(expect.any(String));
  });

  it("rejects malformed memory facts cursors before querying", async () => {
    const response = await getMemoryFactsRoute(
      new Request("http://localhost/api/memory/facts?objectType=CONTACT&objectId=contact-1&cursor=bad"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      errorCode: "INVALID_CURSOR",
    });
    expect(memoryFactServiceMock.getMemoryFacts).not.toHaveBeenCalled();
  });

  it("bounds memory timeline results and returns pageInfo", async () => {
    dbMock.memoryFact.findMany.mockResolvedValue([
      {
        id: "fact-3",
        title: "Fact 3",
        createdAt: new Date("2026-04-20T10:00:00.000Z"),
        status: "ACTIVE",
        sourceType: "MEETING_NOTE",
      },
      {
        id: "fact-2",
        title: "Fact 2",
        createdAt: new Date("2026-04-20T09:00:00.000Z"),
        status: "ACTIVE",
        sourceType: "MEETING_NOTE",
      },
      {
        id: "fact-1",
        title: "Fact 1",
        createdAt: new Date("2026-04-20T08:00:00.000Z"),
        status: "ACTIVE",
        sourceType: "MEETING_NOTE",
      },
    ]);

    const response = await getMemoryTimelineRoute(
      new Request("http://localhost/api/memory/timeline?source=HELM&objectLevel=WORKSPACE&limit=2"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(dbMock.memoryFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items.map((item: { id: string }) => item.id)).toEqual(["fact-3", "fact-2"]);
    expect(body.data.pageInfo).toMatchObject({
      limit: 2,
      maxLimit: 100,
      hasNextPage: true,
      bounded: false,
    });
    expect(body.data.pageInfo.nextCursor).toEqual(expect.any(String));
  });

  it("excludes legacy OpenClaw entries from default ALL timeline queries", async () => {
    const response = await getMemoryTimelineRoute(
      new Request("http://localhost/api/memory/timeline?objectLevel=WORKSPACE"),
    );

    expect(response.status).toBe(200);
    expect(dbMock.memoryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          deletedAt: null,
          NOT: { source: { startsWith: "OPENCLAW:" } },
        }),
      }),
    );
  });
});
