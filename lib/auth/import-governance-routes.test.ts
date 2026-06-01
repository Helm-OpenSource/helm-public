import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sessionMock,
  importGovernanceMock,
  ownershipMock,
  billingMock,
  crmEntryServiceMock,
  crmOrchestratorMock,
  cacheMock,
} = vi.hoisted(() => ({
  sessionMock: {
    getCurrentWorkspaceSession: vi.fn(),
  },
  importGovernanceMock: {
    canManageWorkspaceImports: vi.fn(),
    canResolveWorkspaceImportConflicts: vi.fn(),
    getImportManagementDeniedMessage: vi.fn(),
    getImportConflictResolutionDeniedMessage: vi.fn(),
  },
  ownershipMock: {
    assertWorkspaceImportSourceOwnership: vi.fn(),
    assertWorkspaceImportJobOwnership: vi.fn(),
    assertWorkspaceImportConflictOwnership: vi.fn(),
    isWorkspaceOwnershipError: vi.fn(),
  },
  billingMock: {
    ensureWorkspaceProcessingAllowed: vi.fn(),
    recordUsageLedgerEntry: vi.fn(),
  },
  crmEntryServiceMock: {
    previewCrmImportSource: vi.fn(),
    runCrmImportSource: vi.fn(),
    rerunImportWarmup: vi.fn(),
  },
  crmOrchestratorMock: {
    resolveImportConflict: vi.fn(),
  },
  cacheMock: {
    revalidatePath: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
}));

vi.mock("@/lib/auth/import-governance", () => ({
  canManageWorkspaceImports: importGovernanceMock.canManageWorkspaceImports,
  canResolveWorkspaceImportConflicts:
    importGovernanceMock.canResolveWorkspaceImportConflicts,
  getImportManagementDeniedMessage:
    importGovernanceMock.getImportManagementDeniedMessage,
  getImportConflictResolutionDeniedMessage:
    importGovernanceMock.getImportConflictResolutionDeniedMessage,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceImportSourceOwnership: ownershipMock.assertWorkspaceImportSourceOwnership,
  assertWorkspaceImportJobOwnership: ownershipMock.assertWorkspaceImportJobOwnership,
  assertWorkspaceImportConflictOwnership: ownershipMock.assertWorkspaceImportConflictOwnership,
  isWorkspaceOwnershipError: ownershipMock.isWorkspaceOwnershipError,
}));

vi.mock("@/lib/billing/foundation", () => ({
  ensureWorkspaceProcessingAllowed: billingMock.ensureWorkspaceProcessingAllowed,
  recordUsageLedgerEntry: billingMock.recordUsageLedgerEntry,
}));

vi.mock("@/lib/imports/crm-entry.service", () => ({
  previewCrmImportSource: crmEntryServiceMock.previewCrmImportSource,
  runCrmImportSource: crmEntryServiceMock.runCrmImportSource,
  rerunImportWarmup: crmEntryServiceMock.rerunImportWarmup,
}));

vi.mock("@/lib/imports/crm-orchestrator.service", () => ({
  resolveImportConflict: crmOrchestratorMock.resolveImportConflict,
}));

vi.mock("next/cache", () => ({
  revalidatePath: cacheMock.revalidatePath,
}));

import { POST as previewCrmImportRoute } from "@/app/api/imports/crm/preview/route";
import { POST as runCrmImportRoute } from "@/app/api/imports/crm/run/route";
import { POST as syncCrmImportRoute } from "@/app/api/imports/crm/sync/route";
import { POST as warmupImportJobRoute } from "@/app/api/imports/jobs/[jobId]/warmup/route";
import { POST as resolveImportConflictRoute } from "@/app/api/imports/conflicts/[id]/resolve/route";

describe("import governance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Owner" },
      membership: { role: "MEMBER" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    importGovernanceMock.canManageWorkspaceImports.mockReturnValue(false);
    importGovernanceMock.canResolveWorkspaceImportConflicts.mockReturnValue(false);
    importGovernanceMock.getImportManagementDeniedMessage.mockReturnValue("import denied");
    importGovernanceMock.getImportConflictResolutionDeniedMessage.mockReturnValue(
      "conflict denied",
    );
    ownershipMock.assertWorkspaceImportSourceOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceImportJobOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceImportConflictOwnership.mockResolvedValue(undefined);
    ownershipMock.isWorkspaceOwnershipError.mockImplementation(
      (error: unknown) => error instanceof Error && error.message === "import source not found in active workspace",
    );
    billingMock.ensureWorkspaceProcessingAllowed.mockResolvedValue(undefined);
    billingMock.recordUsageLedgerEntry.mockResolvedValue(undefined);
  });

  it("rejects import write routes without workspace import capability", async () => {
    const responses = await Promise.all([
      previewCrmImportRoute(
        new Request("http://localhost/api/imports/crm/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId: "source-1" }),
        }),
      ),
      runCrmImportRoute(
        new Request("http://localhost/api/imports/crm/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId: "source-1" }),
        }),
      ),
      syncCrmImportRoute(
        new Request("http://localhost/api/imports/crm/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId: "source-1" }),
        }),
      ),
      warmupImportJobRoute(
        new Request("http://localhost/api/imports/jobs/job-1/warmup", {
          method: "POST",
        }),
        { params: Promise.resolve({ jobId: "job-1" }) },
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: "import denied",
      });
    }

    expect(billingMock.ensureWorkspaceProcessingAllowed).not.toHaveBeenCalled();
    expect(billingMock.recordUsageLedgerEntry).not.toHaveBeenCalled();
    expect(crmEntryServiceMock.previewCrmImportSource).not.toHaveBeenCalled();
    expect(crmEntryServiceMock.runCrmImportSource).not.toHaveBeenCalled();
    expect(crmEntryServiceMock.rerunImportWarmup).not.toHaveBeenCalled();
  });

  it("rejects conflict resolution without conflict capability", async () => {
    const response = await resolveImportConflictRoute(
      new Request("http://localhost/api/imports/conflicts/match-1/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolution: "LINK" }),
      }),
      { params: Promise.resolve({ id: "match-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "conflict denied",
    });
    expect(crmOrchestratorMock.resolveImportConflict).not.toHaveBeenCalled();
  });

  it("returns 404 when the import source is outside the active workspace", async () => {
    importGovernanceMock.canManageWorkspaceImports.mockReturnValue(true);
    ownershipMock.assertWorkspaceImportSourceOwnership.mockRejectedValue(
      new Error("import source not found in active workspace"),
    );

    const response = await previewCrmImportRoute(
      new Request("http://localhost/api/imports/crm/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: "source-1" }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "import source not found in active workspace",
    });
    expect(crmEntryServiceMock.previewCrmImportSource).not.toHaveBeenCalled();
  });

  it("allows import write routes once workspace import capability is present", async () => {
    importGovernanceMock.canManageWorkspaceImports.mockReturnValue(true);
    crmEntryServiceMock.previewCrmImportSource.mockResolvedValue({
      accountLabel: "CRM",
      objectCounts: { contacts: 1 },
      usedMock: false,
    });
    crmEntryServiceMock.runCrmImportSource
      .mockResolvedValueOnce({ jobId: "job-run" })
      .mockResolvedValueOnce({ jobId: "job-sync" });
    crmEntryServiceMock.rerunImportWarmup.mockResolvedValue({ jobId: "job-1" });

    const previewResponse = await previewCrmImportRoute(
      new Request("http://localhost/api/imports/crm/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: "source-1" }),
      }),
    );
    const runResponse = await runCrmImportRoute(
      new Request("http://localhost/api/imports/crm/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: "source-1", incremental: false }),
      }),
    );
    const syncResponse = await syncCrmImportRoute(
      new Request("http://localhost/api/imports/crm/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: "source-1" }),
      }),
    );
    const warmupResponse = await warmupImportJobRoute(
      new Request("http://localhost/api/imports/jobs/job-1/warmup", {
        method: "POST",
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );

    expect(previewResponse.status).toBe(200);
    await expect(previewResponse.json()).resolves.toMatchObject({
      ok: true,
      workspaceId: "workspace-1",
    });
    expect(runResponse.status).toBe(200);
    await expect(runResponse.json()).resolves.toMatchObject({
      ok: true,
      result: { jobId: "job-run" },
    });
    expect(syncResponse.status).toBe(200);
    await expect(syncResponse.json()).resolves.toMatchObject({
      ok: true,
      result: { jobId: "job-sync" },
    });
    expect(warmupResponse.status).toBe(200);
    await expect(warmupResponse.json()).resolves.toMatchObject({
      ok: true,
      result: { jobId: "job-1" },
    });

    expect(billingMock.ensureWorkspaceProcessingAllowed).toHaveBeenCalledTimes(3);
    expect(ownershipMock.assertWorkspaceImportSourceOwnership).toHaveBeenCalledWith("workspace-1", "source-1");
    expect(ownershipMock.assertWorkspaceImportJobOwnership).toHaveBeenCalledWith("workspace-1", "job-1");
    expect(crmEntryServiceMock.previewCrmImportSource).toHaveBeenCalledWith("source-1");
    expect(crmEntryServiceMock.runCrmImportSource).toHaveBeenNthCalledWith(1, {
      sourceId: "source-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      incremental: false,
    });
    expect(crmEntryServiceMock.runCrmImportSource).toHaveBeenNthCalledWith(2, {
      sourceId: "source-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      incremental: true,
    });
    expect(crmEntryServiceMock.rerunImportWarmup).toHaveBeenCalledWith({
      jobId: "job-1",
      workspaceId: "workspace-1",
      userId: "user-1",
    });
    expect(billingMock.recordUsageLedgerEntry).toHaveBeenCalledTimes(3);
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/imports");
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/imports/jobs/job-run");
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/imports/jobs/job-1");
  });

  it("allows conflict resolution once conflict capability is present", async () => {
    importGovernanceMock.canResolveWorkspaceImportConflicts.mockReturnValue(true);
    crmOrchestratorMock.resolveImportConflict.mockResolvedValue({
      resolution: "LINK",
      identityMatchId: "match-1",
    });

    const response = await resolveImportConflictRoute(
      new Request("http://localhost/api/imports/conflicts/match-1/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolution: "LINK" }),
      }),
      { params: Promise.resolve({ id: "match-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        resolution: "LINK",
        identityMatchId: "match-1",
      },
    });
    expect(crmOrchestratorMock.resolveImportConflict).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorName: "Owner",
      english: true,
      identityMatchId: "match-1",
      resolution: "LINK",
    });
    expect(ownershipMock.assertWorkspaceImportConflictOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "match-1",
    );
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/imports/conflicts");
  });
});
