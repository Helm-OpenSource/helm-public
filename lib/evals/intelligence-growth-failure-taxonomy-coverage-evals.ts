import { readFileSync } from "node:fs";
import path from "node:path";
import mappingFixtureData from "@/evals/intelligence-growth-failure-taxonomy/failure-taxonomy-coverage-mapping.json";
import actionOutcomeCases from "@/evals/intelligence-growth/action-outcome/action-outcome-cases.json";
import contextCases from "@/evals/intelligence-growth/context/context-growth-cases.json";
import costModelToolCases from "@/evals/intelligence-growth/cost-model-tool/cost-model-tool-cases.json";
import evalReplayCases from "@/evals/intelligence-growth/eval-replay/eval-replay-growth-cases.json";
import memoryCases from "@/evals/intelligence-growth/memory/memory-growth-cases.json";
import objectSignalCases from "@/evals/intelligence-growth/object-signal/object-signal-growth-cases.json";
import promptPolicyCases from "@/evals/intelligence-growth/prompt-policy/prompt-policy-growth-cases.json";
import routingCases from "@/evals/intelligence-growth/routing/routing-growth-cases.json";
import tenantPersonalizationCases from "@/evals/intelligence-growth/tenant-personalization/tenant-personalization-cases.json";
import workerSkillCases from "@/evals/intelligence-growth/worker-skill/worker-skill-growth-cases.json";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

export type IntelligenceGrowthFailureTaxonomyMappingEntry = {
  readonly fixtureId: string;
  readonly dimension: IntelligenceDimension;
  readonly failureType: string;
};

export type IntelligenceGrowthFailureTaxonomyDimensionDoc = {
  readonly dimension: IntelligenceDimension;
  readonly path: string;
};

export type IntelligenceGrowthFailureTaxonomyMappingFixture = {
  readonly version: string;
  readonly expectedDimensionCount: number;
  readonly expectedTaxonomyRowsPerDimension: number;
  readonly expectedNegativeFixtureCount: number;
  readonly dimensionTaxonomyDocs: readonly IntelligenceGrowthFailureTaxonomyDimensionDoc[];
  readonly mappings: readonly IntelligenceGrowthFailureTaxonomyMappingEntry[];
};

type CoreFixtureCase = {
  readonly id: string;
  readonly dimension: IntelligenceDimension;
  readonly isNegativeBoundary?: boolean;
};

export type IntelligenceGrowthFailureTaxonomyCoverageEvalOptions = {
  readonly root?: string;
  readonly mappingFixture?: IntelligenceGrowthFailureTaxonomyMappingFixture;
  readonly coreFixtures?: Partial<Record<IntelligenceDimension, readonly CoreFixtureCase[]>>;
  readonly taxonomyTexts?: Partial<Record<IntelligenceDimension, string>>;
};

export type IntelligenceGrowthFailureTaxonomyCoverageFailure = {
  readonly source: string;
  readonly reason: string;
};

export type IntelligenceGrowthFailureTaxonomyCoverageSummary = {
  readonly passed: boolean;
  readonly dimensionCount: number;
  readonly expectedDimensionCount: number;
  readonly taxonomyRowCount: number;
  readonly expectedTaxonomyRowCount: number;
  readonly negativeFixtureCount: number;
  readonly mappedNegativeFixtureCount: number;
  readonly negativeFixtureCoveragePercent: number;
  readonly unmappedNegativeFixtureCount: number;
  readonly orphanMappingCount: number;
  readonly unknownFailureTypeCount: number;
  readonly positiveFixtureMappingCount: number;
  readonly malformedTaxonomyRowCount: number;
  readonly duplicateFailureTypeCount: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly failureCount: number;
  readonly failures: readonly IntelligenceGrowthFailureTaxonomyCoverageFailure[];
};

export const DEFAULT_FAILURE_TAXONOMY_COVERAGE_MAPPING =
  mappingFixtureData as IntelligenceGrowthFailureTaxonomyMappingFixture;

