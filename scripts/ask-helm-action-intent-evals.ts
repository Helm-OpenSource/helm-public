import { runAskHelmActionIntentEval } from "@/lib/evals/ask-helm-action-intent-evals";

const summary = runAskHelmActionIntentEval();

console.log(JSON.stringify(summary, null, 2));

if (!summary.meetsMinimumPassRate) {
  process.exit(1);
}
