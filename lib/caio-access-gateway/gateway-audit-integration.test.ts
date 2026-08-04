// Integration proof: the CAIO gateway HTTP core wired to the REAL audit gate.
//
// WHY THIS FILE EXISTS
// The gateway used to declare its own audit-gate port
// (`claimDispatch({requestId, route, principal, now}): Promise<void>`). Nothing
// could satisfy it and the receipt contract at the same time: the receipt is a
// closed six-field set keyed on `workspace`/`client`, it requires
// modelAlias/inputHash/policyVersion, and it is `.strict()` — so a naive wiring
// of the real gate threw ZodError on the FIRST request, and there was no way to
// express a receipt conflict or a replay-cap refusal at all.
//
// Here the wiring is naive on purpose: the real gate, wrapped only in the
// canonical port published by caio-audit-state, and the SAME gate object handed
// to the readiness probe with no adapter of any kind. Nothing in this file
// renames a field, drops a key, or catches a schema error.
//
// Drives three states of the audit substrate end to end:
//   1. primary store healthy      -> 200, receipt durable in the primary store
//   2. primary store failing      -> 200, receipt durable in the encrypted
//                                   emergency queue, /readyz degraded
//   3. nothing can persist        -> 503 + Retry-After, and NO dispatch

import { mkdtemp, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CAIO_GATEWAY_MCP_AUDIT_ALIAS,
  CAIO_GATEWAY_MCP_AUDIT_POLICY_VERSION,
  createCaioGatewayHandler,
  type CaioGatewayHandler,
  type CaioGatewayRequest,
} from "@/lib/caio-access-gateway/gateway-http-core";
import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";
import { DEFAULT_WORKBUDDY_FEATURE_FLAGS } from "@/lib/caio-collaboration/feature-flags";
import {
  caioReceiptDigest,
  type CaioAuditPersistOutcome,
  type CaioAuditPersistedVia,
  type CaioMinimalAuditReceipt,
} from "@/lib/caio-audit-state/audit-state-contracts";
import {
  createCaioAuditGate,
  type CaioAuditGate,
  type CaioAuditPrimaryStorePort,
} from "@/lib/caio-audit-state/audit-gate.service";
import {
  createCaioEmergencyQueue,
  type CaioEmergencyQueuePort,
} from "@/lib/caio-audit-state/emergency-queue";
import { createCaioCanonicalAuditGatePort } from "@/lib/caio-audit-state/gateway-audit-gate-adapter";

const CLIENT_LAN_IP = [192, 168, 1, 21].join(".");

/** The MCP read surface enabled; every mutation flag still off. */
const READ_ENABLED_FLAGS = Object.freeze({
  ...DEFAULT_WORKBUDDY_FEATURE_FLAGS,
  gatewayEnabled: true,
  readEnabled: true,
});

const PRINCIPAL: CaioAccessPrincipal = Object.freeze({
  tokenId: "tok_int_1",
  workspaceId: "ws_int",
  userRef: "user:ceo",
  clientType: "codex",
  deviceRef: "device:mac-studio",
  audience: "mcp",
});

const TOOL_CALL_BODY = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "get_p1c_read_projection",
    arguments: { workspaceId: "ws_int", portfolioRef: "project:alpha" },
  },
});

/** Deterministic non-secret test key material for the encrypted queue. */
function queueKey(): Buffer {
  return Buffer.alloc(32, 7);
}

type PrimaryStoreHarness = CaioAuditPrimaryStorePort & {
  setFailing(failing: boolean): void;
  receipts(): CaioMinimalAuditReceipt[];
  persistedVia(): CaioAuditPersistedVia[];
};

function createInMemoryPrimaryStore(): PrimaryStoreHarness {
  const rows = new Map<
    string,
    {
      receiptId: string;
      receipt: CaioMinimalAuditReceipt;
      persistedVia: CaioAuditPersistedVia;
    }
  >();
  let failing = false;
  return {
    setFailing(next) {
      failing = next;
    },
    receipts() {
      return [...rows.values()].map((row) => row.receipt);
    },
    persistedVia() {
      return [...rows.values()].map((row) => row.persistedVia);
    },
    async persist({ receipt, persistedVia }): Promise<CaioAuditPersistOutcome> {
      if (failing) throw new Error("primary audit store unreachable");
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
      rows.set(key, { receiptId, receipt, persistedVia });
      return { outcome: "persisted", receiptId };
    },
  };
}

type Wiring = {
  handler: CaioGatewayHandler;
  gate: CaioAuditGate;
  queue: CaioEmergencyQueuePort;
  primaryStore: PrimaryStoreHarness;
  dispatches: string[];
  modelDispatches: string[];
  queueRoot: string;
};

