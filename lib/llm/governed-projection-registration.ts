import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

/**
 * The identity of a governed projection engine, and the ONE function that turns it into the registration
 * hashes a projection receipt carries. A route that pins a projector/scanner must pin these same hashes, so
 * route builders (for example an overlay's activation contract) import this instead of re-deriving it.
 * Pure: no server-only, no database.
 */
export type GovernedProjectionEngineRegistration = {
  engineKey: string;
  projectorRegistrationRef: string;
  projectorKey: string;
  projectorVersion: string;
  projectorImplementationHash: string;
  scannerRegistrationRef: string;
  scannerKey: string;
  scannerVersion: string;
  scannerImplementationHash: string;
  executionBoundary: "local_only";
};

export function computeGovernedProjectionRegistrationHash(
  registration: GovernedProjectionEngineRegistration,
  kind: "projector" | "scanner",
): string {
  return sha256(
    canonicalJson(
      kind === "projector"
        ? {
            schemaVersion: "helm.model-projector-registration/v1",
            engineKey: registration.engineKey,
            registrationRef: registration.projectorRegistrationRef,
            componentKey: registration.projectorKey,
            componentVersion: registration.projectorVersion,
            implementationHash: registration.projectorImplementationHash,
            executionBoundary: registration.executionBoundary,
          }
        : {
            schemaVersion: "helm.model-scanner-registration/v1",
            engineKey: registration.engineKey,
            registrationRef: registration.scannerRegistrationRef,
            componentKey: registration.scannerKey,
            componentVersion: registration.scannerVersion,
            implementationHash: registration.scannerImplementationHash,
            executionBoundary: registration.executionBoundary,
          },
    ),
  );
}
