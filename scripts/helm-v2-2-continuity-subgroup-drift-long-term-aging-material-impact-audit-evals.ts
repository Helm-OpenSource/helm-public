import { runHelmV22ContinuitySubgroupDriftLongTermAgingMaterialImpactAuditEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuitySubgroupDriftLongTermAgingMaterialImpactAuditEvalHarness();

console.log(JSON.stringify(summary, null, 2));
