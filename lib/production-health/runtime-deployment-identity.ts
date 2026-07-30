export type RuntimeHealthAttestation =
  | {
      readonly mode: "reachability";
    }
  | {
      readonly mode: "artifact-bound";
      readonly runtimeDeploymentId: string;
    }
  | {
      readonly mode: "unavailable";
    };

type RuntimeHealthEnvironment = {
  readonly [key: string]: string | undefined;
  readonly HELM_HEALTH_ATTESTATION_MODE?: string;
  readonly HELM_RUNTIME_DEPLOYMENT_ID?: string;
};

const RUNTIME_DEPLOYMENT_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function resolveRuntimeHealthAttestation(
  environment: RuntimeHealthEnvironment,
): RuntimeHealthAttestation {
  const mode = environment.HELM_HEALTH_ATTESTATION_MODE;

  if (mode === undefined || mode === "" || mode === "reachability") {
    return {
      mode: "reachability",
    };
  }

  if (mode !== "artifact-bound") {
    return {
      mode: "unavailable",
    };
  }

  const runtimeDeploymentId = environment.HELM_RUNTIME_DEPLOYMENT_ID;
  if (
    runtimeDeploymentId === undefined ||
    !RUNTIME_DEPLOYMENT_ID_PATTERN.test(runtimeDeploymentId)
  ) {
    return {
      mode: "unavailable",
    };
  }

  return {
    mode: "artifact-bound",
    runtimeDeploymentId,
  };
}
