import { readFile } from "node:fs/promises";
import path from "node:path";

import { db } from "@/lib/db";
import {
  CAIO_ATTENTION_CAPABILITY_FILE,
  CAIO_ATTENTION_CLOSE_CHAIN_BINDING,
  isCaioAttentionLoopbackRequest,
  parseCaioAttentionCapabilityFile,
  resolveCaioAttentionNodeId,
  resolveCaioAttentionReportedCloseCapability,
  type CaioAttentionCapabilityReport,
} from "@/lib/caio-attention/capability";
import { probeCaioAttentionSchemaReadiness } from "@/lib/caio-attention/schema-readiness";
import { resolveRuntimeHealthAttestation } from "@/lib/production-health/runtime-deployment-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;
// Tables every attention runtime identity (generator and web) can see; the probe reports a missing one as not ready.
const PROBED_TABLES = ["CaioAttentionControl", "CaioAttentionPauseRequest", "CaioAttentionRuntimeNode", "CaioAttentionCase", "CaioAttentionCaseEvent"] as const;

/**
 * Loopback-only close-capability probe for attest-node (design v5 §1.4). No case data. The loopback rule and its
 * residual risk are documented on isCaioAttentionLoopbackRequest; anything else is answered as not found.
 */

async function readCapabilityFile(): Promise<string | null> {
  try {
    return await readFile(path.join(process.cwd(), CAIO_ATTENTION_CAPABILITY_FILE), "utf8");
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!isCaioAttentionLoopbackRequest(request.headers)) return new Response(null, { status: 404, headers: HEADERS });
  const attestation = resolveRuntimeHealthAttestation(process.env);
  const migration = await probeCaioAttentionSchemaReadiness(db, PROBED_TABLES);
  const report: CaioAttentionCapabilityReport = {
    nodeId: resolveCaioAttentionNodeId(process.env),
    deploymentId: attestation.mode === "artifact-bound" ? attestation.runtimeDeploymentId : null,
    closeCapabilityVersion: resolveCaioAttentionReportedCloseCapability(parseCaioAttentionCapabilityFile(await readCapabilityFile()),
      CAIO_ATTENTION_CLOSE_CHAIN_BINDING.pageServiceBound),
    pageServiceBound: CAIO_ATTENTION_CLOSE_CHAIN_BINDING.pageServiceBound,
    lifecycleRoutes: CAIO_ATTENTION_CLOSE_CHAIN_BINDING.lifecycleRoutes,
    migrationReady: migration.ready,
  };
  return Response.json(report, { headers: HEADERS });
}
