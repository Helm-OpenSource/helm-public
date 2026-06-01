import { runDeliveryEngineerGoldenPathDoctor } from "@/lib/delivery-engineer/golden-path-doctor";

function main() {
  const summary = runDeliveryEngineerGoldenPathDoctor();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
