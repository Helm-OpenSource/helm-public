import { runHelmV22ContinuitySubgroupDriftAgingMaterialImpactAuditEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuitySubgroupDriftAgingMaterialImpactAuditEvalHarness();

console.log(JSON.stringify(summary, null, 2));
