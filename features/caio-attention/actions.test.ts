import { beforeEach, describe, expect, it, vi } from "vitest";

const runCommand = vi.fn();
const revalidatePath = vi.fn();
const viewer = { workspaceId: "w1", actor: { userId: "u1", sameWorkspace: true, active: true, role: "OTHER" as const, canReviewGovernedActions: false } };

vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }));
vi.mock("./page-context", () => ({ getCaioAttentionPageContext: async () => ({ english: false, viewer }) }));
vi.mock("./service", () => ({
  CAIO_ATTENTION_PAGE_SERVICE_BOUND: true,
  getCaioAttentionPageService: () => ({ runCommand, listCases: vi.fn(), loadCase: vi.fn() }),
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
