import { runHelmV22ContinuitySubgroupDriftMaterialImpactAgingAuditRefinementEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuitySubgroupDriftMaterialImpactAgingAuditRefinementEvalHarness();

console.log(JSON.stringify(summary, null, 2));
