/**
 * Close-capability probe contract (design v5 §1.4–1.5, v6 §2.4). Pure: the local route assembles a report from the
 * process environment, the release's capability.json and the close-chain binding; attest-node judges it. Passing
 * only proves this node can close cases; it never replaces business acceptance after go-live.
 */

/**
 * Whether the close chain is wired into this build. Default closed. The integration with the page service sets
 * pageServiceBound from CAIO_ATTENTION_PAGE_SERVICE_BOUND and lifecycleRoutes once submit, review, reissue and
 * assignReviewers are registered; until then no node can attest, so resume stays blocked.
 */
export const CAIO_ATTENTION_CLOSE_CHAIN_BINDING: Readonly<{ pageServiceBound: boolean; lifecycleRoutes: boolean }> = {
  pageServiceBound: false,
  lifecycleRoutes: false,
};

export const CAIO_ATTENTION_CAPABILITY_FILE = "lib/caio-attention/capability.json";
const NODE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;

export type CaioAttentionCapabilityReport = Readonly<{
  nodeId: string | null;
  deploymentId: string | null;
  closeCapabilityVersion: number;
  pageServiceBound: boolean;
  lifecycleRoutes: boolean;
  migrationReady: boolean;
}>;

/** capability.json `{ closeCapabilityVersion }` (other keys ignored): absent = 0; malformed = null (fail closed). */
export function parseCaioAttentionCapabilityFile(text: string | null): number | null {
  if (text === null) return 0;
  try {
    const value: unknown = (JSON.parse(text) as { closeCapabilityVersion?: unknown } | null)?.closeCapabilityVersion;
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

/** HELM_RUNTIME_NODE_ID, the per-host node identity; absent or malformed means no heartbeat and no attest. */
export function resolveCaioAttentionNodeId(env: Readonly<Record<string, string | undefined>>): string | null {
  const nodeId = env.HELM_RUNTIME_NODE_ID?.trim();
  return nodeId && NODE_ID_PATTERN.test(nodeId) ? nodeId : null;
}

/** HELM_RUNTIME_NODE_ROLE, the heartbeat's process role: absent or empty is "http"; malformed is null (no heartbeat). */
export function resolveCaioAttentionNodeRole(env: Readonly<Record<string, string | undefined>>): string | null {
  const role = env.HELM_RUNTIME_NODE_ROLE?.trim() ?? "";
  if (role === "") return "http";
  return /^[a-z][a-z0-9_-]{0,31}$/u.test(role) ? role : null;
}

/** Headers a fronting proxy (the load balancer always sets X-Forwarded-For) adds; any of them means "not local". */
const FORWARDING_HEADERS = ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port", "x-real-ip"] as const;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Loopback check of the capability probe (design v5 §1.4). App routes do not see the peer address, so "local" means:
 * the Host header names a loopback host (optionally with a port) and no forwarding header is present. A direct peer
 * that forges `Host: 127.0.0.1` without forwarding headers is not excluded here; that residual rests on the network
 * rule that the HTTP port is reachable only from the load balancer and controlled probes. The report carries no case
 * data and cannot influence attest, which fetches it itself from 127.0.0.1.
 */
export function isCaioAttentionLoopbackRequest(headers: Pick<Headers, "get" | "has">): boolean {
  if (FORWARDING_HEADERS.some((name) => headers.has(name))) return false;
  const host = (headers.get("host") ?? "").trim().toLowerCase().replace(/:\d{1,5}$/u, "");
  return LOOPBACK_HOSTS.has(host);
}

export type CaioAttentionAttestBlock = "node_mismatch" | "deployment_mismatch" | "capability_too_low" | "page_service_unbound"
  | "lifecycle_routes_missing" | "migration_not_ready";

export function evaluateCaioAttentionCapability(
  report: CaioAttentionCapabilityReport,
  expected: Readonly<{ nodeId: string; deploymentId: string; requiredCloseCapability: number }>,
): CaioAttentionAttestBlock[] {
  const blocks: CaioAttentionAttestBlock[] = [];
  if (report.nodeId !== expected.nodeId) blocks.push("node_mismatch");
  if (report.deploymentId !== expected.deploymentId) blocks.push("deployment_mismatch");
  const capability = report.closeCapabilityVersion;
  if (!Number.isInteger(capability) || capability < Math.max(1, expected.requiredCloseCapability)) blocks.push("capability_too_low");
  if (report.pageServiceBound !== true) blocks.push("page_service_unbound");
  if (report.lifecycleRoutes !== true) blocks.push("lifecycle_routes_missing");
  if (report.migrationReady !== true) blocks.push("migration_not_ready");
  return blocks;
}
