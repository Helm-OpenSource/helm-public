import { describe, expect, it, vi } from "vitest";

import {
  createCaioGatewayHandler,
  type CaioGatewayHandlerDependencies,
} from "./gateway-http-core";
import { DEFAULT_WORKBUDDY_FEATURE_FLAGS } from "@/lib/caio-collaboration/feature-flags";
import {
  CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  createCaioProPrivateExecutionResultProjection,
} from "@/lib/stage1-owner-loop/caio-pro-fde-cross-repo-contract";

function projection() {
  return createCaioProPrivateExecutionResultProjection({
    interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
    contractRef: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
    contractHash: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
    evaluatorRevision:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorRevision,
    evaluatorContractRef:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractRef,
    evaluatorContractHash:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractHash,
    projectionRef: "private-result:execution-1",
    workspaceRef: "workspace:workspace-1",
    portfolioRef: "opportunity:opportunity-1",
    evidenceSnapshotRef: "observation-run:run-1",
    decisionRecordRef: "decision-record:decision-1",
    actionItemRef: "action-item:action-1",
    approvalTaskRef: "approval-task:approval-1",
    executionProofRefs: ["proof:executor-result-1"],
    receiptOutcome: "SUCCESS",
    actionTaken: "Recorded the governed private executor result.",
    outcome: {
      outcomeRef: "observation-run:run-1",
      result: "success",
      followedAiRecommendation: true,
    },
    recordedAt: "2026-08-09T23:55:00.000Z",
  });
}

function harness(input?: {
  clientType?: "codex" | "workbuddy";
  workspaceId?: string;
  projectRefs?: readonly string[];
  mutationsEnabled?: boolean;
}) {
  const calls: string[] = [];
  const ingress = vi.fn(async () => ({
    kind: "recorded" as const,
    receiptId: "receipt-1",
    projectionRef: "private-result:execution-1",
    contentHash: projection().contentHash,
  }));
  const dependencies = {
    preAuthRateLimiter: {
      claimSourceIpSlot: async () => {
        calls.push("rate-limit");
        return { allowed: true as const };
      },
    },
    tokenAuthenticator: {
      authenticate: async ({ expectedAudience }: { expectedAudience: "mcp" | "model" }) => {
        calls.push("authenticate");
        return {
          tokenId: "token-1",
          workspaceId: input?.workspaceId ?? "workspace-1",
          userRef: "service:workbuddy-1",
          clientType: input?.clientType ?? "workbuddy",
          deviceRef: "device:workbuddy-1",
          audience: expectedAudience,
        };
      },
    },
    projectResolver: {
      listAccessibleProjectRefs: async () => {
        calls.push("project-access");
        return input?.projectRefs ?? ["opportunity:opportunity-1"];
      },
    },
    privateExecutionResultIngress: async (request: unknown) => {
      calls.push("private-ingress");
      return ingress(request);
    },
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
          receiptId: "audit:private-ingress-1",
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
    ingress,
    handler: createCaioGatewayHandler(dependencies),
  };
}

function request(body: unknown = projection()) {
  return {
    method: "POST",
    path: "/v1/execution-results",
    headers: { authorization: "Bearer token", "x-request-id": "client-1" },
    clientIp: "203.0.113.10",
    body: JSON.stringify(body),
  } as const;
}

describe("private execution result gateway route", () => {
  it("authenticates, checks live Portfolio access, claims audit, then enters Core", async () => {
    const test = harness();

    await expect(test.handler(request())).resolves.toMatchObject({
      status: 200,
      body: { receiptId: "receipt-1" },
    });
    expect(test.calls).toEqual([
      "rate-limit",
      "authenticate",
      "project-access",
      "audit",
      "private-ingress",
    ]);
    expect(test.ingress).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: expect.objectContaining({ clientType: "workbuddy" }),
        projection: expect.objectContaining({
          projectionRef: "private-result:execution-1",
        }),
      }),
    );
  });

  it("keeps the route fail-closed while mutation capability is disabled", async () => {
    const test = harness({ mutationsEnabled: false });

    await expect(test.handler(request())).resolves.toMatchObject({ status: 403 });
    expect(test.calls).toEqual(["rate-limit", "authenticate"]);
    expect(test.ingress).not.toHaveBeenCalled();
  });

  it("rejects non-WorkBuddy principals and workspace drift before project access", async () => {
    const wrongClient = harness({ clientType: "codex" });
    await expect(wrongClient.handler(request())).resolves.toMatchObject({
      status: 403,
    });
    expect(wrongClient.calls).toEqual(["rate-limit", "authenticate"]);

    const wrongWorkspace = harness({ workspaceId: "workspace-2" });
    await expect(wrongWorkspace.handler(request())).resolves.toMatchObject({
      status: 403,
    });
    expect(wrongWorkspace.calls).toEqual(["rate-limit", "authenticate"]);
  });

  it("rejects revoked Portfolio access and malformed projections without ingress", async () => {
    const revoked = harness({ projectRefs: [] });
    await expect(revoked.handler(request())).resolves.toMatchObject({
      status: 403,
    });
    expect(revoked.calls).toEqual([
      "rate-limit",
      "authenticate",
      "project-access",
    ]);

    const malformed = harness();
    await expect(
      malformed.handler(request({ ...projection(), extra: true })),
    ).resolves.toMatchObject({ status: 400 });
    expect(malformed.ingress).not.toHaveBeenCalled();
  });
});
