import "server-only";

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import type { CaioInferenceJobPort } from "@/lib/caio-access-gateway/gateway-http-core";

import {
  claimCaioInferenceJob,
  submitCaioInferenceJudgement,
  type CaioInferenceDispatchPort,
} from "./job-store.service";

/**
 * The pull inference queue, expressed as the gateway's job port.
 *
 * WHY THIS LIVES IN CORE. The port hands the deployment a raw `payload: unknown` and serializes whatever it
 * returns as the response body — which means whoever writes this adapter OWNS THE WIRE CONTRACT the device
 * worker speaks. Written per tenant, every tenant would re-derive the claim and submit shapes, and the
 * protocol would have no single owner to change. It is written once, here, beside the queue it speaks for.
 *
 * WHAT THIS ADAPTER DOES NOT DO. Authorization is already settled before the port is reached: the surface
 * fails closed on the inference feature flag, the `inference` audience and the `inference_worker` client
 * type. Repeating those checks here would add a second place to keep them in sync, so this module trusts
 * the principal it is handed and enforces only what it alone can see — the shape of the payload.
 *
 * THE WORKSPACE IS NEVER TAKEN FROM THE REQUEST. It comes from the authenticated principal. A worker that
 * asked for another workspace's queue by naming it in the body is exactly the request this refuses to
 * express: there is no field for it.
 */
export function createCaioInferenceGatewayPort(input: {
  dispatch: CaioInferenceDispatchPort;
  now?: () => Date;
}): CaioInferenceJobPort {
  const now = input.now ?? (() => new Date());
  return Object.freeze({
    claim: async ({ principal }) => {
      const claimed = await claimCaioInferenceJob({
        workspaceId: principal.workspaceId,
        dispatch: input.dispatch,
        now: now(),
      });
      if (claimed.status === "none") return { status: "none" };
      if (claimed.status === "rejected") {
        return { status: "rejected", jobId: claimed.jobId, code: claimed.code };
      }
      return {
        status: "claimed",
        jobId: claimed.jobId,
        claimToken: claimed.claimToken,
        inputHash: claimed.inputHash,
        // The wire carries an ISO instant, not a Date: the worker reads the lease as text and never
        // re-derives it from its own clock.
        leaseExpiresAt: claimed.leaseExpiresAt.toISOString(),
        input: claimed.input,
      };
    },
    submit: async ({ principal, payload }) => {
      const request = parseSubmitPayload(payload);
      const settled = await submitCaioInferenceJudgement({
        workspaceId: principal.workspaceId,
        jobId: request.jobId,
        claimToken: request.claimToken,
        inputHash: request.inputHash,
        output: request.output,
        dispatch: input.dispatch,
        now: now(),
      });
      if (settled.status === "rejected") {
        // The rejection code is a closed set the worker is expected to read; it names why this submission
        // was refused, never anything about the deployment behind it.
        return { status: "rejected", code: settled.code };
      }
      return { status: settled.status, judgementHash: settled.judgementHash };
    },
  });
}

type SubmitRequest = {
  jobId: string;
  claimToken: string;
  inputHash: string;
  output: unknown;
};

/**
 * The three identifiers must be present and non-empty strings; `output` is passed through untouched because
 * the queue validates it against the judgement contract, and re-shaping it here would let a malformed body
 * be rejected for the wrong reason.
 */
function parseSubmitPayload(payload: unknown): SubmitRequest {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new CaioAccessGatewayError("bad_request");
  }
  const body = payload as Record<string, unknown>;
  return {
    jobId: requireIdentifier(body.jobId),
    claimToken: requireIdentifier(body.claimToken),
    inputHash: requireIdentifier(body.inputHash),
    output: body.output,
  };
}

const MAX_IDENTIFIER_LENGTH = 200;

function requireIdentifier(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH) {
    throw new CaioAccessGatewayError("bad_request");
  }
  return value;
}