let sandbox = "";
let wiring: Wiring;

async function createWiring(): Promise<Wiring> {
  const queueRoot = path.join(sandbox, "queue");
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
  const dispatches: string[] = [];
  const modelDispatches: string[] = [];

  const handler = createCaioGatewayHandler({
    preAuthRateLimiter: {
      claimSourceIpSlot: async () => ({ allowed: true }),
    },
    tokenAuthenticator: {
      authenticate: async (input) => ({
        ...PRINCIPAL,
        audience: input.expectedAudience,
      }),
    },
    projectResolver: {
      async listAccessibleProjectRefs() {
        return ["project:alpha"];
      },
    },
    mcpDispatch: async (input) => {
      dispatches.push(input.requestId);
      return { ok: true };
    },
    modelProxy: {
      responses: async () => {
        modelDispatches.push("responses");
        throw new Error("no upstream in this wiring");
      },
      chatCompletions: async () => {
        modelDispatches.push("chatCompletions");
        throw new Error("no upstream in this wiring");
      },
      listModels: async () => {
        modelDispatches.push("listModels");
        return { data: [] };
      },
    },
    // NAIVE WIRING: the canonical port published by caio-audit-state over the
    // real gate. No field renaming, no shim, no try/catch here.
    auditGate: createCaioCanonicalAuditGatePort(gate),
    // The real gate object IS the readiness probe. Its async four-state
    // getReadiness() is consumed directly.
    readinessProbe: gate,
    // This file proves the AUDIT substrate, so the MCP surface is enabled for
    // reads: with the fail-closed default flag state no /mcp request reaches
    // the audit gate at all.
    featureFlags: READ_ENABLED_FLAGS,
  });

  return {
    handler,
    gate,
    queue,
    primaryStore,
    dispatches,
    modelDispatches,
    queueRoot,
  };
}

function mcpRequest(
  overrides: Partial<CaioGatewayRequest> = {},
): CaioGatewayRequest {
  return {
    method: "POST",
    path: "/mcp",
    headers: { authorization: "Bearer hcaio_mcp_test-token" },
    clientIp: CLIENT_LAN_IP,
    body: TOOL_CALL_BODY,
    ...overrides,
  };
}

function readyzRequest(): CaioGatewayRequest {
  return {
    method: "GET",
    path: "/readyz",
    headers: {},
    clientIp: CLIENT_LAN_IP,
    body: null,
  };
}

beforeEach(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "caio-gateway-audit-"));
  wiring = await createWiring();
});

afterEach(async () => {
  if (sandbox) {
    await chmod(wiring.queueRoot, 0o700).catch(() => {});
    await rm(sandbox, { recursive: true, force: true });
  }
});

