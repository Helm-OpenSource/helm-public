/**
 * caio-inference-worker thin bin wrapper — pure over injected ports, like caio-admin and caio-connect.
 *
 * The concrete ports (an HTTPS client for the tenant access gateway, and an OpenAI-compatible client for the
 * local model) are supplied by the device packaging layer, which also holds the access material: this module
 * never reads a credential, never opens a socket and never calls process.exit itself.
 */

import { runCaioInferenceWorkerPass } from "./loop";
import type {
  CaioWorkerGatewayPort,
  CaioWorkerLocalModelPort,
  CaioWorkerLogPort,
  CaioWorkerPassResult,
} from "./contracts";

export const CAIO_INFERENCE_WORKER_COMMANDS = ["probe", "run-once", "run-loop"] as const;
export type CaioInferenceWorkerCommand = (typeof CAIO_INFERENCE_WORKER_COMMANDS)[number];

export const WORKER_EXIT_OK = 0;
export const WORKER_EXIT_FAILED = 2;
/** Offline is not a failure: the device is simply not ready, and the queue keeps the window. */
export const WORKER_EXIT_OFFLINE = 3;

export type CaioInferenceWorkerCliResult = {
  command: CaioInferenceWorkerCommand;
  status: "ok" | "offline" | "failed";
  passes: CaioWorkerPassResult[];
};

export type CaioInferenceWorkerCliDeps = {
  gateway: CaioWorkerGatewayPort;
  model: CaioWorkerLocalModelPort;
  log?: CaioWorkerLogPort;
  stdout: (text: string) => void;
  /** How many passes `run-loop` performs before returning; the packaging layer owns any sleeping. */
  loopPasses?: number;
  signal?: AbortSignal;
};

export function caioInferenceWorkerUsage(): string {
  return `usage: caio-inference-worker <${CAIO_INFERENCE_WORKER_COMMANDS.join("|")}> [--json]`;
}

export function caioInferenceWorkerExitCode(result: CaioInferenceWorkerCliResult): number {
  if (result.status === "ok") return WORKER_EXIT_OK;
  if (result.status === "offline") return WORKER_EXIT_OFFLINE;
  return WORKER_EXIT_FAILED;
}

export function isCaioInferenceWorkerCommand(value: string): value is CaioInferenceWorkerCommand {
  return (CAIO_INFERENCE_WORKER_COMMANDS as readonly string[]).includes(value);
}

export async function runCaioInferenceWorkerCli(
  argv: readonly string[],
  deps: CaioInferenceWorkerCliDeps,
): Promise<CaioInferenceWorkerCliResult | null> {
  const command = argv[0] ?? "";
  if (!isCaioInferenceWorkerCommand(command)) {
    deps.stdout(caioInferenceWorkerUsage());
    return null;
  }
  const signal = deps.signal ? { signal: deps.signal } : {};

  if (command === "probe") {
    const probe = await deps.model.probe({ ...signal }).catch(() => ({ ready: false, detail: "local_model_unavailable" }));
    const result: CaioInferenceWorkerCliResult = {
      command,
      status: probe.ready ? "ok" : "offline",
      passes: probe.ready ? [] : [{ status: "offline", reason: probe.detail ?? "local_model_not_ready" }],
    };
    deps.stdout(JSON.stringify(result));
    return result;
  }

  const passes: CaioWorkerPassResult[] = [];
  const limit = command === "run-once" ? 1 : Math.max(1, deps.loopPasses ?? 1);
  for (let index = 0; index < limit; index += 1) {
    const pass = await runCaioInferenceWorkerPass({
      gateway: deps.gateway,
      model: deps.model,
      ...(deps.log ? { log: deps.log } : {}),
      ...signal,
    });
    passes.push(pass);
    // Offline or an empty queue ends the round: there is nothing to pull and nothing to retry here.
    if (pass.status === "offline" || pass.status === "idle") break;
  }
  const last = passes[passes.length - 1]!;
  const result: CaioInferenceWorkerCliResult = {
    command,
    status: last.status === "offline" ? "offline" : last.status === "model_failed" ? "failed" : "ok",
    passes,
  };
  deps.stdout(JSON.stringify(result));
  return result;
}
