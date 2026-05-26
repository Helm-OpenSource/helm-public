import { runCommercialPromotionPackEval } from "@/lib/evals/commercial-promotion-pack-evals";

function main() {
  const summary = runCommercialPromotionPackEval();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

main();
