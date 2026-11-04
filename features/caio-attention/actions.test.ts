import { beforeEach, describe, expect, it, vi } from "vitest";

const runCommand = vi.fn();
const listCases = vi.fn();
const revalidatePath = vi.fn();
const bound = vi.hoisted(() => ({ value: true }));
const viewer = { workspaceId: "w1", actor: { userId: "u1", sameWorkspace: true, active: true, role: "OTHER" as const, canReviewGovernedActions: false } };

vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }));
vi.mock("./page-context", () => ({ getCaioAttentionPageContext: async () => ({ english: false, viewer }) }));
vi.mock("./service", () => ({
  get CAIO_ATTENTION_PAGE_SERVICE_BOUND() { return bound.value; },
  getCaioAttentionPageService: () => ({ runCommand, listCases, loadCase: vi.fn() }),
}));

const form = (entries: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) for (const item of [value].flat()) data.append(name, item);
  return data;
};
const identity = { caseId: "c1", expectedCommandVersion: "4", clientRequestId: "0b0a6f7e-1c2d-4e5f-8a9b-0c1d2e3f4a5b" };

describe("runCaioAttentionCommandAction", () => {
  beforeEach(() => { runCommand.mockReset(); revalidatePath.mockReset(); });

  it("refuses a malformed form without calling the service", async () => {
    const { runCaioAttentionCommandAction } = await import("./actions");
    await expect(runCaioAttentionCommandAction({ status: "idle" }, form({ ...identity, op: "cancel" }))).resolves.toEqual({ status: "error", reason: "validation_failed" });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("passes the session viewer, never a form-supplied one, and refreshes the pages on success", async () => {
    const { runCaioAttentionCommandAction } = await import("./actions");
    runCommand.mockResolvedValue({ ok: true, status: "CANCELLED" });
    const state = await runCaioAttentionCommandAction({ status: "idle" }, form({ ...identity, op: "cancel", reason: "handled elsewhere", viewer: "u9" }));
    expect(state).toEqual({ status: "ok" });
    expect(runCommand).toHaveBeenCalledWith({ ...identity, expectedCommandVersion: 4, op: "cancel", reason: "handled elsewhere", viewer });
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/caio/attention", "/caio/attention/mine", "/caio/attention/c1"]);
  });

  it("returns the service refusal and changes nothing on screen", async () => {
    const { runCaioAttentionCommandAction } = await import("./actions");
    runCommand.mockResolvedValue({ ok: false, reason: "forbidden" });
    await expect(runCaioAttentionCommandAction({ status: "idle" }, form({ ...identity, op: "ack" }))).resolves.toEqual({ status: "error", reason: "forbidden" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

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
    listCases.mockRejectedValueOnce(new Error("loader down"));
    await expect(resolveCaioAttentionNavigation(viewer)).resolves.toBe(false);
  });
});
