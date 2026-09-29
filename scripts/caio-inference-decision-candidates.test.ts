import { describe, expect, it } from "vitest";

import {
  caioDecisionCandidateApplyRefusal,
  parseCaioInferenceDecisionCandidateArgs,
} from "./caio-inference-decision-candidates";

describe("caio-inference-decision-candidates CLI", () => {
  it("refuses --apply unless the switch is exactly \"true\", but still allows listing", () => {
    expect(caioDecisionCandidateApplyRefusal(true, {})).toBe("HELM_CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED_not_true");
    expect(caioDecisionCandidateApplyRefusal(true, { HELM_CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED: "1" })).not.toBeNull();
    expect(caioDecisionCandidateApplyRefusal(true, { HELM_CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED: "true" })).toBeNull();
    expect(caioDecisionCandidateApplyRefusal(false, {})).toBeNull();
  });

  it("parses arguments strictly", () => {
    expect(parseCaioInferenceDecisionCandidateArgs(["--workspace-id=w", "--portfolio-ref=opportunity:o", "--apply"])).toEqual({
      workspaceId: "w",
      portfolioRef: "opportunity:o",
      jobId: null,
      apply: true,
    });
    expect(parseCaioInferenceDecisionCandidateArgs(["--workspace-id=w"])).toEqual({ invalid: "workspace_id_and_portfolio_ref_required" });
  });
});
