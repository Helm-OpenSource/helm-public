import { runPackFixtureCheck } from "@/lib/delivery-engineer/pack-fixture-check";

function parsePackPath(argv: readonly string[]): string | undefined {
  const flagIndex = argv.findIndex((arg) => arg === "--pack");
  if (flagIndex >= 0 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1];
  }

  const inline = argv.find((arg) => arg.startsWith("--pack="));
  return inline ? inline.slice("--pack=".length) : undefined;
}

function main() {
  const summary = runPackFixtureCheck({
    packPath: parsePackPath(process.argv.slice(2)),
  });
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
