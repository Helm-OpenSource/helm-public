// IGS P0 Slice C — offline evaluator CLI.
// Reads fixture JSON files only. No DB, no fetch, no LLM APIs.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  DIMENSION_FIXTURE_MAP,
  runEval,
} from "@/lib/intelligence-growth/evaluator";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

// ── Arg parsing ────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  dimension?: IntelligenceDimension;
  inputFile?: string;
  outputJson?: string;
} {
  const result: {
    dimension?: IntelligenceDimension;
    inputFile?: string;
    outputJson?: string;
  } = {};

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dimension" && argv[i + 1]) {
      result.dimension = argv[++i] as IntelligenceDimension;
    } else if (argv[i] === "--input-file" && argv[i + 1]) {
      result.inputFile = argv[++i];
    } else if (argv[i] === "--output-json" && argv[i + 1]) {
      result.outputJson = argv[++i];
    }
  }

  return result;
}

// ── Human summary printer ─────────────────────────────────────────────────────

function printSummary(
  report: ReturnType<typeof runEval>,
  outputJson?: string,
): void {
  console.log("\n═══ Intelligence Growth Offline Eval ═══");
  console.log(`runAt: ${report.runAt}`);
  console.log(
    `runtimeAdoptionAllowed: ${String(report.summary.runtimeAdoptionAllowed)}`,
  );
  console.log(`reviewFirstStatus: ${report.summary.reviewFirstStatus}`);
  console.log(`autoPromoteCount: ${report.summary.autoPromoteCount}`);
  console.log(`productionWriteCount: ${report.summary.productionWriteCount}`);
  console.log("─────────────────────────────────────────");

  for (const d of report.dimensions) {
    const status = d.failed === 0 ? "✓" : "✗";
    console.log(
      `${status}  ${d.dimension.padEnd(25)} total=${d.total}  passed=${d.passed}  failed=${d.failed}  boundaryViolations=${d.boundaryViolations}`,
    );
  }

  console.log("─────────────────────────────────────────");

  if (report.failures.length > 0) {
    console.log("\nFAILURES:");
    for (const f of report.failures) {
      console.log(`  [${f.id}] ${f.file}`);
      console.log(`    reason: ${f.reason}`);
    }
    console.log("");
  }

  console.log(
    `SUMMARY  total=${report.summary.total}  passed=${report.summary.totalPassed}  failed=${report.summary.totalFailed}`,
  );

  if (outputJson) {
    console.log(`\nReport written to: ${outputJson}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  // Validate dimension if provided
  if (
    args.dimension &&
    !(args.dimension in DIMENSION_FIXTURE_MAP)
  ) {
    console.error(`[IGS eval] Unknown dimension: "${args.dimension}"`);
    console.error(
      `Valid dimensions: ${Object.keys(DIMENSION_FIXTURE_MAP).join(", ")}`,
    );
    process.exit(1);
  }

  const report = runEval({
    dimension: args.dimension,
    inputFile: args.inputFile,
  });

  // Write JSON report if requested
  if (args.outputJson) {
    const absOut = path.isAbsolute(args.outputJson)
      ? args.outputJson
      : path.join(process.cwd(), args.outputJson);
    const dir = path.dirname(absOut);
    mkdirSync(dir, { recursive: true });
    writeFileSync(absOut, JSON.stringify(report, null, 2), "utf8");
  }

  printSummary(report, args.outputJson);

  if (report.summary.totalFailed > 0) {
    process.exit(1);
  }
}

main();
