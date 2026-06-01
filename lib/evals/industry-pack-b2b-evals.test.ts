import { describe, expect, it } from "vitest";

import fixturePack from "@/evals/industry-pack-b2b/b2b-sales-advancement-pack-cases.json";
import {
  runIndustryPackB2BEval,
  type IndustryPackB2BFixturePack,
} from "@/lib/evals/industry-pack-b2b-evals";

const pack = fixturePack as IndustryPackB2BFixturePack;

describe("industry pack b2b offline eval", () => {
  it("passes the checked-in B2B Sales Advancement pack fixture gate", () => {
    const summary = runIndustryPackB2BEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalPackFixtures).toBe(12);
    expect(summary.totalCoreCompatFixtures).toBe(2);
    expect(summary.routeCount).toBe(9);
    expect(summary.coreRouteCount).toBe(2);
    expect(summary.connectorRuntimeApiUiSchemaCapabilityCount).toBe(0);
    expect(summary.rawPiiFieldCount).toBe(0);
    expect(summary.customerIdentifiableTextFieldCount).toBe(0);
    expect(summary.failures).toEqual([]);
  });

  it("keeps Pack A relationship review-first and per-signal", () => {
    expect(pack.pack.relationshipToPackA).toMatchObject({
      mode: "coexist_then_upgrade",
      supersedeGranularity: "per_signal",
      coreDedupRequired: true,
      silentOverlapAllowed: false,
    });
    expect(pack.pack.relationshipToPackA.supersedesOnlyAfter).toEqual([
      "manifest_review_passed",
      "offline_eval_passed",
      "no_go_gate_passed",
      "owner_acceptance",
    ]);
  });

  it("rejects weakened manifest contract fields", () => {
    const brokenPack: IndustryPackB2BFixturePack = {
      ...pack,
      pack: {
        ...pack.pack,
        actionTemplates: pack.pack.actionTemplates.filter((item) => item !== "prepare_owner_handoff"),
      },
    };

    const summary = runIndustryPackB2BEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "manifest_contract",
          reason: expect.stringContaining("prepare_owner_handoff"),
        }),
      ]),
    );
  });

  it("rejects raw proper-name and phone-like values even under allowed keys", () => {
    const brokenPack: IndustryPackB2BFixturePack = {
      ...pack,
      packFixtures: pack.packFixtures.map((fixture) =>
        fixture.fixtureId === "b2b_advancement_001"
          ? {
              ...fixture,
              inputObjects: [
                {
                  ...fixture.inputObjects[0],
                  fields: {
                    ...fixture.inputObjects[0].fields,
                    sourceAlias: "Acme Corporation",
                    sourceCode: "+1 415 555 1212",
                  },
                },
                ...fixture.inputObjects.slice(1),
              ],
            }
          : fixture,
      ),
    };

    const summary = runIndustryPackB2BEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "no_raw_pii_fields",
        }),
      ]),
    );
  });

  it("keeps every pack fixture mapped to exactly one routing route", () => {
    const routeFixtureIds = pack.routingMatrix.flatMap((route) => route.fixtureIds);
    const routeFixtureIdSet = new Set(routeFixtureIds);

    expect(routeFixtureIds).toHaveLength(pack.packFixtures.length);
    expect(routeFixtureIdSet.size).toBe(pack.packFixtures.length);

    for (const fixture of pack.packFixtures) {
      expect(routeFixtureIdSet.has(fixture.fixtureId)).toBe(true);
    }
  });

  it("keeps Core compatibility fixtures out of Pack routing", () => {
    const packRouteFixtureIds = new Set(pack.routingMatrix.flatMap((route) => route.fixtureIds));

    for (const fixture of pack.coreCompatFixtures) {
      expect(packRouteFixtureIds.has(fixture.fixtureId)).toBe(false);
    }

    expect(pack.coreCompatFixtures[0]).toMatchObject({
      fixtureId: "core_compat_001",
      expectedPackSignals: [],
      expectedCoreGate: "tenant_overlay_narrowing_validator",
      expectedCoreDecision: "reject_overlay_broadening",
    });
  });

  it("denies customer-visible commitment and worker provenance gaps with internal records", () => {
    for (const fixtureId of ["b2b_advancement_006", "b2b_advancement_012"]) {
      const fixture = pack.packFixtures.find((item) => item.fixtureId === fixtureId);

      expect(fixture).toMatchObject({
        expectedRubricBranch: "deny",
        expectedProofPolicy: "denied_internal_record",
        expectedActionTemplate: "mark_internal_denied",
      });
    }
  });

  it("rejects a fixture missing a routing matrix row", () => {
    const brokenPack: IndustryPackB2BFixturePack = {
      ...pack,
      routingMatrix: pack.routingMatrix.filter((route) => route.routeId !== "R9"),
    };

    const summary = runIndustryPackB2BEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "routing_route_count",
        }),
        expect.objectContaining({
          checkName: "routing_matrix",
          fixtureId: "b2b_advancement_008",
        }),
      ]),
    );
  });

  it("rejects customer-identifiable fixture field keys", () => {
    const brokenPack: IndustryPackB2BFixturePack = {
      ...pack,
      packFixtures: pack.packFixtures.map((fixture) =>
        fixture.fixtureId === "b2b_advancement_001"
          ? {
              ...fixture,
              inputObjects: [
                {
                  ...fixture.inputObjects[0],
                  fields: {
                    ...fixture.inputObjects[0].fields,
                    customerName: "customer_alpha",
                  },
                },
                ...fixture.inputObjects.slice(1),
              ],
            }
          : fixture,
      ),
    };

    const summary = runIndustryPackB2BEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "no_customer_identifiable_text_fields",
        }),
      ]),
    );
  });

  it("rejects raw email-like fixture values", () => {
    const brokenPack: IndustryPackB2BFixturePack = {
      ...pack,
      packFixtures: pack.packFixtures.map((fixture) =>
        fixture.fixtureId === "b2b_advancement_002"
          ? {
              ...fixture,
              inputObjects: [
                {
                  ...fixture.inputObjects[0],
                  fields: {
                    ...fixture.inputObjects[0].fields,
                    sourceAlias: "person@example.com",
                  },
                },
                ...fixture.inputObjects.slice(1),
              ],
            }
          : fixture,
      ),
    };

    const summary = runIndustryPackB2BEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "no_raw_pii_fields",
        }),
      ]),
    );
  });
});
