import { describe, expect, it } from "vitest";
import { resolveRuntimeHealthAttestation } from "@/lib/production-health/runtime-deployment-identity";

describe("runtime deployment identity", () => {
  it("preserves reachability mode when no attestation mode is configured", () => {
    expect(resolveRuntimeHealthAttestation({})).toEqual({
      mode: "reachability",
    });
  });

  it("accepts an opaque deployment identity in artifact-bound mode", () => {
    expect(
      resolveRuntimeHealthAttestation({
        HELM_HEALTH_ATTESTATION_MODE: "artifact-bound",
        HELM_RUNTIME_DEPLOYMENT_ID:
          "release-20260730.core-a14eb17.overlay-188dc2e",
      }),
    ).toEqual({
      mode: "artifact-bound",
      runtimeDeploymentId:
        "release-20260730.core-a14eb17.overlay-188dc2e",
    });
  });

  it.each([
    undefined,
    "",
    " contains-space",
    "contains/slash",
    "contains\ncontrol",
    "a".repeat(129),
  ])(
    "fails closed for a missing or invalid artifact-bound identity: %s",
    (runtimeDeploymentId) => {
      expect(
        resolveRuntimeHealthAttestation({
          HELM_HEALTH_ATTESTATION_MODE: "artifact-bound",
          HELM_RUNTIME_DEPLOYMENT_ID: runtimeDeploymentId,
        }),
      ).toEqual({
        mode: "unavailable",
      });
    },
  );

  it("fails closed for an unsupported attestation mode without reflecting it", () => {
    expect(
      resolveRuntimeHealthAttestation({
        HELM_HEALTH_ATTESTATION_MODE: "artifact-bound\nsecret-value",
        HELM_RUNTIME_DEPLOYMENT_ID: "release-safe",
      }),
    ).toEqual({
      mode: "unavailable",
    });
  });
});
