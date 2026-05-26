import {
  runCompanyMemoryFixtureEval,
  runCompanyMemoryAdoptionEval,
  runCompanyMemoryFourArmEval,
  runCompanyMemoryWorldModelEval,
  type CompanyMemoryEvalMode,
} from "@/lib/evals/company-memory-evals";

function resolveMode(argv: string[]): CompanyMemoryEvalMode {
  const modeArg = argv.find((arg) => arg.startsWith("--mode="));
  const mode = modeArg?.slice("--mode=".length) ?? "fixture";

  if (mode === "fixture" || mode === "four-arm" || mode === "economics" || mode === "world-model" || mode === "adoption") {
    return mode;
  }

  throw new Error(`Unsupported company memory eval mode: ${mode}`);
}

function main() {
  const mode = resolveMode(process.argv.slice(2));
  const summary =
    mode === "fixture"
      ? runCompanyMemoryFixtureEval()
      : mode === "world-model"
        ? runCompanyMemoryWorldModelEval()
        : mode === "adoption"
          ? runCompanyMemoryAdoptionEval()
          : runCompanyMemoryFourArmEval();
  const output = mode === "economics" && "economics" in summary
    ? summary.economics
    : summary;

  console.log(JSON.stringify(output, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
