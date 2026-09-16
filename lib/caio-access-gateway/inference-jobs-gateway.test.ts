import { describe, expect, it, vi } from "vitest";

import { DEFAULT_WORKBUDDY_FEATURE_FLAGS } from "@/lib/caio-collaboration/feature-flags";

import {
  createCaioGatewayHandler,
  type CaioGatewayHandlerDependencies,
} from "./gateway-http-core";

function harness(input?: {
  audience?: "inference" | "mcp" | "model";
  clientType?: "inference_worker" | "workbuddy";
  inferenceJobsEnabled?: boolean;
}) {
  const calls: string[] = [];
  const claim = vi.fn(async () => ({ status: "claimed", jobId: "job-1" }));
  const submit = vi.fn(async () => ({ status: "completed" }));
  let observedRateLimit: number | undefined;
  const dependencies = {
    preAuthRateLimiter: {
      claimSourceIpSlot: async () => {
        calls.push("rate-limit");
        return { allowed: true as const };
      },
    },
    tokenAuthenticator: {
      authenticate: async ({
        expectedAudience,
        rateLimitPerMinute,
      }: {
        expectedAudience: string;
        rateLimitPerMinute?: number;
      }) => {
        calls.push("authenticate");
        observedRateLimit = rateLimitPerMinute;
        return {
          tokenId: "token-1",
          workspaceId: "workspace-1",
          userRef: "user:inference-worker",
          clientType: input?.clientType ?? "inference_worker",
          deviceRef: "device:on-premises-1",
          audience: input?.audience ?? expectedAudience,
        };
      },
    },
    operationResolver: { hasWorkspaceOperationCapability: async () => true },
    projectResolver: {
      listAccessibleProjectRefs: async () => {
        calls.push("project-access");
        return [];
      },
    },
    privateExecutionResultIngress: async () => ({ kind: "recorded" as const }),
    operatingQuestionGeneration: async () => ({}),
    mcpDispatch: async () => ({ ok: true }),
    modelProxy: {
      responses: async () => ({ claim: "allowed" as const, auditReceiptId: "audit:1", body: {} }),
      chatCompletions: async () => ({ claim: "allowed" as const, auditReceiptId: "audit:2", body: {} }),
      listModels: async () => ({ data: [] }),
    },
    inferenceJobs: {
      claim: async (request: unknown) => {
        calls.push("inference-claim");
        return claim(request as never);
      },
      submit: async (request: unknown) => {
        calls.push("inference-submit");
        return submit(request as never);
      },
    },
    auditGate: {
      posture: "self_service" as const,
      claimDispatch: async () => {
        calls.push("audit");
        return {
          status: "allowed" as const,
          receiptId: "audit:inference-1",
          persistedVia: "primary" as const,
          dispatchAttempt: 1,
        };
      },
    },
    readinessProbe: { getReadiness: async () => "ready" as const },
    featureFlags: {
      ...DEFAULT_WORKBUDDY_FEATURE_FLAGS,
      gatewayEnabled: true,
      inferenceJobsEnabled: input?.inferenceJobsEnabled ?? true,
    },
    now: () => new Date("2026-09-16T04:00:00.000Z"),
    requestIdFactory: () => "request-1",
  } as unknown as CaioGatewayHandlerDependencies;
  return {
    calls,
    claim,
    submit,
    rateLimit: () => observedRateLimit,
    handler: createCaioGatewayHandler(dependencies),
  };
}

function request(path: string, body: unknown = { workerRef: "worker-1" }) {
  return {
    method: "POST",
    path,
    headers: { authorization: "Bearer hcaio_inf_token", "x-request-id": "client-1" },
    clientIp: "203.0.113.10",
    body: typeof body === "string" ? body : JSON.stringify(body),
  } as const;
}

describe("pull inference gateway routes", () => {
  it("forwards a worker claim and a worker submission without claiming an audit slot", async () => {
    const test = harness();

    await expect(test.handler(request("/v1/inference-jobs/claim"))).resolves.toMatchObject({
      status: 200,
      body: { status: "claimed", jobId: "job-1" },
    });
    await expect(
      test.handler(request("/v1/inference-jobs/submit", { jobId: "job-1", output: {} })),
    ).resolves.toMatchObject({ status: 200, body: { status: "completed" } });

    // The egress receipt is written by the governed dispatch behind the port, so this layer claims no slot,
    // and the worker surface resolves no project scope.
    expect(test.calls).toEqual([
      "rate-limit",
      "authenticate",
      "inference-claim",
      "rate-limit",
      "authenticate",
      "inference-submit",
    ]);
    expect(test.claim).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: expect.objectContaining({ audience: "inference", clientType: "inference_worker" }),
        requestId: "workspace-1:request-1",
      }),
    );
  });

  it("keeps the surface closed while the inference flag is off", async () => {
    const test = harness({ inferenceJobsEnabled: false });

    await expect(test.handler(request("/v1/inference-jobs/claim"))).resolves.toMatchObject({
      status: 403,
      body: { reason: "scope_violation" },
    });
    expect(test.calls).toEqual(["rate-limit", "authenticate"]);
    expect(test.claim).not.toHaveBeenCalled();
  });

  it("refuses a principal that is not an inference worker", async () => {
    for (const drift of [
      { audience: "mcp" as const },
      { clientType: "workbuddy" as const },
    ]) {
      const test = harness(drift);
      await expect(test.handler(request("/v1/inference-jobs/submit"))).resolves.toMatchObject({
        status: 403,
        body: { reason: "scope_violation" },
      });
      expect(test.submit).not.toHaveBeenCalled();
    }
  });

  it("bounds the worker surface with its own body cap and rate limit", async () => {
    const test = harness();
    const oversized = JSON.stringify({ output: "x".repeat(256 * 1024) });

    await expect(test.handler(request("/v1/inference-jobs/submit", oversized))).resolves.toMatchObject({
      status: 413,
    });
    expect(test.submit).not.toHaveBeenCalled();

    await test.handler(request("/v1/inference-jobs/claim"));
    expect(test.rateLimit()).toBe(30);
  });

  it("refuses a body that is not JSON before the port is reached", async () => {
    const test = harness();
    await expect(test.handler(request("/v1/inference-jobs/claim", "not-json"))).resolves.toMatchObject({
      status: 400,
    });
    expect(test.claim).not.toHaveBeenCalled();
  });
});
