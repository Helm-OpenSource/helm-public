//
// THE PUBLIC↔OVERLAY COMPOSITION CONTRACT, against an EXTERNAL Overlay checkout.
//
// WHAT WAS WRONG. Both sides had green cross-repo evidence and neither side ran
// the other's code. The Overlay gate wrote its OWN node-request adapter instead
// of using `createCaioAccessGatewayMount.serveNodeRequest`, with a stated
// reason — importing Core's adapter would bind that gate to a Core commit the
// WorkBuddy binding does not pin. That reason is sound for the Overlay gate,
// and it left nobody exercising the real interface: posture, the mTLS peer
// seam, the model-dispatch bridge, or a Node error path could all diverge from
// the host and both suites would still pass.
//
// So the contract is verified HERE, where the pin can point the other way: this
// repository names an exact Overlay commit, checks it out in CI, and drives the
// REAL mount through the REAL Overlay composition.
//
// WHAT IS REAL HERE: the Overlay's own transport, router and composed-surface
// declaration, loaded from the external checkout; and this repository's
// `createCaioAccessGatewayMount`, whose `serveNodeRequest` IS the surface's
// `serve`. No adapter is written in this file — an adapter written here would
// reproduce the defect in the other direction.
//
// WHAT IS DOUBLED: the gateway's PORTS — token authenticator, project resolver,
// MCP dispatcher, model proxy, audit gate, readiness probe. They are deployment
// inputs by design and have no in-tree production implementation, so doubling
// them is what the interface is, not a shortcut around it.
//
// STATED LIMIT: no TLS. This mount never terminates TLS — the host does, and
// the host's mTLS is covered by the Overlay's own real-socket gate. Driving
// this contract over a socket would need a synthetic CA and leaf certificate,
// which this work is not permitted to generate, and would be testing the
// Overlay's transport rather than the interface between the two repositories.
// What is asserted here is the mount interface and the composition around it.
//

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createCaioAccessGatewayMount } from "./server";

const PIN = JSON.parse(
  readFileSync(
    path.join(__dirname, "overlay-composition-pin.json"),
    "utf8",
  ),
) as { commit: string; compositionModule: string };

/**
 * The external Overlay checkout, or a refusal that says so in one line.
 *
 * A gate that cannot run must SAY it cannot run. Returning "no checkout, so
 * nothing to compare" would make an absent checkout indistinguishable from a
 * verified contract, which is the failure shape this whole file exists for.
 */
function requireOverlayCheckout(): string {
  const root = process.env.HELM_OVERLAYS_ROOT?.trim();
  if (!root) {
    throw new Error(
      "caio-overlay-composition-contract: cannot run — HELM_OVERLAYS_ROOT is not set; check out Helm-Developers/helm-overlays at the pinned commit and point HELM_OVERLAYS_ROOT at it",
    );
  }
  const compositionPath = path.join(root, PIN.compositionModule);
  if (!existsSync(compositionPath)) {
    throw new Error(
      `caio-overlay-composition-contract: cannot run — ${root} does not look like a helm-overlays checkout (missing ${PIN.compositionModule})`,
    );
  }
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (head !== PIN.commit) {
    throw new Error(
      `caio-overlay-composition-contract: checkout is at ${head}, pinned commit is ${PIN.commit}; the contract must be verified against the commit this repository names, not whatever is on disk`,
    );
  }
  return root;
}

const { createCaioMountFixturePorts, CAIO_MOUNT_FIXTURE_CONFIG, CAIO_MOUNT_FIXTURE_CLIENT_ADDRESS } =
  await import("./mount-fixture");

const CLIENT_ADDRESS = CAIO_MOUNT_FIXTURE_CLIENT_ADDRESS;
const CONFIG = CAIO_MOUNT_FIXTURE_CONFIG;
const createPorts = createCaioMountFixturePorts;

function nodeRequest(input: { method: string; url: string; body?: string }) {
  const stream = Readable.from([Buffer.from(input.body ?? "", "utf8")]);
  return Object.assign(stream, {
    method: input.method,
    url: input.url,
    headers: {} as Record<string, string | undefined>,
    socket: {
      authorized: true,
      remoteAddress: CLIENT_ADDRESS,
      getPeerCertificate: () => ({
        fingerprint256: `${"AB:".repeat(31)}AB`,
      }),
    },
  });
}

function captureNodeResponse() {
  const capture = { status: 0, body: "", ended: false };
  const response = {
    writeHead(status: number) {
      capture.status = status;
      return response;
    },
    end(body?: string) {
      capture.body = body ?? "";
      capture.ended = true;
      return response;
    },
  };
  return { capture, response };
}

