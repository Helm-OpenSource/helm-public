import { readFileSync } from "node:fs";

import {
  evaluateHarnessP3Readiness,
  type HarnessP3ReadinessEvidence,
  validateHarnessP3ReadinessReportBinding,
} from "../lib/operating-harness/p3-readiness";
import { syntheticCurrentP3ReadinessEvidence } from "../lib/operating-harness/p3-readiness-fixtures";

const inputPath = process.argv[2];
const evidence: HarnessP3ReadinessEvidence = inputPath
  ? (JSON.parse(readFileSync(inputPath, "utf8")) as HarnessP3ReadinessEvidence)
  : syntheticCurrentP3ReadinessEvidence();
const report = evaluateHarnessP3Readiness(evidence);
const binding = validateHarnessP3ReadinessReportBinding({ report, evidence });

console.log(JSON.stringify({ report, binding }, null, 2));

if (!binding.ok) process.exitCode = 1;
if (!inputPath && report.decision !== "not_ready") {
  console.error("Default public synthetic evidence must remain not_ready.");
  process.exitCode = 1;
}
