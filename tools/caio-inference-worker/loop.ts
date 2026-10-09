import { validateCaioLayeredJudgement } from "@/lib/caio-inference/layered-judgement";

import {
  CAIO_WORKER_MAX_OUTPUT_TOKENS,
  type CaioWorkerGatewayPort,
  type CaioWorkerLocalModelPort,
  type CaioWorkerLogPort,
  type CaioWorkerPassResult,
} from "./contracts";
import { buildCaioWorkerPrompt, CAIO_WORKER_DEFAULT_OUTPUT_LANGUAGE, type CaioWorkerOutputLanguage } from "./prompt";

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
  outputLanguage?: CaioWorkerOutputLanguage;
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

  let completion: Awaited<ReturnType<CaioWorkerLocalModelPort["complete"]>>;
  try {
    completion = await input.model.complete({
      prompt: buildCaioWorkerPrompt(claim.input, input.outputLanguage),
      maxOutputTokens: CAIO_WORKER_MAX_OUTPUT_TOKENS,
      ...signal,
    });
  } catch (error) {
    // The claim stays with the server until its lease ends; the worker neither resubmits nor releases it.
    const reason = errorReason(error);
    log({ event: "model_failed", jobId: claim.jobId, detail: reason });
    return { status: "model_failed", jobId: claim.jobId, reason };
  }

  const output = parseJson(completion.content);
  const validation = validateCaioLayeredJudgement(output, new Set(claim.input.evidenceRefs));
  if (!validation.ok) {
    log({ event: "local_validation_failed", jobId: claim.jobId, detail: validation.code });
  }
  // Report, never retry: a Chinese-configured worker that gets a mostly non-Chinese judgement logs it so the rate
  // is visible (owner 2026-09-29: the review must be Chinese), and submits it unchanged like any other answer.
  const language = input.outputLanguage ?? CAIO_WORKER_DEFAULT_OUTPUT_LANGUAGE;
  if (validation.ok && language === "zh-CN" && isMostlyNonChinese(judgementTexts(validation.value))) {
    log({ event: "output_language_mismatch", jobId: claim.jobId, detail: language });
  }

  const submitted = await input.gateway.submit({
    jobId: claim.jobId,
    claimToken: claim.claimToken,
    inputHash: claim.inputHash,
    output,
    // Usage is forwarded as-is so the server can price the call; the worker never computes a cost.
    ...(completion.usage ? { usage: completion.usage } : {}),
    ...(completion.providerRequestRef ? { providerRequestRef: completion.providerRequestRef } : {}),
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

type LayeredTexts = {
  facts: Array<{ statement: string }>;
  inferences: Array<{ statement: string }>;
  risks: Array<{ statement: string }>;
  unknowns: Array<{ statement: string }>;
  suggestions: Array<{ summary: string }>;
};

function judgementTexts(j: LayeredTexts): string[] {
  return [...j.facts, ...j.inferences, ...j.risks, ...j.unknowns].map((e) => e.statement).concat(j.suggestions.map((s) => s.summary));
}

/** True when fewer than 30% of the letters are CJK; ids, metric keys and numbers alone do not make text "English". */
export function isMostlyNonChinese(texts: readonly string[]): boolean {
  // Dotted/dashed identifiers (metric keys, evidence refs) are not prose in any language: drop them first.
  const joined = texts.join(" ").replace(/[A-Za-z0-9_]+(?:[.:_-][A-Za-z0-9_]+)+/gu, "");
  const letters = joined.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return false;
  const cjk = joined.match(/[\u4e00-\u9fff]/gu)?.length ?? 0;
  return cjk / letters < 0.3;
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
