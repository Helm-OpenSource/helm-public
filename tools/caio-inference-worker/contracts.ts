import type { CaioInferenceInput } from "@/lib/caio-inference/contracts";

/**
 * Device-side pull inference worker contracts.
 *
 * The worker runs on the customer's own device. It holds one inference access material and nothing else: no
 * database handle, no business credential, no inbound listener. Every dependency is a port so the loop is
 * testable without a model, a network or a device.
 */

export type CaioWorkerClaim = {
  jobId: string;
  claimToken: string;
  inputHash: string;
  leaseExpiresAt: string;
  input: CaioInferenceInput;
};

export type CaioWorkerGatewayPort = {
  /** POST /v1/inference-jobs/claim — `null` means the queue had nothing to hand out. */
  claim: (input: { signal?: AbortSignal }) => Promise<CaioWorkerClaim | null>;
  /** POST /v1/inference-jobs/submit — the server decides; the worker never interprets the outcome. */
  submit: (input: {
    jobId: string;
    claimToken: string;
    inputHash: string;
    output: unknown;
    signal?: AbortSignal;
  }) => Promise<{ status: string; code?: string | null }>;
};

export type CaioWorkerLocalModelPort = {
  /** Cheap readiness probe against the local OpenAI-compatible endpoint. */
  probe: (input: { signal?: AbortSignal }) => Promise<{ ready: boolean; detail?: string }>;
  /** One completion for one prompt. The worker never retries a completion on its own. */
  complete: (input: { prompt: string; maxOutputTokens: number; signal?: AbortSignal }) => Promise<string>;
};

export type CaioWorkerLogPort = (event: {
  event: "offline" | "idle" | "claimed" | "submitted" | "local_validation_failed" | "model_failed";
  jobId?: string;
  detail?: string;
}) => void;

export type CaioWorkerPassResult =
  | { status: "offline"; reason: string }
  | { status: "idle" }
  | { status: "submitted"; jobId: string; serverStatus: string; serverCode: string | null; locallyValid: boolean }
  | { status: "model_failed"; jobId: string; reason: string };

export const CAIO_WORKER_MAX_OUTPUT_TOKENS = 1_200;
