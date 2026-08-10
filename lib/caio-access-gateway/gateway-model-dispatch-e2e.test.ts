// End-to-end proof of the model-dispatch chain, with NO test double between the
// three real components:
//
//   real createCaioGatewayHandler
//     -> real createCaioModelProxy            (only `fetch` is stubbed)
//        -> real createCaioCanonicalAuditGatePort over real createCaioAuditGate
//           -> in-memory primary store + real encrypted emergency queue
//              (mkdtemp sandbox, real fsync'd files)
//
// The seam this closes: the proxy used to declare its OWN audit port with an
// `{allowed, state}` decision that was not output-compatible with the canonical
// outcome the gateway requires, so this wiring could not be typed at all and a
// lost claim was prevented only by the gateway's receipt-evidence check.
//
// Proves, over HTTP:
//   (a) POST /v1/responses succeeds and the primary store holds EXACTLY ONE
//       receipt, with exactly the canonical six keys and no prompt text.
//   (b) when nothing can persist, the request is refused 503 and the upstream
//       fetch is never called — no egress without a durable receipt.
//   (c) a reused request id with divergent content surfaces 409, not a
//       retryable 503.

import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCaioGatewayHandler,
  type CaioGatewayHandler,
  type CaioGatewayRequest,
} from "@/lib/caio-access-gateway/gateway-http-core";
import { createCaioGatewayModelDispatchPort } from "@/lib/caio-access-gateway/model-dispatch-bridge";
import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";
import {
  createCaioAuditGate,
  type CaioAuditGate,
  type CaioAuditPrimaryStorePort,
} from "@/lib/caio-audit-state/audit-gate.service";
import {
  caioReceiptDigest,
  type CaioAuditPersistOutcome,
  type CaioMinimalAuditReceipt,
} from "@/lib/caio-audit-state/audit-state-contracts";
import {
  createCaioEmergencyQueue,
  type CaioEmergencyQueuePort,
} from "@/lib/caio-audit-state/emergency-queue";
import { createCaioCanonicalAuditGatePort } from "@/lib/caio-audit-state/gateway-audit-gate-adapter";
import {
  CAIO_CODEX_DEFAULT_ALIAS,
  type CaioModelAliasBinding,
} from "@/lib/caio-model-proxy/alias-contracts";
import type { CaioGovernedAdmissionSnapshot } from "@/lib/caio-model-proxy/governed-admission-contracts";
import { createCaioFrozenGovernedAdmission } from "@/lib/caio-model-proxy/governed-route-admission.service";
import { createCaioModelProxy } from "@/lib/caio-model-proxy/proxy-engine";
import { createCaioResponsesUpstreamPort } from "@/lib/caio-model-proxy/upstream/responses-client";

/** LAN client address, assembled so no literal private range sits in source. */
const CLIENT_LAN_IP = [192, 168, 1, 33].join(".");

const SECRET_PROMPT = "TOP-SECRET-E2E-PROMPT-CONTENT";

const PRINCIPAL: CaioAccessPrincipal = Object.freeze({
  tokenId: "tok_e2e_1",
  workspaceId: "ws_e2e",
  userRef: "user:ceo",
  clientType: "codex",
  deviceRef: "device:mac-studio",
  audience: "model",
});

const GOVERNED_POLICY_KEY = "caio-lan-default";
const GOVERNED_ROUTE_REF = "route-provider-a-primary";

const BINDING: CaioModelAliasBinding = Object.freeze({
  alias: CAIO_CODEX_DEFAULT_ALIAS,
  protocol: "responses",
  providerKey: "provider-a",
  upstreamModel: "provider-a-large-1",
  credentialRef: "provider-a-key",
  endpointBaseUrl: "https://upstream.example.internal/v1",
  region: "cn-hangzhou",
  dataRetentionPolicyKey: "retention-days:30",
  trainingUsePolicyKey: "prohibited",
  dataAuthorizationKey: "auth-tier-1",
  policyVersion: "policy-v3",
  status: "active",
  governedPolicyKey: GOVERNED_POLICY_KEY,
  governedRouteRef: GOVERNED_ROUTE_REF,
  fallbackCandidates: [],
});

/**
 * The frozen governed admission a self-service install resolves once at load:
 * an ACTIVE, human-OWNER-approved policy route that matches every governed
 * dimension of the binding above.
 */
