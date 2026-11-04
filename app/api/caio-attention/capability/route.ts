import { readFile } from "node:fs/promises";
import path from "node:path";

import { db } from "@/lib/db";
import {
  CAIO_ATTENTION_CAPABILITY_FILE,
  parseCaioAttentionCapabilityFile,
  resolveCaioAttentionNodeId,
  type CaioAttentionCapabilityReport,
} from "@/lib/caio-attention/capability";
import { probeCaioAttentionSchemaReadiness } from "@/lib/caio-attention/schema-readiness";
import {
  CAIO_ATTENTION_CLOSE_CHAIN_BINDING, resolveCaioAttentionReportedCloseCapability,
} from "@/lib/caio-attention-runtime/close-chain-binding";
import { resolveRuntimeHealthAttestation } from "@/lib/production-health/runtime-deployment-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;
// Tables every attention runtime identity (generator and web) can see; the probe reports a missing one as not ready.
const PROBED_TABLES = ["CaioAttentionControl", "CaioAttentionPauseRequest", "CaioAttentionRuntimeNode", "CaioAttentionCase", "CaioAttentionCaseEvent"] as const;

/**
 * Loopback-only close-capability probe for attest-node (design v5 §1.4). No case data. App routes do not see the
 * peer address, so "local" means: Host is a loopback name and no proxy forwarding header is present (the fronting
 * proxy adds them). Anything else is answered as not found.
 */
function isLoopbackRequest(request: Request): boolean {
  const host = (request.headers.get("host") ?? "").replace(/:\d{1,5}$/u, "").toLowerCase();
  const forwarded = ["x-forwarded-for", "x-forwarded-host", "x-real-ip", "forwarded"].some((name) => request.headers.has(name));
  return !forwarded && (host === "127.0.0.1" || host === "localhost" || host === "[::1]");
}

async function readCapabilityFile(): Promise<string | null> {
  try {
    return await readFile(path.join(process.cwd(), CAIO_ATTENTION_CAPABILITY_FILE), "utf8");
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!isLoopbackRequest(request)) return new Response(null, { status: 404, headers: HEADERS });
  const attestation = resolveRuntimeHealthAttestation(process.env);
  const migration = await probeCaioAttentionSchemaReadiness(db, PROBED_TABLES);
  const report: CaioAttentionCapabilityReport = {
    nodeId: resolveCaioAttentionNodeId(process.env),
    deploymentId: attestation.mode === "artifact-bound" ? attestation.runtimeDeploymentId : null,
    closeCapabilityVersion: resolveCaioAttentionReportedCloseCapability(parseCaioAttentionCapabilityFile(await readCapabilityFile())),
    pageServiceBound: CAIO_ATTENTION_CLOSE_CHAIN_BINDING.pageServiceBound,
    lifecycleRoutes: CAIO_ATTENTION_CLOSE_CHAIN_BINDING.lifecycleRoutes,
    migrationReady: migration.ready,
  };
  return Response.json(report, { headers: HEADERS });
}
