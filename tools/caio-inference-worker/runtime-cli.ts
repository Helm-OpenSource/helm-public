#!/usr/bin/env node

import { runCaioInferenceWorkerRuntime } from "./runtime";

void runCaioInferenceWorkerRuntime(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    const reason =
      error instanceof Error && /^caio_inference_worker_[a-z_]+$/u.test(error.message)
        ? error.message
        : "caio_inference_worker_runtime_failed";
    process.stderr.write(`${reason}\n`);
    process.exitCode = 2;
  });
