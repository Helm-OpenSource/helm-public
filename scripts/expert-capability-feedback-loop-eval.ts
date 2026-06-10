// Offline CLI for the Expert Capability Feedback Loop v0.1 evaluator.
// Reads public-safe synthetic packs and prints the dual verdict. No network, no model calls.
//
//   npm run eval:expert-capability-feedback-loop
//
// Exit code: 0 only when loop_compounding === "success"; otherwise 1.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "@/lib/expert-capability/evaluator";
import type { ASet, BSet, PreRegistration, RunInput } from "@/lib/expert-capability/contracts";

const here = path.dirname(fileURLToPath(import.meta.url));
const packsDir = path.resolve(here, "..", "templates", "expert-capability", "packs");

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(packsDir, name), "utf8")) as T;
}

function main() {
  const preRegistration = readJson<PreRegistration>("pre-registration.json");
  const runInput = readJson<RunInput>("run-input.json");
  const aSet = readJson<ASet>("a-correction-set.json");
  const bSet = readJson<BSet>("b-heldout-eval-set.json");

  const report = evaluate({ preRegistration, runInput, aSet, bSet });
  console.log(JSON.stringify(report, null, 2));

  console.log(
    `\nloop_compounding=${report.loopCompoundingDecision} ` +
      `expert_justified=${report.expertJustifiedDecision} ` +
      `candidate=${report.candidate.weighted.toFixed(3)} ` +
      `previous=${report.previous.weighted.toFixed(3)} ` +
      `rule=${report.ruleBaseline.weighted.toFixed(3)} ` +
      `boundary=${report.candidate.boundaryCorrectness}%`,
  );

  if (report.loopCompoundingDecision !== "success") {
    process.exitCode = 1;
  }
}

main();
