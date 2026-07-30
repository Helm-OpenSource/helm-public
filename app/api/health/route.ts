import { resolveRuntimeHealthAttestation } from "@/lib/production-health/runtime-deployment-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const HEALTH_RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

const PUBLIC_HEALTH_BOUNDARIES = {
  authenticatedDetailsIncluded: false,
  businessDataIncluded: false,
  piiIncluded: false,
  rawLogsIncluded: false,
} as const;

export async function GET() {
  const attestation = resolveRuntimeHealthAttestation(process.env);

  if (attestation.mode === "unavailable") {
    return Response.json(
      {
        success: false,
        data: {
          status: "unavailable",
          service: "helm",
          scope: "source-deployment-artifact-binding",
          checks: {
            http: "ok",
            deploymentIdentity: "unavailable",
          },
          boundaries: PUBLIC_HEALTH_BOUNDARIES,
        },
      },
      {
        status: 503,
        headers: HEALTH_RESPONSE_HEADERS,
      },
    );
  }

  if (attestation.mode === "artifact-bound") {
    return Response.json(
      {
        success: true,
        data: {
          status: "ok",
          service: "helm",
          scope: "source-deployment-artifact-binding",
          runtimeDeploymentId: attestation.runtimeDeploymentId,
          checks: {
            http: "ok",
            deploymentIdentity: "ok",
          },
          boundaries: PUBLIC_HEALTH_BOUNDARIES,
        },
      },
      {
        headers: HEALTH_RESPONSE_HEADERS,
      },
    );
  }

  return Response.json(
    {
      success: true,
      data: {
        status: "ok",
        service: "helm",
        scope: "public-runtime-reachability",
        checks: {
          http: "ok",
        },
        boundaries: PUBLIC_HEALTH_BOUNDARIES,
      },
    },
    {
      headers: HEALTH_RESPONSE_HEADERS,
    },
  );
}
