import { describe, expect, it } from "vitest";

import channelPartnerCollaborationFixturePack from "@/evals/channel-partner-collaboration/channel-partner-collaboration-cases.json";
import {
  runChannelPartnerCollaborationEval,
  type ChannelPartnerCollaborationCase,
  type ChannelPartnerCollaborationFixturePack,
} from "@/lib/evals/channel-partner-collaboration-evals";

const DEFAULT_PACK =
  channelPartnerCollaborationFixturePack as ChannelPartnerCollaborationFixturePack;

function clonePack(): ChannelPartnerCollaborationFixturePack {
  return JSON.parse(JSON.stringify(DEFAULT_PACK)) as ChannelPartnerCollaborationFixturePack;
}

function findCase(
  pack: ChannelPartnerCollaborationFixturePack,
  id: string,
): ChannelPartnerCollaborationCase {
  const target = pack.cases.find((item) => item.id === id);
  if (!target) {
    throw new Error(`fixture case ${id} not found`);
  }
  return target;
}

describe("channel partner collaboration P0 offline eval", () => {
  it("passes the checked-in default fixture pack", () => {
    const summary = runChannelPartnerCollaborationEval();

    expect(summary.passed).toBe(true);
    expect(summary.version).toBe("channel-partner-collaboration-p0-v2.1");
    expect(summary.totalCases).toBe(23);

    expect(summary.unauthorizedAccessCount).toBe(0);
    expect(summary.outboundSendIncidentCount).toBe(0);
    expect(summary.disclosureMissingCount).toBe(0);
    expect(summary.attributionUniquenessViolations).toBe(0);
    expect(summary.partnerDataLeakedToCustomerWorkspaceCount).toBe(0);
    expect(summary.customerDataRawLeakedToPartnerCount).toBe(0);
    expect(summary.directRecommendationCreationByPartnerCount).toBe(0);
    expect(summary.askHelmAccessByPartnerCount).toBe(0);
    expect(summary.crossTenantHelperLeakCount).toBe(0);
    expect(summary.directSourceTableReadCount).toBe(0);
    expect(summary.missingGrantAcceptedCount).toBe(0);
    expect(summary.unauthorizedNudgeAcceptanceCount).toBe(0);
    expect(summary.schemaRuntimeApiUiIncidentCount).toBe(0);
    expect(summary.partnerWorkspaceRuntimeIncidentCount).toBe(0);

    expect(summary.allowedCaseCount).toBeGreaterThan(0);
    expect(summary.rejectedCaseCount).toBeGreaterThan(0);
    expect(summary.allowedCaseCount + summary.rejectedCaseCount).toBe(summary.totalCases);

    expect(summary.nudgeLifecycleCoverageCount).toBeGreaterThanOrEqual(
      DEFAULT_PACK.targets.minimumNudgeLifecycleCoverageCount,
    );
    expect(summary.revocationCoverageCount).toBeGreaterThanOrEqual(
      DEFAULT_PACK.targets.minimumRevocationCoverageCount,
    );
    expect(summary.attributionLedgerAnchorCoverageCount).toBeGreaterThanOrEqual(
      DEFAULT_PACK.targets.minimumAttributionLedgerAnchorCoverageCount,
    );
    expect(summary.partnerSafeDtoCoverageCount).toBeGreaterThanOrEqual(
      DEFAULT_PACK.targets.minimumPartnerSafeDtoCoverageCount,
    );

    expect(summary.failures).toEqual([]);
  });

  it("fails when a case mutates to mark a missing grant as accepted", () => {
    const mutated = clonePack();
    const target = findCase(mutated, "CP-001-GRANT-MISSING-REJECT");
    target.expect.outcome = "allowed";
    target.expect.flags = {
      ...(target.expect.flags ?? {}),
      missingGrantAccepted: true,
    };

    const summary = runChannelPartnerCollaborationEval(mutated);

    expect(summary.passed).toBe(false);
    expect(summary.missingGrantAcceptedCount).toBe(1);
    expect(
      summary.failures.some((entry) => entry.reason.startsWith("missing_grant_accepted_count_exceeds")),
    ).toBe(true);
  });

  it("fails when a direct raw source-table read is incorrectly marked allowed", () => {
    const mutated = clonePack();
    const target = findCase(mutated, "CP-004-DIRECT-SOURCE-TABLE-READ-REJECT");
    target.expect.outcome = "allowed";
    target.expect.flags = {};

    const summary = runChannelPartnerCollaborationEval(mutated);

    expect(summary.passed).toBe(false);
    expect(summary.directSourceTableReadCount).toBe(1);
    expect(
      summary.failures.some((entry) =>
        entry.reason.startsWith("direct_source_table_read_count_exceeds"),
      ),
    ).toBe(true);
  });

  it("fails when fixture metadata drops the P0-REQ-08 scope marker", () => {
    const mutated = clonePack();
    mutated.scope = "P1-REQ-08";

    const summary = runChannelPartnerCollaborationEval(mutated);

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((entry) => entry.reason.startsWith("metadata_scope_must_be_P0-REQ-08")),
    ).toBe(true);
  });

  it("fails when fixture drifts into runtime substrings", () => {
    const mutated = clonePack();
    const firstCase = mutated.cases[0]!;
    (firstCase as Record<string, unknown>)["__drift__"] = [
      "import { db } from '",
      "@/lib/db",
      "'",
    ].join("");

    const summary = runChannelPartnerCollaborationEval(mutated);

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((entry) =>
        entry.reason.startsWith("fixture_contains_forbidden_runtime_substring"),
      ),
    ).toBe(true);
  });
});