const GOVERNED_ADMISSION: CaioGovernedAdmissionSnapshot = Object.freeze({
  policyKey: GOVERNED_POLICY_KEY,
  policyId: "policy:caio-lan-default-v1",
  policyHash: `sha256:${"f".repeat(64)}`,
  policyHeadVersion: 2,
  policyRevocationEpoch: 0,
  resolvedAt: "2026-07-30T00:00:00.000Z",
  validUntil: "2099-01-01T00:00:00.000Z",
  routes: new Map([
    [
      GOVERNED_ROUTE_REF,
      Object.freeze({
        routeRef: GOVERNED_ROUTE_REF,
        policyKey: GOVERNED_POLICY_KEY,
        policyId: "policy:caio-lan-default-v1",
        policyHash: `sha256:${"f".repeat(64)}`,
        policyHeadVersion: 2,
        policyRevocationEpoch: 0,
        provider: "provider-a",
        credentialRef: "provider-a-key",
        region: "cn-hangzhou",
        deploymentForm: "private_deployment",
        jurisdiction: "customer_premises",
        retentionPolicyKey: "retention-days:30",
        trainingUsePolicyKey: "prohibited",
        pricingVersion: "provider-a-pricing-202607",
        maxOutputTokens: 4_000,
        policyValidUntil: "2099-01-01T00:00:00.000Z",
      }),
    ],
  ]),
});

/** Deterministic non-secret test key material for the encrypted queue. */
function queueKey(): Buffer {
  return Buffer.alloc(32, 9);
}

type PrimaryStoreHarness = CaioAuditPrimaryStorePort & {
  setFailing(failing: boolean): void;
  receipts(): CaioMinimalAuditReceipt[];
};

function createInMemoryPrimaryStore(): PrimaryStoreHarness {
  const rows = new Map<
    string,
    { receiptId: string; receipt: CaioMinimalAuditReceipt }
  >();
  let failing = false;
  return {
    setFailing(next) {
      failing = next;
    },
    receipts() {
      return [...rows.values()].map((row) => row.receipt);
    },
    async persist({ receipt }): Promise<CaioAuditPersistOutcome> {
      if (failing) throw new Error("primary audit store unreachable");
      // Length-prefixed key: no workspace/requestId pair can collide with
      // another by shifting a byte across the boundary.
      const key = `${receipt.workspace.length}:${receipt.workspace}${receipt.requestId}`;
      const existing = rows.get(key);
      if (existing) {
        if (
          caioReceiptDigest(existing.receipt) !== caioReceiptDigest(receipt)
        ) {
          return { outcome: "conflict" };
        }
        return { outcome: "replayed", receiptId: existing.receiptId };
      }
      const receiptId = `row-${rows.size + 1}`;
      rows.set(key, { receiptId, receipt });
      return { outcome: "persisted", receiptId };
    },
  };
}

type Wiring = {
  handler: CaioGatewayHandler;
  gate: CaioAuditGate;
  queue: CaioEmergencyQueuePort;
  queueRoot: string;
  primaryStore: PrimaryStoreHarness;
  upstreamFetch: ReturnType<typeof vi.fn>;
};

let sandbox = "";
let wiring: Wiring;

function createWiring(options: { requestIdFactory?: () => string } = {}): Wiring {
  const queueRoot = path.join(sandbox, `queue-${Math.random().toString(36).slice(2, 8)}`);
  const queue = createCaioEmergencyQueue({
    rootDir: queueRoot,
    keyProvider: async () => queueKey(),
  });
  const primaryStore = createInMemoryPrimaryStore();
  const gate = createCaioAuditGate({
    posture: "self_service",
    primaryStore,
    emergencyQueue: queue,
  });

  // The ONLY stub inside the proxy: the upstream HTTP call.
  const upstreamFetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ id: "resp_e2e", output: "answered" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const upstreamPort = createCaioResponsesUpstreamPort({
    fetchImpl: upstreamFetch as unknown as typeof fetch,
  });

  const proxy = createCaioModelProxy({
    posture: "self_service",
    governedAdmission: createCaioFrozenGovernedAdmission(GOVERNED_ADMISSION),
    bindings: [BINDING],
    credentialLoader: {
      load: async ({ credentialRef }) => `loaded-secret-for-${credentialRef}`,
    },
    clients: { responses: upstreamPort, chatCompletions: upstreamPort },
    // NAIVE WIRING: the canonical port over the real gate, no shim.
    auditGate: createCaioCanonicalAuditGatePort(gate),
  });

  const dispatchPort = createCaioGatewayModelDispatchPort({ proxy });

  const handler = createCaioGatewayHandler({
    preAuthRateLimiter: { claimSourceIpSlot: async () => ({ allowed: true }) },
    tokenAuthenticator: {
      authenticate: async (input) => ({
        ...PRINCIPAL,
        audience: input.expectedAudience,
      }),
    },
    projectResolver: {
      async listAccessibleProjectRefs() {
        return [];
      },
    },
    operationResolver: {
      hasWorkspaceOperationCapability: async () => true,
    },
    mcpDispatch: async () => ({ ok: true }),
    modelProxy: {
      ...dispatchPort,
      // Alias listing is a configuration read with no dispatch and no egress,
      // so it carries no receipt and is wired outside the bridge.
      listModels: async () => ({ data: [] }),
    },
    auditGate: createCaioCanonicalAuditGatePort(gate),
    readinessProbe: gate,
    ...(options.requestIdFactory
      ? { requestIdFactory: options.requestIdFactory }
      : {}),
  });

  return { handler, gate, queue, queueRoot, primaryStore, upstreamFetch };
}

