import { beforeEach, describe, expect, it, vi } from "vitest";

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";

const claimCaioInferenceJob = vi.fn();
const submitCaioInferenceJudgement = vi.fn();

vi.mock("./job-store.service", () => ({
  claimCaioInferenceJob: (...args: unknown[]) => claimCaioInferenceJob(...args),
  submitCaioInferenceJudgement: (...args: unknown[]) => submitCaioInferenceJudgement(...args),
}));

const { createCaioInferenceGatewayPort } = await import("./gateway-port");

const dispatch = { prepare: vi.fn(), claim: vi.fn(), complete: vi.fn() } as never;
const NOW = new Date("2026-09-16T10:00:00.000Z");
const principal = {
  tokenId: "tok_1",
  workspaceId: "ws_anson",
  userRef: "user:worker",
  clientType: "inference_worker",
  deviceRef: "device:mac-studio",
  audience: "inference",
} as never;

function port() {
  return createCaioInferenceGatewayPort({ dispatch, now: () => NOW });
}

describe("CAIO inference gateway port", () => {
  beforeEach(() => {
    claimCaioInferenceJob.mockReset();
    submitCaioInferenceJudgement.mockReset();
  });

  it("认领时工作区取自主体，请求体里没有这个字段可写", async () => {
    claimCaioInferenceJob.mockResolvedValue({ status: "none" });
    await port().claim({ principal, requestId: "req_1", payload: { workspaceId: "ws_someone_else" } });
    expect(claimCaioInferenceJob).toHaveBeenCalledWith({
      workspaceId: "ws_anson",
      dispatch,
      now: NOW,
    });
  });

  it("认领到作业时，租约以 ISO 文本上线，输入原样带出", async () => {
    const input = { schemaVersion: "helm.caio.inference-input.v1", workspaceId: "ws_anson" };
    claimCaioInferenceJob.mockResolvedValue({
      status: "claimed",
      jobId: "job_1",
      claimToken: "ct_1",
      inputHash: "sha256:abc",
      input,
      leaseExpiresAt: new Date("2026-09-16T10:05:00.000Z"),
    });
    const result = await port().claim({ principal, requestId: "req_1", payload: {} });
    expect(result).toEqual({
      status: "claimed",
      jobId: "job_1",
      claimToken: "ct_1",
      inputHash: "sha256:abc",
      leaseExpiresAt: "2026-09-16T10:05:00.000Z",
      input,
    });
  });

  it("队列拒绝时把闭集原因码原样交给 worker", async () => {
    claimCaioInferenceJob.mockResolvedValue({ status: "rejected", jobId: "job_2", code: "dispatch_refused" });
    await expect(port().claim({ principal, requestId: "req_1", payload: {} })).resolves.toEqual({
      status: "rejected",
      jobId: "job_2",
      code: "dispatch_refused",
    });
  });

  it("提交要求三个标识符齐备，缺一即 bad_request", async () => {
    const complete = { jobId: "job_1", claimToken: "ct_1", inputHash: "sha256:abc", output: { any: "thing" } };
    for (const key of ["jobId", "claimToken", "inputHash"] as const) {
      const payload = { ...complete, [key]: undefined };
      await expect(port().submit({ principal, requestId: "req_1", payload })).rejects.toBeInstanceOf(
        CaioAccessGatewayError,
      );
    }
    for (const payload of [null, "text", ["array"], 42]) {
      await expect(port().submit({ principal, requestId: "req_1", payload })).rejects.toBeInstanceOf(
        CaioAccessGatewayError,
      );
    }
    expect(submitCaioInferenceJudgement).not.toHaveBeenCalled();
  });

  it("output 原样透传，不在这里改形状", async () => {
    submitCaioInferenceJudgement.mockResolvedValue({ status: "completed", judgementHash: "sha256:def" });
    const output = { layers: [{ kind: "observation" }], trailing: null };
    const result = await port().submit({
      principal,
      requestId: "req_1",
      payload: { jobId: "job_1", claimToken: "ct_1", inputHash: "sha256:abc", output },
    });
    expect(submitCaioInferenceJudgement).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws_anson", output, now: NOW }),
    );
    expect(result).toEqual({ status: "completed", judgementHash: "sha256:def" });
  });

  it("重复提交按 replayed 回同一个判断哈希", async () => {
    submitCaioInferenceJudgement.mockResolvedValue({ status: "replayed", judgementHash: "sha256:def" });
    await expect(
      port().submit({
        principal,
        requestId: "req_1",
        payload: { jobId: "job_1", claimToken: "ct_1", inputHash: "sha256:abc", output: {} },
      }),
    ).resolves.toEqual({ status: "replayed", judgementHash: "sha256:def" });
  });

  it("提交被拒时只回原因码，不回判断哈希", async () => {
    submitCaioInferenceJudgement.mockResolvedValue({ status: "rejected", code: "lease_expired" });
    const result = await port().submit({
      principal,
      requestId: "req_1",
      payload: { jobId: "job_1", claimToken: "ct_1", inputHash: "sha256:abc", output: {} },
    });
    expect(result).toEqual({ status: "rejected", code: "lease_expired" });
    expect(result).not.toHaveProperty("judgementHash");
  });

  it("过长的标识符照样拒绝，不带进查询", async () => {
    await expect(
      port().submit({
        principal,
        requestId: "req_1",
        payload: { jobId: "j".repeat(201), claimToken: "ct_1", inputHash: "sha256:abc", output: {} },
      }),
    ).rejects.toBeInstanceOf(CaioAccessGatewayError);
    expect(submitCaioInferenceJudgement).not.toHaveBeenCalled();
  });
});
