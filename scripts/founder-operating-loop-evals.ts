import fs from "node:fs";
import path from "node:path";

import {
  runFounderOperatingLoopEval,
  type FounderFixturePack,
} from "@/lib/evals/founder-operating-loop-evals";

function parseFixturePath(argv: readonly string[]): string | null {
  const flagIndex = argv.findIndex((arg) => arg === "--fixture");
  if (flagIndex >= 0 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1];
  }
  const inline = argv.find((arg) => arg.startsWith("--fixture="));
  if (inline) {
    return inline.slice("--fixture=".length);
  }
  return null;
}

function loadFixture(fixturePath: string): FounderFixturePack {
  const resolved = path.isAbsolute(fixturePath)
    ? fixturePath
    : path.resolve(process.cwd(), fixturePath);
  const raw = fs.readFileSync(resolved, "utf8");
  return JSON.parse(raw) as FounderFixturePack;
}

function main() {
  const fixturePath = parseFixturePath(process.argv.slice(2));
  const summary = fixturePath
    ? runFounderOperatingLoopEval(loadFixture(fixturePath))
    : runFounderOperatingLoopEval();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
