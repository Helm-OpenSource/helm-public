import { readFileSync } from "node:fs";

import type { TemporalOperatingContextProjectionInput } from "../lib/operating-harness/context-contracts";
import {
  evaluateTemporalOperatingContext,
  type TemporalContextGoldenPack,
  validateTemporalContextEvaluationReportBinding,
} from "../lib/operating-harness/context-eval";
import {
  syntheticTemporalContextGoldenPack,
  syntheticTemporalOperatingContextInput,
} from "../lib/operating-harness/context-fixtures";

export function main(args = process.argv.slice(2)): number {
  if (args.length > 2 || args.some((arg) => arg.startsWith("--"))) {
    console.error(
      "Usage: tsx scripts/operating-harness-p3a-context-eval.ts [input.json] [goldens.json]",
    );
    return 1;
  }

  let input: TemporalOperatingContextProjectionInput;
  let goldenPack: TemporalContextGoldenPack;
  try {
    input = args[0]
      ? (JSON.parse(
          readFileSync(args[0], "utf8"),
        ) as TemporalOperatingContextProjectionInput)
      : syntheticTemporalOperatingContextInput();
    goldenPack = args[1]
      ? (JSON.parse(readFileSync(args[1], "utf8")) as TemporalContextGoldenPack)
      : syntheticTemporalContextGoldenPack();
  } catch {
    console.error("Unable to read or parse the context eval JSON input.");
    return 1;
  }

  const report = evaluateTemporalOperatingContext(input, goldenPack);
  const binding = validateTemporalContextEvaluationReportBinding({
    input,
    goldenPack,
    report,
  });
  console.log(JSON.stringify({ report, binding }, null, 2));
  return report.passed && binding.ok ? 0 : 1;
}

process.exitCode = main();
