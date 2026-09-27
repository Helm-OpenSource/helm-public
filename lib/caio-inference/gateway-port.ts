import "server-only";

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import type { CaioInferenceJobPort } from "@/lib/caio-access-gateway/gateway-http-core";

import {
  claimCaioInferenceJob,
  submitCaioInferenceJudgement,
  type CaioInferenceDispatchPort,
} from "./job-store.service";
import type { CaioInferenceProviderEvidence } from "./contracts";

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
        evidence: request.evidence,
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
  evidence: CaioInferenceProviderEvidence;
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
    evidence: {
      usage: parseUsage(body.usage),
      providerRequestRef: parseProviderRequestRef(body.providerRequestRef),
    },
  };
}

/** Upper bound per call; far above any route's token ceiling, low enough to keep cost arithmetic exact. */
const MAX_REPORTED_TOKENS = 10_000_000;
const PROVIDER_REQUEST_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;

/**
 * Token usage is optional on the wire (an on-premises model may not report it). When present it must be
 * exactly `{inputTokens, outputTokens}` as bounded non-negative integers; anything else is a malformed request,
 * never silently treated as "no usage" — that would let a remote call be recorded as free.
 */
function parseUsage(value: unknown): CaioInferenceProviderEvidence["usage"] {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new CaioAccessGatewayError("bad_request");
  const usage = value as Record<string, unknown>;
  const keys = Object.keys(usage);
  if (keys.length !== 2 || !keys.includes("inputTokens") || !keys.includes("outputTokens")) {
    throw new CaioAccessGatewayError("bad_request");
  }
  const tokens = (count: unknown) => {
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || count > MAX_REPORTED_TOKENS) {
      throw new CaioAccessGatewayError("bad_request");
    }
    return count;
  };
  return { inputTokens: tokens(usage.inputTokens), outputTokens: tokens(usage.outputTokens) };
}

function parseProviderRequestRef(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !PROVIDER_REQUEST_REF_RE.test(value)) {
    throw new CaioAccessGatewayError("bad_request");
  }
  return value;
}

const MAX_IDENTIFIER_LENGTH = 200;

function requireIdentifier(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH) {
    throw new CaioAccessGatewayError("bad_request");
  }
  return value;
}
