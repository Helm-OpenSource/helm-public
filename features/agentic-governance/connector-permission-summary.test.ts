import { describe, expect, it } from "vitest";
import {
  CONNECTOR_PERMISSION_SUMMARIES,
  REQUIRED_CONNECTOR_PERMISSION_PROVIDERS,
  runConnectorPermissionSummaryEval,
  validateConnectorPermissionSummary,
} from "./connector-permission-summary";

describe("connector permission summary governance", () => {
  it("covers the current stable and alpha connector set", () => {
    expect(CONNECTOR_PERMISSION_SUMMARIES.map((summary) => summary.providerId).sort()).toEqual(
      [...REQUIRED_CONNECTOR_PERMISSION_PROVIDERS].sort(),
    );
  });

  it("keeps every connector on the auto / review / never permission lanes", () => {
    for (const summary of CONNECTOR_PERMISSION_SUMMARIES) {
      expect(summary.autoAllowed.length, summary.providerId).toBeGreaterThan(0);
      expect(summary.reviewRequired.length, summary.providerId).toBeGreaterThan(0);
      expect(summary.neverAllowed.length, summary.providerId).toBeGreaterThan(0);
      expect(summary.boundaryNote.trim(), summary.providerId).not.toBe("");
      expect(validateConnectorPermissionSummary(summary), summary.providerId).toEqual([]);
    }
  });

  it("keeps high-risk connector actions out of auto_allowed", () => {
    const summary = runConnectorPermissionSummaryEval();

    expect(summary.directSendAutoAllowed).toBe(0);
    expect(summary.crmWriteAutoAllowed).toBe(0);
    expect(summary.paymentAutoAllowed).toBe(0);
    expect(summary.allSummariesHaveThreeLanes).toBe(true);
    expect(summary.allCustomerVisibleActionsRequireReview).toBe(true);
    expect(summary.issueCount).toBe(0);
    expect(summary.overallPassed).toBe(true);
  });
});
