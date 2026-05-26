#!/usr/bin/env tsx
import { existsSync, readFileSync, statSync } from "node:fs";

import {
  OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_BYTES,
  runOperatingSignalFlowRuntimeReadinessIntake,
  stringifyOperatingSignalFlowRuntimeReadinessIntakeResult,
} from "@/lib/evals/operating-signal-flow-runtime-readiness-intake";

function main() {
  const input = readInput(process.argv.slice(2));
  const result = runOperatingSignalFlowRuntimeReadinessIntake(input);

  console.log(
    stringifyOperatingSignalFlowRuntimeReadinessIntakeResult(result).trimEnd(),
  );
  process.exitCode = result.exitCode;
}

function readInput(args: string[]) {
  const inputIndex = args.indexOf("--input");
  if (inputIndex === -1) {
    return readFileSync(0, "utf8");
  }

  const inputPath = args[inputIndex + 1];
  if (!inputPath) {
    return "{";
  }
  try {
    if (!existsSync(inputPath)) {
      return "{";
    }
    const inputStat = statSync(inputPath);
    if (!inputStat.isFile()) {
      return "{";
    }
    if (
      inputStat.size > OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_BYTES
    ) {
      return " ".repeat(
        OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_BYTES + 1,
      );
    }
    return readFileSync(inputPath, "utf8");
  } catch {
    return "{";
  }
}

main();