const DEFAULT_CORE_FIXTURES: Record<IntelligenceDimension, readonly CoreFixtureCase[]> = {
  context: contextCases as readonly CoreFixtureCase[],
  object_signal: objectSignalCases as readonly CoreFixtureCase[],
  memory: memoryCases as readonly CoreFixtureCase[],
  routing: routingCases as readonly CoreFixtureCase[],
  action_outcome: actionOutcomeCases as readonly CoreFixtureCase[],
  worker_skill: workerSkillCases as readonly CoreFixtureCase[],
  prompt_policy: promptPolicyCases as readonly CoreFixtureCase[],
  eval_replay: evalReplayCases as readonly CoreFixtureCase[],
  tenant_personalization: tenantPersonalizationCases as readonly CoreFixtureCase[],
  cost_model_tool: costModelToolCases as readonly CoreFixtureCase[],
};

const MACHINE_SAFE_FAILURE_TYPE = /^[a-z][a-z0-9_]*$/;

export function runIntelligenceGrowthFailureTaxonomyCoverageEval(
  options: IntelligenceGrowthFailureTaxonomyCoverageEvalOptions = {},
): IntelligenceGrowthFailureTaxonomyCoverageSummary {
  const root = options.root ?? process.cwd();
  const fixture = options.mappingFixture ?? DEFAULT_FAILURE_TAXONOMY_COVERAGE_MAPPING;
  const coreFixtures = { ...DEFAULT_CORE_FIXTURES, ...(options.coreFixtures ?? {}) };
  const taxonomyTexts = options.taxonomyTexts ?? {};
  const failures: IntelligenceGrowthFailureTaxonomyCoverageFailure[] = [];

  const dimensionTaxonomies = new Map<IntelligenceDimension, Set<string>>();
  let taxonomyRowCount = 0;
  let malformedTaxonomyRowCount = 0;
  let duplicateFailureTypeCount = 0;

  for (const doc of fixture.dimensionTaxonomyDocs) {
    const overrideText = taxonomyTexts[doc.dimension];
    const text = overrideText ?? readTaxonomyDoc(root, doc.path, failures);
    if (text === null) {
      dimensionTaxonomies.set(doc.dimension, new Set());
      continue;
    }
    const parseResult = parseTaxonomyTable(text);
    const knownTypes = new Set<string>();
    for (const row of parseResult.rows) {
      taxonomyRowCount += 1;
      const failureType = row.failureType;
      if (
        !MACHINE_SAFE_FAILURE_TYPE.test(failureType) ||
        row.description.length === 0 ||
        row.expectedHandling.length === 0 ||
        row.notAllowed.length === 0
      ) {
        malformedTaxonomyRowCount += 1;
        failures.push({
          source: doc.dimension + ":" + (failureType || "<empty>"),
          reason: "malformed_taxonomy_row",
        });
        continue;
      }
      if (knownTypes.has(failureType)) {
        duplicateFailureTypeCount += 1;
        failures.push({
          source: doc.dimension + ":" + failureType,
          reason: "duplicate_failure_type",
        });
        continue;
      }
      knownTypes.add(failureType);
    }
    if (parseResult.rows.length !== fixture.expectedTaxonomyRowsPerDimension) {
      failures.push({
        source: doc.dimension + ":row_count=" + parseResult.rows.length,
        reason: "taxonomy_row_count_mismatch",
      });
    }
    dimensionTaxonomies.set(doc.dimension, knownTypes);
  }

  if (fixture.dimensionTaxonomyDocs.length !== fixture.expectedDimensionCount) {
    failures.push({
      source: "taxonomy_docs:" + fixture.dimensionTaxonomyDocs.length,
      reason: "dimension_count_mismatch",
    });
  }

  const expectedNegativeFixtureIds = new Set<string>();
  for (const dimension of Object.keys(coreFixtures) as IntelligenceDimension[]) {
    const cases = coreFixtures[dimension] ?? [];
    for (const item of cases) {
      if (item.isNegativeBoundary === true) {
        expectedNegativeFixtureIds.add(dimension + ":" + item.id);
      }
    }
  }

  const positiveFixtureIds = new Set<string>();
  for (const dimension of Object.keys(coreFixtures) as IntelligenceDimension[]) {
    const cases = coreFixtures[dimension] ?? [];
    for (const item of cases) {
      if (item.isNegativeBoundary !== true) {
        positiveFixtureIds.add(dimension + ":" + item.id);
      }
    }
  }

  const mappedNegativeKeys = new Set<string>();
  let positiveFixtureMappingCount = 0;
  let orphanMappingCount = 0;
  let unknownFailureTypeCount = 0;
  const seenMappingKeys = new Set<string>();

  for (const mapping of fixture.mappings) {
    const compositeKey = mapping.dimension + ":" + mapping.fixtureId;
    if (seenMappingKeys.has(compositeKey)) {
      failures.push({
        source: compositeKey,
        reason: "duplicate_mapping_entry",
      });
      continue;
    }
    seenMappingKeys.add(compositeKey);

    if (positiveFixtureIds.has(compositeKey)) {
      positiveFixtureMappingCount += 1;
      failures.push({
        source: compositeKey,
        reason: "positive_fixture_mapping",
      });
      continue;
    }

    if (!expectedNegativeFixtureIds.has(compositeKey)) {
      orphanMappingCount += 1;
      failures.push({
        source: compositeKey,
        reason: "orphan_mapping",
      });
      continue;
    }

    const knownTypes = dimensionTaxonomies.get(mapping.dimension);
    if (!knownTypes || !knownTypes.has(mapping.failureType)) {
      unknownFailureTypeCount += 1;
      failures.push({
        source: compositeKey + ":" + mapping.failureType,
        reason: "unknown_failure_type",
      });
      continue;
    }

    mappedNegativeKeys.add(compositeKey);
  }

  let unmappedNegativeFixtureCount = 0;
  for (const expectedKey of expectedNegativeFixtureIds) {
    if (!mappedNegativeKeys.has(expectedKey)) {
      unmappedNegativeFixtureCount += 1;
      failures.push({
        source: expectedKey,
        reason: "unmapped_negative_fixture",
      });
    }
  }

  const negativeFixtureCount = expectedNegativeFixtureIds.size;
  if (negativeFixtureCount !== fixture.expectedNegativeFixtureCount) {
    failures.push({
      source: "negative_fixture_count:" + negativeFixtureCount,
      reason: "negative_fixture_count_mismatch",
    });
  }

  const expectedTaxonomyRowCount =
    fixture.expectedDimensionCount * fixture.expectedTaxonomyRowsPerDimension;
  const uniqueFailures = deduplicateFailures(failures);

  return {
    passed: uniqueFailures.length === 0,
    dimensionCount: fixture.dimensionTaxonomyDocs.length,
    expectedDimensionCount: fixture.expectedDimensionCount,
    taxonomyRowCount,
    expectedTaxonomyRowCount,
    negativeFixtureCount,
    mappedNegativeFixtureCount: mappedNegativeKeys.size,
    negativeFixtureCoveragePercent: percent(mappedNegativeKeys.size, negativeFixtureCount),
    unmappedNegativeFixtureCount,
    orphanMappingCount,
    unknownFailureTypeCount,
    positiveFixtureMappingCount,
    malformedTaxonomyRowCount,
    duplicateFailureTypeCount,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    failureCount: uniqueFailures.length,
    failures: uniqueFailures,
  };
}

