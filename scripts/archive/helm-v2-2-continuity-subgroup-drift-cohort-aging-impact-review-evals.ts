import { runHelmV22ContinuitySubgroupDriftCohortAgingImpactReviewEvalHarness } from "@/lib/helm-v2/eval-harness";

const summary = runHelmV22ContinuitySubgroupDriftCohortAgingImpactReviewEvalHarness();

console.log(JSON.stringify(summary, null, 2));
