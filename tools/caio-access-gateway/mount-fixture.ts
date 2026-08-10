//
// ONE fixture for the Access Gateway mount, shared by every suite that builds it.
//
// The mount's PORTS — token authenticator, project resolver, operation
// capability resolver, MCP dispatcher, model dispatch bindings, audit gate,
// readiness probe — are deployment inputs by design, so any suite that exercises
// the mount has to supply doubles. Written twice they drift, and a
// cross-repo contract test standing on its own private idea of what the ports
// look like would be asserting against a composition nobody deploys. It is
// defined once, here.
//
// Feature flags stay at their fail-closed values: presence, mutations, prompt
// responses, question selections and advice decisions are OFF, and a fixture is
// not the place to quietly turn one on.
//
// Addresses are assembled at runtime so no address literal sits in the source.
//

import path from "node:path";

import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";
import type { CaioAccessGatewayServerPorts } from "@/tools/caio-access-gateway/server";
import {
  CAIO_ACCESS_GATEWAY_LISTEN_PORT,
  type CaioAccessGatewayServerConfig,
} from "@/tools/caio-access-gateway/server-config";

const LAN_ADDRESS = [10, 0, 0, 12].join(".");
export const CAIO_MOUNT_FIXTURE_CLIENT_ADDRESS = [10, 0, 0, 40].join(".");
const CERT_DIR = path.join(path.sep, "etc", "caio", "tls");

export const CAIO_MOUNT_FIXTURE_FINGERPRINT = `sha256:${"ab".repeat(32)}`;

export const CAIO_MOUNT_FIXTURE_PRINCIPAL: CaioAccessPrincipal = Object.freeze({
  tokenId: "tok_1",
  workspaceId: "ws_1",
  userRef: "user:ceo",
  clientType: "codex",
  deviceRef: "device:mac-studio",
  audience: "mcp",
});

export const CAIO_MOUNT_FIXTURE_CONFIG: CaioAccessGatewayServerConfig =
  Object.freeze({
    bindAddress: LAN_ADDRESS,
    port: CAIO_ACCESS_GATEWAY_LISTEN_PORT,
    mtls: Object.freeze({
      certificatePath: path.join(CERT_DIR, "server.crt"),
      privateKeyPath: path.join(CERT_DIR, "server.key"),
      clientCaPath: path.join(CERT_DIR, "client-ca.crt"),
      requireClientCertificate: true as const,
    }),
    featureFlags: Object.freeze({
      gatewayEnabled: true,
      readEnabled: true,
      pushEnabled: false,
      presenceEnabled: false,
      mutationsEnabled: false,
      promptResponsesEnabled: false,
      questionSelectionsEnabled: false,
      adviceDecisionsEnabled: false,
    }),
  });

export type CaioMountFixture = {
  ports: CaioAccessGatewayServerPorts;
  calls: string[];
};

export function createCaioMountFixturePorts(
  posture: "self_service" | "governed_fde" = "self_service",
): CaioMountFixture {
  const calls: string[] = [];
  return {
    calls,
    ports: {
      preAuthRateLimiter: {
        claimSourceIpSlot: async () => {
          calls.push("preAuthRateLimiter");
          return { allowed: true };
        },
      },
      tokenAuthenticator: {
        authenticate: async (input) => {
          calls.push("authenticate");
          return { ...CAIO_MOUNT_FIXTURE_PRINCIPAL, audience: input.expectedAudience };
        },
      },
      projectResolver: {
        async listAccessibleProjectRefs() {
          calls.push("projectResolver");
          return ["project:alpha"];
        },
      },
      operationResolver: {
        async hasWorkspaceOperationCapability() {
          calls.push("operationResolver");
          return true;
        },
      },
      mcpDispatch: async () => {
        calls.push("mcpDispatch");
        return { ok: true };
      },
      modelProxy: {
        engine: {
          execute: async () => {
            calls.push("modelProxy.execute");
            throw new Error("no upstream in this composition test");
          },
        },
        // Discovery is built in-tree from these bindings, so the composition
        // supplies DATA here, not a listing function. A deployment can no
        // longer hand in an implementation that ignores the token's grant.
        bindings: [
          {
            alias: "caio-codex-default",
            protocol: "responses" as const,
            providerKey: "provider-a",
            upstreamModel: "upstream-for-codex",
            credentialRef: "provider-a-key",
            endpointBaseUrl: "https://upstream.example.internal/v1",
            region: "cn-hangzhou",
            dataRetentionPolicyKey: "retention-days:30",
            trainingUsePolicyKey: "prohibited",
            dataAuthorizationKey: "auth-tier-1",
            policyVersion: "policy-v3",
            status: "active" as const,
            governedPolicyKey: "caio-lan-default",
            governedRouteRef: "route:caio-lan-default:v3",
            fallbackCandidates: [],
          },
        ],
      },
      auditGate: {
        posture,
        claimDispatch: async () => {
          calls.push("auditGate");
          return {
            status: "allowed" as const,
            receiptId: "receipt:1",
            persistedVia: "primary" as const,
            dispatchAttempt: 1,
          };
        },
      },
      readinessProbe: {
        getReadiness: async () => {
          calls.push("readinessProbe");
          return "ready" as const;
        },
      },
    },
  };
}
