import { describe, expect, it } from "vitest";

import {
  assertGrowthDecisionIsNonPromoting,
  getIntelligenceGrowthDimensionDescriptor,
  INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS,
} from "./contracts";
import type { IntelligenceDimension } from "./types";

const ALL_DIMENSION_IDS: readonly IntelligenceDimension[] = [
  "context",
  "object_signal",
  "memory",
  "routing",
  "action_outcome",
  "worker_skill",
  "prompt_policy",
  "eval_replay",
  "tenant_personalization",
  "cost_model_tool",
];

const REQUIRED_NO_GO_BOUNDARIES = [
  "no_db_schema",
  "no_api",
  "no_ui",
  "no_production_prompt_change",
  "no_runtime_self_learning",
] as const;

describe("Intelligence Growth System contracts", () => {
  it("registers exactly 10 dimension descriptors", () => {
    expect(INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS).toHaveLength(10);
  });

  it("registers all 10 dimension IDs", () => {
    const registeredIds = INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS.map(
      (d) => d.id,
    );
    for (const id of ALL_DIMENSION_IDS) {
      expect(registeredIds).toContain(id);
    }
  });

  it("getIntelligenceGrowthDimensionDescriptor returns a descriptor for each dimension", () => {
    for (const id of ALL_DIMENSION_IDS) {
      const descriptor = getIntelligenceGrowthDimensionDescriptor(id);
      expect(descriptor.id).toBe(id);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.goal.length).toBeGreaterThan(0);
    }
  });

  it("getIntelligenceGrowthDimensionDescriptor throws for an unknown id", () => {
    expect(() =>
      getIntelligenceGrowthDimensionDescriptor("unknown" as IntelligenceDimension),
    ).toThrow();
  });

  describe("allowedDecisions excludes auto-promotion values", () => {
    const FORBIDDEN_DECISIONS = [
      "approved",
      "auto_promote",
      "production_ready",
      "active",
      "promoted",
    ];

    it.each(ALL_DIMENSION_IDS)(
      "dimension %s does not allow any promoting decision",
      (id) => {
        const descriptor = getIntelligenceGrowthDimensionDescriptor(id);
        for (const forbidden of FORBIDDEN_DECISIONS) {
          expect(descriptor.allowedDecisions).not.toContain(forbidden);
        }
      },
    );

    it.each(ALL_DIMENSION_IDS)(
      "dimension %s only allows the four safe decisions",
      (id) => {
        const descriptor = getIntelligenceGrowthDimensionDescriptor(id);
        expect(descriptor.allowedDecisions).toContain("learning_candidate");
        expect(descriptor.allowedDecisions).toContain("watch_only");
        expect(descriptor.allowedDecisions).toContain("review_required");
        expect(descriptor.allowedDecisions).toContain("rejected");
      },
    );
  });

  describe("noGoBoundaries include all five required boundaries", () => {
    it.each(ALL_DIMENSION_IDS)(
      "dimension %s includes all required no-go boundaries",
      (id) => {
        const descriptor = getIntelligenceGrowthDimensionDescriptor(id);
        for (const boundary of REQUIRED_NO_GO_BOUNDARIES) {
          expect(descriptor.noGoBoundaries).toContain(boundary);
        }
      },
    );
  });

  describe("assertGrowthDecisionIsNonPromoting", () => {
    it("passes through safe decisions unchanged", () => {
      expect(assertGrowthDecisionIsNonPromoting("learning_candidate")).toBe(
        "learning_candidate",
      );
      expect(assertGrowthDecisionIsNonPromoting("watch_only")).toBe(
        "watch_only",
      );
      expect(assertGrowthDecisionIsNonPromoting("review_required")).toBe(
        "review_required",
      );
      expect(assertGrowthDecisionIsNonPromoting("rejected")).toBe("rejected");
    });

    it.each([
      "approved",
      "auto_promote",
      "production_ready",
      "active",
      "promoted",
    ])(
      'throws for unsafe promoting value "%s" when cast to GrowthDecision',
      (unsafe) => {
        expect(() =>
          // Cast: simulates runtime data arriving with an unexpected value
          assertGrowthDecisionIsNonPromoting(unsafe as Parameters<typeof assertGrowthDecisionIsNonPromoting>[0]),
        ).toThrow(/auto-promotion/);
      },
    );
  });
});
