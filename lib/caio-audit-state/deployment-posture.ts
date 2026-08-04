// CAIO deployment posture — the declared shape of ONE installation.
//
// The owner ruling of 2026-07-30 ships TWO postures as parallel ways to
// install the gateway, not as two settings of one product:
//
//   self_service  (recommended default; the customer installs it themselves)
//       LAN passthrough. When the PRIMARY audit store cannot take a receipt,
//       the receipt is written to the local encrypted emergency queue and the
//       request proceeds; readiness reports `degraded`. Availability first.
//
//   governed_fde  (FDE-assisted, for customers who require it)
//       Full governed admission. If governance cannot be verified — including
//       "the audit store is down" — the request is REFUSED. Safety first.
//       There is no degraded-admission path in this posture: the audit gate is
//       built with a queue-free admission strategy that has no queue reference
//       to reach (see audit-gate.service.ts), so the fallback is absent from
//       the object graph rather than switched off by a flag.
//
// THREE RULES THIS MODULE EXISTS TO ENFORCE
//  1. The posture is a DECLARED property supplied where the audit gate and the
//     model proxy are constructed. It is never derived from an environment
//     variable, never taken from a request field, and never defaulted.
//  2. A missing or unparseable posture is a CONSTRUCTION-TIME error, so an
//     installation that forgot to declare one cannot start and silently behave
//     like the more permissive posture.
//  3. One posture may not impersonate the other: every audit receipt records
//     the posture that produced it, and the readiness/liveness surfaces report
//     the posture the process is actually running.

import { z } from "zod";

export const CAIO_DEPLOYMENT_POSTURES = [
  "self_service",
  "governed_fde",
] as const;

export const caioDeploymentPostureSchema = z.enum(CAIO_DEPLOYMENT_POSTURES);

export type CaioDeploymentPosture = z.infer<
  typeof caioDeploymentPostureSchema
>;

/**
 * Raised when a posture is absent, empty, or outside the closed vocabulary.
 * Deliberately a construction-time failure: there is no "assume the safe one"
 * fallback, because guessing `governed_fde` would silently break a
 * self-service install and guessing `self_service` would silently weaken a
 * governed one.
 */
export class CaioDeploymentPostureError extends Error {
  readonly code = "caio_deployment_posture_invalid";

  constructor(detail: string) {
    super(`caio_deployment_posture_invalid: ${detail}`);
    this.name = "CaioDeploymentPostureError";
  }
}

export function isCaioDeploymentPosture(
  value: unknown,
): value is CaioDeploymentPosture {
  return caioDeploymentPostureSchema.safeParse(value).success;
}

/**
 * Parse a declared posture. Throws CaioDeploymentPostureError for anything
 * that is not exactly one of the two vocabulary members — including
 * `undefined`, so an omitted declaration fails closed in JavaScript callers
 * that TypeScript cannot check.
 */
export function parseCaioDeploymentPosture(
  value: unknown,
): CaioDeploymentPosture {
  const parsed = caioDeploymentPostureSchema.safeParse(value);
  if (!parsed.success) {
    throw new CaioDeploymentPostureError(
      `posture must be declared as one of ${CAIO_DEPLOYMENT_POSTURES.join(
        " | ",
      )}`,
    );
  }
  return parsed.data;
}