type ParsedTaxonomyRow = {
  readonly failureType: string;
  readonly description: string;
  readonly expectedHandling: string;
  readonly notAllowed: string;
};

function parseTaxonomyTable(text: string): { readonly rows: readonly ParsedTaxonomyRow[] } {
  const lines = text.split("\n");
  const rows: ParsedTaxonomyRow[] = [];
  let inTable = false;
  let headerSeen = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("|") && line.includes("Failure Type")) {
      inTable = true;
      headerSeen = false;
      continue;
    }
    if (inTable && line.startsWith("|---")) {
      headerSeen = true;
      continue;
    }
    if (inTable && headerSeen) {
      if (!line.startsWith("|")) {
        inTable = false;
        headerSeen = false;
        continue;
      }
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length < 4) {
        rows.push({ failureType: "", description: "", expectedHandling: "", notAllowed: "" });
        continue;
      }
      rows.push({
        failureType: cells[0] ?? "",
        description: cells[1] ?? "",
        expectedHandling: cells[2] ?? "",
        notAllowed: cells[3] ?? "",
      });
    }
  }
  return { rows };
}

function readTaxonomyDoc(
  root: string,
  relativePath: string,
  failures: IntelligenceGrowthFailureTaxonomyCoverageFailure[],
): string | null {
  try {
    return readFileSync(path.join(root, relativePath), "utf8");
  } catch {
    failures.push({ source: relativePath, reason: "taxonomy_doc_missing" });
    return null;
  }
}

function deduplicateFailures(
  failures: readonly IntelligenceGrowthFailureTaxonomyCoverageFailure[],
): readonly IntelligenceGrowthFailureTaxonomyCoverageFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = failure.source + ":" + failure.reason;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 100);
}