describe("the Public mount, composed by the pinned Overlay", () => {
  it("is verified against the exact pinned Overlay commit", () => {
    const root = requireOverlayCheckout();
    const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    expect(head).toBe(PIN.commit);
  });

  it("routes the mount's own declared paths, through the Overlay's router", async () => {
    const root = requireOverlayCheckout();
    const composition = (await import(
      path.join(root, PIN.compositionModule)
    )) as typeof import("./overlay-composition-types");

    const { ports } = createPorts();
    const mount = createCaioAccessGatewayMount({
      config: CONFIG,
      posture: "self_service",
      ports: ports as never,
    });

    // The Overlay's OWN declaration type, holding this repository's OWN mount.
    // `serve` is `serveNodeRequest` — not an adapter written here.
    const surfaces = composition.resolveComposedGatewaySurfaces({
      mounted: true,
      surface: {
        key: "caio_access_gateway",
        paths: mount.apiPaths,
        serve: (request, response, options) =>
          mount.serveNodeRequest(request, response, options),
      },
    });
    const router = composition.createComposedGatewayRouter({
      workBuddyPath: "/mcp/workbuddy",
      surfaces,
    });

    // Every path the MOUNT declares is owned by the mount in the OVERLAY's
    // router. A count is asserted because zero comparisons is the way this
    // test could pass while comparing nothing.
    let compared = 0;
    for (const declaredPath of mount.apiPaths) {
      expect(router.owner(declaredPath)).toBe(surfaces[0]);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(0);
    expect(compared).toBe(mount.apiPaths.length);
    // And the WorkBuddy endpoint is still the WorkBuddy endpoint: the mount
    // did not claim the host's own path.
    expect(router.owner("/mcp/workbuddy")).toBe("workbuddy");
  });

  it("answers a real request through serveNodeRequest, inside the host's accounting", async () => {
    const root = requireOverlayCheckout();
    const composition = (await import(
      path.join(root, PIN.compositionModule)
    )) as typeof import("./overlay-composition-types");

    const transport = composition.createWorkBuddyGatewayTransport({
      config: {
        endpointPath: "/mcp/workbuddy",
        maxRequestBytes: 1_048_576,
        maxResponseBytes: 1_048_576,
        requestTimeoutMs: 5_000,
        maxConcurrentRequests: 8,
        rateLimitPerMinute: 60,
        auditHmacKey: Buffer.alloc(32, 0x5a),
      },
      identityResolver: { resolve: async () => null },
      handleMessage: async () => ({ httpStatus: 200, body: null }),
      randomRequestId: () => "workbuddy-request:contract",
      audit: () => {},
    });

    const { ports, calls } = createPorts();
    const mount = createCaioAccessGatewayMount({
      config: CONFIG,
      posture: "self_service",
      ports: ports as never,
    });

    const serve = (request: unknown, response: unknown, options: unknown) =>
      mount.serveNodeRequest(
        request as never,
        response as never,
        options as never,
      );

    const { capture, response } = captureNodeResponse();
    const outcome = await transport.runComposedOperation((signal) =>
      serve(nodeRequest({ method: "GET", url: "/readyz" }), response, {
        signal,
      }),
    );

    expect(outcome.admitted).toBe(true);
    expect(capture.status).toBe(200);
    expect(JSON.parse(capture.body)).toEqual({
      status: "ready",
      posture: "self_service",
    });
    // A port was actually reached, so the answer came from the mount rather
    // than from a constant somewhere in the composition.
    expect(calls).toContain("readinessProbe");
    // And the host counted it: the drain sees an idle transport only after it
    // settled.
    expect(await transport.waitForIdle(50)).toBe(true);
  });

  it("refuses the mount's work once the pinned host begins shutting down", async () => {
    const root = requireOverlayCheckout();
    const composition = (await import(
      path.join(root, PIN.compositionModule)
    )) as typeof import("./overlay-composition-types");

    const transport = composition.createWorkBuddyGatewayTransport({
      config: {
        endpointPath: "/mcp/workbuddy",
        maxRequestBytes: 1_048_576,
        maxResponseBytes: 1_048_576,
        requestTimeoutMs: 5_000,
        maxConcurrentRequests: 8,
        rateLimitPerMinute: 60,
        auditHmacKey: Buffer.alloc(32, 0x5a),
      },
      identityResolver: { resolve: async () => null },
      handleMessage: async () => ({ httpStatus: 200, body: null }),
      randomRequestId: () => "workbuddy-request:contract",
      audit: () => {},
    });

    const { ports, calls } = createPorts();
    const mount = createCaioAccessGatewayMount({
      config: CONFIG,
      posture: "self_service",
      ports: ports as never,
    });

    transport.beginShutdown();
    const { response } = captureNodeResponse();
    const outcome = await transport.runComposedOperation((signal) =>
      mount.serveNodeRequest(
        nodeRequest({ method: "GET", url: "/readyz" }) as never,
        response as never,
        { signal },
      ),
    );

    expect(outcome.admitted).toBe(false);
    expect(calls).toEqual([]);
  });

  it("still owns no socket, and offers the host no way to open one", () => {
    // Also gated on the checkout, so that NO assertion in this file can report
    // a verified contract when the other repository is absent. A suite in which
    // one case still goes green without the checkout invites reading the run as
    // partially successful.
    requireOverlayCheckout();
    const { ports } = createPorts();
    const mount = createCaioAccessGatewayMount({
      config: CONFIG,
      posture: "self_service",
      ports: ports as never,
    }) as unknown as Record<string, unknown>;
    // A second `.listen()` anywhere in this composition would contend with the
    // host for the one approved private socket.
    expect(mount.start).toBeUndefined();
    expect(mount.close).toBeUndefined();
    expect(mount.listen).toBeUndefined();
  });
});
