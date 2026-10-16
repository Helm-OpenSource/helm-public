import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, governedActionMock } = vi.hoisted(() => ({
  dbMock: { contact: { findFirst: vi.fn() } },
  governedActionMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: vi.fn(async () => ({ id: "user_1", name: "Owner One" })),
  getCurrentWorkspace: vi.fn(async () => ({ id: "ws_1", defaultLocale: "zh-CN" })),
  getCurrentWorkspaceSession: vi.fn(),
}));
vi.mock("@/lib/policies/engine", () => ({ createGovernedAction: governedActionMock }));

import { createMeetingForContactAction } from "@/features/contacts/actions";

const contactWithTwoOpportunities = {
  id: "contact_1",
  workspaceId: "ws_1",
  name: "Alex Doe",
  ownerId: null,
  opportunities: [
    { id: "opp_first", title: "First deal" },
    { id: "opp_current", title: "Deal being handled" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.contact.findFirst.mockResolvedValue(contactWithTwoOpportunities);
  governedActionMock.mockResolvedValue({
    actionItemId: "action_1",
    status: "PENDING_APPROVAL",
    requiresApproval: true,
    reason: "",
  });
});

describe("createMeetingForContactAction", () => {
  it("attaches the meeting to the opportunity being handled, not the contact's first one", async () => {
    const result = await createMeetingForContactAction("contact_1", "opp_current");

    expect(result.ok).toBe(true);
    expect(dbMock.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "contact_1", workspaceId: "ws_1" } }),
    );
    expect(governedActionMock).toHaveBeenCalledTimes(1);
    expect(governedActionMock.mock.calls[0][0]).toMatchObject({
      actionType: "CREATE_MEETING",
      contactId: "contact_1",
      opportunityId: "opp_current",
    });
  });

  it("refuses an opportunity that is not linked to the contact", async () => {
    const result = await createMeetingForContactAction("contact_1", "opp_elsewhere");

    expect(result.ok).toBe(false);
    expect(governedActionMock).not.toHaveBeenCalled();
  });

  it("keeps the previous behaviour when no opportunity is given", async () => {
    await createMeetingForContactAction("contact_1");

    expect(governedActionMock.mock.calls[0][0]).toMatchObject({ opportunityId: "opp_first" });
  });
});
