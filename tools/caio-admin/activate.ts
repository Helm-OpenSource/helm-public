/**
 * caio-admin activate — phased activation with a hard order and per-phase
 * OWNER authorization. Phases activate strictly in sequence; skipping is
 * impossible and every activation writes a receipt via an injected port.
 */

import {
  type CaioAdminResult,
  blockedResult,
  failedResult,
  okResult,
} from "@/tools/caio-admin/contracts";

export const ACTIVATION_PHASES = ["proxy", "context", "audit"] as const;
export type ActivationPhase = (typeof ACTIVATION_PHASES)[number];

export interface OwnerAuthorization {
  authorized: boolean;
  receiptRef: string;
}

export interface ActivatePorts {
  /** Phases currently active, as recorded by the activation store. */
  getActivePhases(): Promise<ActivationPhase[]>;
  /**
   * OWNER confirmation for this specific phase. A phase can never activate
   * without a fresh authorized=true answer carrying a receipt reference.
   */
  confirmOwnerAuthorization(phase: ActivationPhase): Promise<OwnerAuthorization>;
  markPhaseActive(phase: ActivationPhase): Promise<void>;
  writeActivationReceipt(
    phase: ActivationPhase,
    receipt: { receiptRef: string; activatedAt: string },
  ): Promise<void>;
  now?: () => number;
}

export interface ActivateInput {
  phase: string;
  ports: ActivatePorts;
}

export function isActivationPhase(value: string): value is ActivationPhase {
  return (ACTIVATION_PHASES as readonly string[]).includes(value);
}

export async function caioAdminActivate(input: ActivateInput): Promise<CaioAdminResult> {
  const { phase, ports } = input;
  if (!isActivationPhase(phase)) {
    return failedResult("activate", {
      findings: [
        {
          checkKey: "phase",
          status: "fail",
          detail: `unknown phase; expected one of ${ACTIVATION_PHASES.join(", ")}`,
        },
      ],
    });
  }

  const active = await ports.getActivePhases();
  const activeSet = new Set(active);

  // Idempotent re-run: already-active phase is a no-op success.
  if (activeSet.has(phase)) {
    return okResult("activate", {
      detail: { phase, alreadyActive: true, activePhases: [...activeSet] },
    });
  }

  // Sequence enforcement: every earlier phase must already be active.
  const index = ACTIVATION_PHASES.indexOf(phase);
  const missingPredecessors = ACTIVATION_PHASES.slice(0, index).filter(
    (p) => !activeSet.has(p),
  );
  if (missingPredecessors.length > 0) {
    return blockedResult("activate", "phase_order", {
      findings: [
        {
          checkKey: "phase_order",
          status: "fail",
          detail: `phase ${phase} requires ${missingPredecessors.join(", ")} to be active first`,
        },
      ],
      detail: { phase, missingPredecessors },
    });
  }

  const authorization = await ports.confirmOwnerAuthorization(phase);
  if (!authorization.authorized) {
    return blockedResult("activate", "owner_authorization_required", {
      detail: { phase },
    });
  }

  const now = ports.now ? ports.now() : Date.now();
  const activatedAt = new Date(now).toISOString();
  await ports.writeActivationReceipt(phase, {
    receiptRef: authorization.receiptRef,
    activatedAt,
  });
  await ports.markPhaseActive(phase);

  return okResult("activate", {
    receipts: [
      { receiptKey: `activation_${phase}`, ref: authorization.receiptRef, recordedAt: activatedAt },
    ],
    detail: { phase, alreadyActive: false, activePhases: [...activeSet, phase] },
  });
}
