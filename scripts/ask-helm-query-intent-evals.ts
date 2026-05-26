import { runAskHelmQueryIntentEval } from "@/lib/evals/ask-helm-query-intent-evals";

const summary = runAskHelmQueryIntentEval();

console.log(JSON.stringify(summary, null, 2));

if (!summary.meetsMinimumPassRate) {
  process.exit(1);
}