function responsesRequest(prompt = SECRET_PROMPT): CaioGatewayRequest {
  return {
    method: "POST",
    path: "/v1/responses",
    headers: { authorization: "Bearer hcaio_model_test-token" },
    clientIp: CLIENT_LAN_IP,
    body: JSON.stringify({ model: CAIO_CODEX_DEFAULT_ALIAS, input: prompt }),
  };
}

beforeEach(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "caio-model-dispatch-e2e-"));
  wiring = createWiring();
});

afterEach(async () => {
  if (sandbox) {
    await chmod(wiring.queueRoot, 0o700).catch(() => {});
    await rm(sandbox, { recursive: true, force: true });
  }
});

describe("gateway -> model proxy -> canonical audit gate, end to end", () => {
  it("serves POST /v1/responses on exactly ONE canonical receipt that holds no prompt text", async () => {
    const response = await wiring.handler(responsesRequest());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "resp_e2e", output: "answered" });
    expect(wiring.upstreamFetch).toHaveBeenCalledTimes(1);

    // Exactly one receipt: the gateway layer deliberately does not claim for
    // model routes (it has no alias binding), and the proxy claims exactly once.
    const receipts = wiring.primaryStore.receipts();
    expect(receipts).toHaveLength(1);
    const receipt = receipts[0];
    expect(Object.keys(receipt).sort()).toEqual([
      "client",
      "inputHash",
      "modelAlias",
      "policyVersion",
      "posture",
      "requestId",
      "workspace",
    ]);
    // The receipt names the deployment posture that produced it, so a
    // self-service receipt can never be read as a governed-FDE one.
    expect(receipt.posture).toBe("self_service");
    expect(receipt.workspace).toBe("ws_e2e");
    expect(receipt.client).toBe("codex");
    expect(receipt.modelAlias).toBe(CAIO_CODEX_DEFAULT_ALIAS);
    // policyVersion comes from the alias BINDING, which only the proxy knows.
    expect(receipt.policyVersion).toBe("policy-v3");
    expect(receipt.inputHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    // Server-generated, workspace-scoped request identity.
    expect(receipt.requestId.startsWith("ws_e2e:")).toBe(true);

    // The prompt never leaves the request path: not in the receipt, and not in
    // the queue either.
    const serialized = JSON.stringify(receipts);
    expect(serialized).not.toContain(SECRET_PROMPT);
    expect(serialized).not.toContain("loaded-secret-for");
    expect(await wiring.queue.size()).toBe(0);
  });

  it("refuses with 503 and never calls upstream when nothing can persist", async () => {
    wiring.primaryStore.setFailing(true);
    // Break the queue's directory contract: the real queue refuses a root that
    // is not mode 0700, so no durable receipt is possible anywhere.
    await wiring.queue.size();
    await chmod(wiring.queueRoot, 0o750);

    const response = await wiring.handler(responsesRequest());

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "caio_audit_unavailable" });
    // The gate's own retry advice reached the header, proving this is the
    // mapped canonical refusal and not a local fallback.
    expect(response.headers["retry-after"]).toBe("30");

    // Fail closed: no egress at all, and nothing durable anywhere.
    expect(wiring.upstreamFetch).not.toHaveBeenCalled();
    expect(wiring.primaryStore.receipts()).toEqual([]);
  });

  it("surfaces 409 for a reused request id with divergent content", async () => {
    // The gateway's own request ids never repeat, so the collision is forced by
    // pinning the id factory: same identity, different content.
    const pinned = createWiring({ requestIdFactory: () => "pinned-id" });

    const first = await pinned.handler(responsesRequest("first prompt"));
    expect(first.status).toBe(200);

    const second = await pinned.handler(responsesRequest("divergent prompt"));
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: "caio_audit_receipt_conflict" });
    // A conflict can never be fixed by retrying, so no Retry-After is emitted.
    expect(second.headers["retry-after"]).toBeUndefined();

    // The conflicting request never reached an upstream provider.
    expect(pinned.upstreamFetch).toHaveBeenCalledTimes(1);
    expect(pinned.primaryStore.receipts()).toHaveLength(1);
  });
});
