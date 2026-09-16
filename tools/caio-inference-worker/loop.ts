import { validateCaioLayeredJudgement } from "@/lib/caio-inference/layered-judgement";

import {
  CAIO_WORKER_MAX_OUTPUT_TOKENS,
  type CaioWorkerGatewayPort,
  type CaioWorkerLocalModelPort,
  type CaioWorkerLogPort,
  type CaioWorkerPassResult,
} from "./contracts";
import { buildCaioWorkerPrompt } from "./prompt";

/**
 * One pass of the pull loop: probe, claim, complete, submit.
 *
 * Order matters. The probe runs BEFORE the claim, so an offline device never takes a job it cannot answer and
 * never burns the egress authorization that a claim spends. A model answer is submitted exactly as produced:
 * the worker validates it locally only to report what it saw, and never repairs, retries or reshapes it — the
 * server owns the verdict and the closed rejection code.
 */
export async function runCaioInferenceWorkerPass(input: {
  gateway: CaioWorkerGatewayPort;
  model: CaioWorkerLocalModelPort;
  log?: CaioWorkerLogPort;
  signal?: AbortSignal;
}): Promise<CaioWorkerPassResult> {
  const log = input.log ?? (() => undefined);
  const signal = input.signal ? { signal: input.signal } : {};

  let probe: Awaited<ReturnType<CaioWorkerLocalModelPort["probe"]>>;
  try {
    probe = await input.model.probe({ ...signal });
  } catch (error) {
    const reason = errorReason(error);
    log({ event: "offline", detail: reason });
    return { status: "offline", reason };
  }
  if (!probe.ready) {
    const reason = probe.detail ?? "local_model_not_ready";
    log({ event: "offline", detail: reason });
    return { status: "offline", reason };
  }

  const claim = await input.gateway.claim({ ...signal });
  if (!claim) {
    log({ event: "idle" });
    return { status: "idle" };
  }
  log({ event: "claimed", jobId: claim.jobId });

  let raw: string;
  try {
    raw = await input.model.complete({
      prompt: buildCaioWorkerPrompt(claim.input),
      maxOutputTokens: CAIO_WORKER_MAX_OUTPUT_TOKENS,
      ...signal,
    });
  } catch (error) {
    // The claim stays with the server until its lease ends; the worker neither resubmits nor releases it.
    const reason = errorReason(error);
    log({ event: "model_failed", jobId: claim.jobId, detail: reason });
    return { status: "model_failed", jobId: claim.jobId, reason };
  }

  const output = parseJson(raw);
  const validation = validateCaioLayeredJudgement(output, new Set(claim.input.evidenceRefs));
  if (!validation.ok) {
    log({ event: "local_validation_failed", jobId: claim.jobId, detail: validation.code });
  }

  const submitted = await input.gateway.submit({
    jobId: claim.jobId,
    claimToken: claim.claimToken,
    inputHash: claim.inputHash,
    output,
    ...signal,
  });
  log({ event: "submitted", jobId: claim.jobId, detail: submitted.status });
  return {
    status: "submitted",
    jobId: claim.jobId,
    serverStatus: submitted.status,
    serverCode: submitted.code ?? null,
    locallyValid: validation.ok,
  };
}

/** A model answer that is not JSON is submitted as the string it was; the server records the rejection. */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function errorReason(error: unknown): string {
  // Only a closed reason leaves the worker: a provider message may carry endpoint or credential detail.
  return error instanceof Error && error.name === "AbortError" ? "aborted" : "local_model_unavailable";
}
