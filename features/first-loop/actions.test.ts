import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, auditMock, cacheMock } = vi.hoisted(() => ({
  sessionMock: {
    getCurrentWorkspaceSession: vi.fn(),
  },
  auditMock: {
    writeAuditLog: vi.fn(),
  },
  cacheMock: {
    revalidatePath: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

vi.mock("next/cache", () => ({
  revalidatePath: cacheMock.revalidatePath,
}));

import {
  recordFirstLoopAdoptionEventAction,
  saveFirstLoopReturnAnchorAction,
} from "@/features/first-loop/actions";
import {
  FIRST_LOOP_ANCHOR_RESUMED_ACTION,
  FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
  FIRST_LOOP_RETURN_ANCHOR_ACTION,
  FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
} from "@/lib/operating-system/first-loop";

describe("first-loop actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Owner" },
      membership: { status: "ACTIVE" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    auditMock.writeAuditLog.mockResolvedValue(undefined);
  });

  it("records the setup handoff event with the expected audit action", async () => {
    const result = await recordFirstLoopAdoptionEventAction({
      kind: "setup-handoff-entered",
      href: "/approvals?approvalId=1",
      label: "Review the first draft",
      summary: "Keep the first move inside review.",
      sourcePage: "/dashboard?entry=setup-first-loop",
      sourceArea: "dashboard-handoff",
      stepId: "review",
    });

    expect(result).toEqual({ ok: true });
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        actionType: FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
        sourcePage: "/dashboard?entry=setup-first-loop",
        relatedObjectId: "/approvals?approvalId=1",
      }),
    );
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/diagnostics");
  });

  it("records primary-action and anchor-resume events without widening authority", async () => {
    await recordFirstLoopAdoptionEventAction({
      kind: "primary-action-opened",
      href: "/approvals?approvalId=1",
      label: "Review the first draft",
      summary: "Keep the first move inside review.",
      sourcePage: "/dashboard",
      sourceArea: "first-loop-summary",
      stepId: "review",
    });

    await recordFirstLoopAdoptionEventAction({
      kind: "anchor-resumed",
      href: "/approvals?approvalId=1",
      label: "Resume saved review block",
      summary: "Open the saved return anchor before scanning the workspace.",
      sourcePage: "/dashboard",
      sourceArea: "first-loop-summary",
      stepId: "anchor",
    });

    expect(auditMock.writeAuditLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        actionType: FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        actionType: FIRST_LOOP_ANCHOR_RESUMED_ACTION,
      }),
    );
  });

  it("keeps the existing anchor-save audit contract intact", async () => {
    const result = await saveFirstLoopReturnAnchorAction({
      href: "/approvals?approvalId=1",
      label: "Return to the review block",
      summary: "Come back here instead of rescanning the workspace.",
      sourcePage: "/dashboard",
    });

    expect(result).toEqual({ ok: true });
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: FIRST_LOOP_RETURN_ANCHOR_ACTION,
        relatedObjectId: "/approvals?approvalId=1",
      }),
    );
  });
});
