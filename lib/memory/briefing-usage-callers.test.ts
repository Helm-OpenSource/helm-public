import { ObjectType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), record: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: async () => ({ id: "actor-1", name: "Synthetic" }),
  getCurrentWorkspace: async () => ({ id: "workspace-1", defaultLocale: "en-US" }),
  getCurrentWorkspaceSession: async () => ({ user: { id: "actor-1", name: "Synthetic" },
    membership: { role: "OWNER" }, workspace: { id: "workspace-1", defaultLocale: "en-US" } }),
}));
vi.mock("@/lib/billing/foundation", () => ({ ensureWorkspaceProcessingAllowed: async () => {}, recordUsageLedgerEntry: mocks.record }));
vi.mock("@/lib/auth/tenant-ownership", async original => ({ ...await original<typeof import("@/lib/auth/tenant-ownership")>(),
  assertWorkspaceMeetingOwnership: async () => {} }));
vi.mock("@/lib/memory/briefing.service", () => ({ generateMeetingBriefingSnapshot: mocks.generate,
  generateContactBriefingSnapshot: mocks.generate, generateCompanyBriefingSnapshot: mocks.generate, generateOpportunityBriefingSnapshot: mocks.generate }));
import { generateMeetingBriefingAction, generateObjectBriefingAction } from "@/features/memory/actions";
import { POST } from "@/app/api/briefings/meeting/[meetingId]/route";
beforeEach(() => { vi.clearAllMocks(); });
describe("briefing callers preserve legacy and suppress keyed double observations", () => {
  it.each([true, false])("all existing observation callers honor service receipt=%s", async observed => {
    mocks.generate.mockResolvedValue({ snapshot: { id: "snapshot-1" }, payload: { summary: "Synthetic" },
      usageReceipt: observed ? { entryId: "usage-1" } : null });
    await generateMeetingBriefingAction("meeting-1");
    for (const type of [ObjectType.CONTACT, ObjectType.COMPANY, ObjectType.OPPORTUNITY]) {
      await generateObjectBriefingAction(type, "object-1");
    }
    const response = await POST(new Request("http://synthetic.invalid/api/briefings", { method: "POST", body: JSON.stringify({ usageReceipt: { entryId: "untrusted" } }) }),
      { params: Promise.resolve({ meetingId: "meeting-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.record).toHaveBeenCalledTimes(observed ? 0 : 5);
    expect(mocks.generate).not.toHaveBeenCalledWith(expect.objectContaining({ usageReceipt: expect.anything() }));
  });
});
