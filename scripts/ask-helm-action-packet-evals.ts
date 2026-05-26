import { runAskHelmActionPacketEval } from "@/lib/evals/ask-helm-action-packet-evals";

const summary = runAskHelmActionPacketEval();

console.log(JSON.stringify(summary, null, 2));

if (!summary.passed) {
  process.exitCode = 1;
}