describe("gateway HTTP core wired to the real audit gate", () => {
  it("interoperates with no adapter shim: a naive wiring no longer throws on field names", async () => {
    const response = await wiring.handler(mcpRequest());

    // Before this change the first request died inside the strict receipt
    // schema (unrecognized keys `route`/`principal`/`now`, missing
    // modelAlias/inputHash/policyVersion) and surfaced as 503.
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });

    const receipts = wiring.primaryStore.receipts();
    expect(receipts).toHaveLength(1);
    const receipt = receipts[0];
    // The gateway's canonical claim vocabulary landed on the receipt's storage
    // vocabulary: workspaceId -> workspace, clientType -> client.
    expect(receipt.workspace).toBe("ws_int");
    expect(receipt.client).toBe("codex");
    expect(receipt.modelAlias).toBe(CAIO_GATEWAY_MCP_AUDIT_ALIAS);
    expect(receipt.policyVersion).toBe(CAIO_GATEWAY_MCP_AUDIT_POLICY_VERSION);
    expect(receipt.inputHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    // Server-generated, workspace-scoped request identity reached the receipt.
    expect(receipt.requestId.startsWith("ws_int:")).toBe(true);
    expect(wiring.dispatches).toEqual([receipt.requestId]);
    // The receipt is a closed set: no route, no payload, no principal object.
    expect(Object.keys(receipt).sort()).toEqual([
      "client",
      "inputHash",
      "modelAlias",
      "policyVersion",
      "posture",
      "requestId",
      "workspace",
    ]);
    // Seventh field, stamped by the gate rather than supplied by the request.
    expect(receipt.posture).toBe("self_service");
    expect(JSON.stringify(receipt)).not.toContain("project:alpha");
    expect(await wiring.queue.size()).toBe(0);
  });

  it("reports readiness through the gate's own four-state probe", async () => {
    const ready = await wiring.handler(readyzRequest());
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: "ready", posture: "self_service" });
  });

  it("keeps serving through the encrypted emergency queue while the primary store fails", async () => {
    wiring.primaryStore.setFailing(true);
    const response = await wiring.handler(mcpRequest());
    expect(response.status).toBe(200);
    expect(wiring.dispatches).toHaveLength(1);

    // Nothing reached the primary store; the receipt is durable in the queue.
    expect(wiring.primaryStore.receipts()).toEqual([]);
    expect(await wiring.queue.size()).toBe(1);
    const queued = await wiring.queue.list();
    expect(queued[0].receipt.workspace).toBe("ws_int");
    expect(queued[0].receipt.modelAlias).toBe(CAIO_GATEWAY_MCP_AUDIT_ALIAS);

    // recovering/degraded both collapse to "degraded" on the 3-state probe.
    const degraded = await wiring.handler(readyzRequest());
    expect(degraded.status).toBe(200);
    expect(degraded.body).toEqual({
      status: "degraded",
      posture: "self_service",
    });

    // Once the primary recovers, replay drains the queue and readiness returns.
    wiring.primaryStore.setFailing(false);
    const recovery = await wiring.gate.recover();
    expect(recovery).toEqual({ replayed: 1, remaining: 0, conflicts: 0 });
    expect(wiring.primaryStore.persistedVia()).toEqual(["emergency_replay"]);
    const recovered = await wiring.handler(readyzRequest());
    expect(recovered.body).toEqual({
      status: "ready",
      posture: "self_service",
    });
  });

  it("refuses with 503 and dispatches nothing when nothing can persist", async () => {
    wiring.primaryStore.setFailing(true);
    // Break the queue's directory contract: the real queue refuses a root that
    // is not mode 0700, so neither store can take a durable receipt.
    await wiring.queue.size();
    await chmod(wiring.queueRoot, 0o750);

    const response = await wiring.handler(mcpRequest());
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "caio_audit_unavailable" });
    // The gate's OWN retry advice (30s) reached the header, which also proves
    // this is a mapped refusal outcome rather than the gateway's local fallback.
    expect(response.headers["retry-after"]).toBe("30");

    // Fail closed: no dispatch, no upstream, nothing durable anywhere.
    expect(wiring.dispatches).toEqual([]);
    expect(wiring.modelDispatches).toEqual([]);
    expect(wiring.primaryStore.receipts()).toEqual([]);

    // /readyz agrees with the refusal instead of advertising a write path.
    const unavailable = await wiring.handler(readyzRequest());
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toEqual({ error: "caio_audit_unavailable" });
  });

  it("refuses a divergent receipt for a reused request id as 409", async () => {
    // The gateway's own request ids never repeat, so a conflict is forced by
    // pinning the id factory: two DIFFERENT payloads under one request id is
    // exactly the receipt conflict the old port could not express.
    const queue = createCaioEmergencyQueue({
      rootDir: path.join(sandbox, "conflict-queue"),
      keyProvider: async () => queueKey(),
    });
    const primaryStore = createInMemoryPrimaryStore();
    const gate = createCaioAuditGate({
    posture: "self_service",
    primaryStore,
    emergencyQueue: queue,
  });
    const dispatches: string[] = [];
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
          return ["project:alpha", "project:beta"];
        },
      },
      mcpDispatch: async (input) => {
        dispatches.push(input.requestId);
        return { ok: true };
      },
      modelProxy: {
        responses: async () => ({
          claim: "allowed",
          auditReceiptId: "unused",
          body: null,
        }),
        chatCompletions: async () => ({
          claim: "allowed",
          auditReceiptId: "unused",
          body: null,
        }),
        listModels: async () => ({ data: [] }),
      },
      auditGate: createCaioCanonicalAuditGatePort(gate),
      readinessProbe: gate,
      requestIdFactory: () => "pinned-id",
      featureFlags: READ_ENABLED_FLAGS,
    });

    const first = await handler(mcpRequest());
    expect(first.status).toBe(200);

    const second = await handler(
      mcpRequest({
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "get_p1c_read_projection",
            arguments: {
              workspaceId: "ws_int",
              portfolioRef: "project:beta",
            },
          },
        }),
      }),
    );
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: "caio_audit_receipt_conflict" });
    expect(second.headers["retry-after"]).toBeUndefined();
    // The conflicting request never dispatched.
    expect(dispatches).toHaveLength(1);
  });
});
