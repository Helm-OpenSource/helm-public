import { readFileSync } from "node:fs";

import {
  evaluateHarnessP3Readiness,
  type HarnessP3ReadinessEvidence,
  validateHarnessP3ReadinessReportBinding,
} from "../lib/operating-harness/p3-readiness";
import { syntheticCurrentP3ReadinessEvidence } from "../lib/operating-harness/p3-readiness-fixtures";

export function main(args = process.argv.slice(2)): number {
  const requireReady = args.includes("--require-ready");
  const unknownFlags = args.filter(
    (arg) => arg.startsWith("--") && arg !== "--require-ready",
  );
  const inputPaths = args.filter((arg) => !arg.startsWith("--"));

  if (unknownFlags.length > 0 || inputPaths.length > 1) {
    console.error(
      "Usage: tsx scripts/operating-harness-p3-readiness-eval.ts [evidence.json] [--require-ready]",
    );
    return 1;
  }

  const inputPath = inputPaths[0];
  const evidence: HarnessP3ReadinessEvidence = inputPath
    ? (JSON.parse(readFileSync(inputPath, "utf8")) as HarnessP3ReadinessEvidence)
    : syntheticCurrentP3ReadinessEvidence();
  const report = evaluateHarnessP3Readiness(evidence);
  const binding = validateHarnessP3ReadinessReportBinding({ report, evidence });

  console.log(JSON.stringify({ report, binding }, null, 2));

  if (!binding.ok) return 1;
  if (!inputPath && report.decision !== "not_ready") {
    console.error("Default public synthetic evidence must remain not_ready.");
    return 1;
  }
  if (requireReady && report.decision !== "ready_for_p3_design_review") {
    console.error("P3 readiness is required but the evidence remains not_ready.");
    return 1;
  }
  return 0;
}

process.exitCode = main();
