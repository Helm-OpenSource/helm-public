import { runAskHelmContextPacketEval } from "@/lib/evals/ask-helm-context-packet-evals";

const summary = runAskHelmContextPacketEval();

console.log(JSON.stringify(summary, null, 2));

if (!summary.passed) {
  process.exitCode = 1;
}
