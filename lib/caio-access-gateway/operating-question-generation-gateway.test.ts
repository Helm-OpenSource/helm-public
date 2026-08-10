import { describe, expect, it, vi } from "vitest";

import { DEFAULT_WORKBUDDY_FEATURE_FLAGS } from "@/lib/caio-collaboration/feature-flags";
import { WORKSPACE_CAPABILITIES } from "@/lib/auth/authorization";
import {
  createCaioGatewayHandler,
  type CaioGatewayHandlerDependencies,
} from "./gateway-http-core";

const PORTFOLIO_REF = "opportunity:portfolio-1";

function harness(input?: {
  clientType?: "codex" | "workbuddy";
  mutationsEnabled?: boolean;
  projectRefs?: readonly string[];
  operationAllowed?: boolean;
}) {
  const calls: string[] = [];
  const generation = vi.fn(async () => ({
    receipt: { status: "generated" },
    portfolio: { portfolioId: "question-portfolio:1" },
    replayed: false,
  }));
  const hasWorkspaceOperationCapability = vi.fn(async () => {
    calls.push("operation-access");
    return input?.operationAllowed ?? true;
  });
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
      }: {
        expectedAudience: "mcp" | "model";
      }) => {
        calls.push("authenticate");
        return {
          tokenId: "token-1",
          workspaceId: "workspace-1",
          userRef: "user:owner-1",
          clientType: input?.clientType ?? "workbuddy",
          deviceRef: "device:workbuddy-1",
          audience: expectedAudience,
        };
      },
    },
    projectResolver: {
      listAccessibleProjectRefs: async () => {
        calls.push("project-access");
        return input?.projectRefs ?? [PORTFOLIO_REF];
      },
    },
    operationResolver: {
      hasWorkspaceOperationCapability,
    },
    operatingQuestionGeneration: async (request: unknown) => {
      calls.push("question-generation");
      return generation(request);
    },
    privateExecutionResultIngress: async () => ({ ok: true }),
    mcpDispatch: async () => ({ ok: true }),
    modelProxy: {
      responses: async () => ({
        claim: "allowed" as const,
        auditReceiptId: "audit:model-1",
        body: {},
      }),
      chatCompletions: async () => ({
        claim: "allowed" as const,
        auditReceiptId: "audit:model-2",
        body: {},
      }),
      listModels: async () => ({ data: [] }),
    },
    auditGate: {
      posture: "self_service" as const,
      claimDispatch: async () => {
        calls.push("audit");
        return {
          status: "allowed" as const,
          receiptId: "audit:question-generation-1",
          persistedVia: "primary" as const,
          dispatchAttempt: 1,
        };
      },
    },
    readinessProbe: { getReadiness: async () => "ready" as const },
    featureFlags: {
      ...DEFAULT_WORKBUDDY_FEATURE_FLAGS,
      gatewayEnabled: true,
      mutationsEnabled: input?.mutationsEnabled ?? true,
    },
    now: () => new Date("2026-08-10T00:00:00.000Z"),
    requestIdFactory: () => "request-1",
  } as unknown as CaioGatewayHandlerDependencies;
  return {
    calls,
    generation,
    hasWorkspaceOperationCapability,
    handler: createCaioGatewayHandler(dependencies),
  };
}

function request(body: unknown = {
  portfolioRef: PORTFOLIO_REF,
  generationKey: "generation:operating-question-1",
}) {
  return {
    method: "POST",
    path: "/v1/operating-questions/generate",
    headers: { authorization: "Bearer token", "x-request-id": "client-1" },
    clientIp: "203.0.113.10",
    body: JSON.stringify(body),
  } as const;
}

describe("operating-question production gateway route", () => {
  it("authenticates WorkBuddy, checks current Portfolio access, audits, then calls generation", async () => {
    const test = harness();
    const controller = new AbortController();

    await expect(
      test.handler({ ...request(), signal: controller.signal }),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        receipt: { status: "generated" },
        portfolio: { portfolioId: "question-portfolio:1" },
      },
    });
    expect(test.calls).toEqual([
      "rate-limit",
      "authenticate",
      "project-access",
      "operation-access",
      "audit",
      "question-generation",
    ]);
    expect(test.hasWorkspaceOperationCapability).toHaveBeenCalledWith(
      "workspace-1",
      "user:owner-1",
      WORKSPACE_CAPABILITIES.MANAGE_POLICIES,
      { signal: controller.signal },
    );
    expect(test.generation).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: expect.objectContaining({
          workspaceId: "workspace-1",
          userRef: "user:owner-1",
          clientType: "workbuddy",
        }),
        requestId: "workspace-1:request-1",
        request: {
          portfolioRef: PORTFOLIO_REF,
          generationKey: "generation:operating-question-1",
        },
      }),
    );
  });

  it("keeps generation closed for non-WorkBuddy principals and disabled mutations", async () => {
    const wrongClient = harness({ clientType: "codex" });
    await expect(wrongClient.handler(request())).resolves.toMatchObject({
      status: 403,
    });
    expect(wrongClient.calls).toEqual(["rate-limit", "authenticate"]);
    expect(wrongClient.generation).not.toHaveBeenCalled();

    const disabled = harness({ mutationsEnabled: false });
    await expect(disabled.handler(request())).resolves.toMatchObject({
      status: 403,
    });
    expect(disabled.calls).toEqual(["rate-limit", "authenticate"]);
    expect(disabled.generation).not.toHaveBeenCalled();
  });

  it("rejects revoked Portfolio access before audit or generation", async () => {
    const test = harness({ projectRefs: [] });

    await expect(test.handler(request())).resolves.toMatchObject({ status: 403 });
    expect(test.calls).toEqual([
      "rate-limit",
      "authenticate",
      "project-access",
    ]);
    expect(test.generation).not.toHaveBeenCalled();
  });

  it("rejects revoked policy capability before audit, Pack resolution or generation", async () => {
    const test = harness({ operationAllowed: false });

    await expect(test.handler(request())).resolves.toMatchObject({ status: 403 });
    expect(test.calls).toEqual([
      "rate-limit",
      "authenticate",
      "project-access",
      "operation-access",
    ]);
    expect(test.generation).not.toHaveBeenCalled();
  });

  it.each([
    ["Pack descriptor", { interfaceDescriptor: { contractRef: "untrusted" } }],
    ["questions", { questions: ["client-authored question"] }],
    ["score", { score: 100 }],
    ["trusted evidence kind", { evidenceKind: "source_observation" }],
  ])("rejects request-supplied %s before project access", async (_label, extra) => {
    const test = harness();

    await expect(
      test.handler(request({
        portfolioRef: PORTFOLIO_REF,
        generationKey: "generation:forbidden-input",
        ...extra,
      })),
    ).resolves.toMatchObject({ status: 400 });
    expect(test.calls).toEqual(["rate-limit", "authenticate"]);
    expect(test.generation).not.toHaveBeenCalled();
  });
});
