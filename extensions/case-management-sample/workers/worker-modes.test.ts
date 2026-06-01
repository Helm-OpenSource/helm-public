import { describe, expect, it } from "vitest";

import { enforceModeInvariants } from "./worker-modes";

describe("case-management-sample worker modes", () => {
  it("suppresses propose actions in observer mode", () => {
    const result = enforceModeInvariants(
      {
        proposalKind: "propose_assignment_recommendation",
        requiresApproval: true,
        commitment: "suggestion_only" as const,
        reasonChain: ["case needs an owner"],
      },
      "observer",
    );

    expect(result.requiresApproval).toBe(false);
    expect(result.suppressed).toBe(true);
    expect(result.reasonChain[0]).toContain("observer mode");
  });

  it("keeps read-only flags visible in observer mode", () => {
    const result = enforceModeInvariants(
      {
        proposalKind: "flag_boundary_review_required",
        requiresApproval: false,
        commitment: "suggestion_only" as const,
        reasonChain: ["boundary review required"],
      },
      "observer",
    );

    expect(result.suppressed).toBe(false);
    expect(result.mode).toBe("observer");
  });
});
