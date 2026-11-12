import { beforeEach, describe, expect, it, vi } from "vitest";

const listCases = vi.fn();
const bound = vi.hoisted(() => ({ value: true }));
const viewer = { workspaceId: "w1", actor: { userId: "u1", sameWorkspace: true, active: true, role: "OTHER" as const, canReviewGovernedActions: false } };

vi.mock("./service", () => ({
  get CAIO_ATTENTION_PAGE_SERVICE_BOUND() { return bound.value; },
  isCaioAttentionPageServiceAvailable: () => bound.value,
  getCaioAttentionPageService: () => ({ listCases, loadCase: vi.fn(), runCommand: vi.fn() }),
}));

describe("attention navigation entry", () => {
  beforeEach(() => { listCases.mockReset(); bound.value = true; });

  it("is hidden while the service is unbound or the member is inactive", async () => {
    const { resolveCaioAttentionNavigation, shouldShowCaioAttentionNavigation } = await import("./navigation");
    bound.value = false;
    await expect(resolveCaioAttentionNavigation({ ...viewer, actor: { ...viewer.actor, role: "OWNER" } })).resolves.toBe(false);
    expect(shouldShowCaioAttentionNavigation({ bound: true, actor: { active: false, role: "OWNER" }, participantCaseCount: 3 })).toBe(false);
    expect(listCases).not.toHaveBeenCalled();
  });

  it("shows for OWNER and ADMIN, and for others only with a current case of their own", async () => {
    const { resolveCaioAttentionNavigation } = await import("./navigation");
    await expect(resolveCaioAttentionNavigation({ ...viewer, actor: { ...viewer.actor, role: "ADMIN" } })).resolves.toBe(true);
    expect(listCases).not.toHaveBeenCalled();
    listCases.mockResolvedValueOnce({ items: [], page: 1, pageSize: 1, total: 0 });
    await expect(resolveCaioAttentionNavigation(viewer)).resolves.toBe(false);
    listCases.mockResolvedValueOnce({ items: [], page: 1, pageSize: 1, total: 1 });
    await expect(resolveCaioAttentionNavigation(viewer)).resolves.toBe(true);
    expect(listCases).toHaveBeenLastCalledWith({ viewer, scope: "mine", page: 1, pageSize: 1 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    listCases.mockRejectedValueOnce(new Error("loader down"));
    await expect(resolveCaioAttentionNavigation(viewer)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith("caio-attention navigation: participant lookup failed", "Error");
    warn.mockRestore();
  });
});
