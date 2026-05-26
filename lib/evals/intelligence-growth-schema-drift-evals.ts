import { readFileSync } from "node:fs";
import path from "node:path";
import schemaDriftBaselineData from "@/evals/intelligence-growth-schema-drift/schema-drift-baseline.json";
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
import snapshotFixtureData from "@/evals/intelligence-growth-eval-replay-snapshots/eval-replay-snapshot-cases.json";
import { INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS } from "@/lib/intelligence-growth/contracts";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

type JsonObject = { readonly [key: string]: unknown };

export type IntelligenceGrowthSchemaDriftSummaryKeySet = {
  readonly producerId: string;
  readonly keys: readonly string[];
};

export type IntelligenceGrowthSchemaDriftBaseline = {
  readonly version: string;
  readonly dimensions: readonly string[];
  readonly decisions: readonly string[];
  readonly noGoBoundaries: readonly string[];
  readonly expectedSnapshotFixtureVersion: string;
  readonly coreFixtureTopLevelKeys: readonly string[];
  readonly coreFixtureExpectedKeys: readonly string[];
  readonly summaryKeySets: readonly IntelligenceGrowthSchemaDriftSummaryKeySet[];
};

export type IntelligenceGrowthSchemaDriftSnapshotFixture = {
  readonly version: string;
  readonly snapshots: readonly {
    readonly producerId: string;
    readonly expected: JsonObject;
  }[];
};

export type IntelligenceGrowthSchemaDriftEvalOptions = {
  readonly root?: string;
  readonly baseline?: IntelligenceGrowthSchemaDriftBaseline;
  readonly typesText?: string;
  readonly fixtureLintText?: string;
  readonly coreFixtures?: Partial<Record<IntelligenceDimension, readonly JsonObject[]>>;
  readonly snapshotFixture?: IntelligenceGrowthSchemaDriftSnapshotFixture;
};

export type IntelligenceGrowthSchemaDriftSummary = {
  readonly passed: boolean;
  readonly baselineVersion: string;
  readonly dimensionParityOk: boolean;
  readonly decisionParityOk: boolean;
  readonly boundaryParityOk: boolean;
  readonly trackedSummaryCount: number;
  readonly summaryKeySetMismatchCount: number;
  readonly authorityFlagWrongValueCount: number;
  readonly fixtureKeySetMismatchCount: number;
  readonly fixtureExpectedKeySetMismatchCount: number;
  readonly snapshotVersionPinned: boolean;
  readonly snapshotVersionMismatchCount: number;
  readonly unionLiteralParseFailureCount: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly failures: readonly {
    readonly source: string;
    readonly reason: string;
  }[];
};

export const DEFAULT_SCHEMA_DRIFT_BASELINE =
  schemaDriftBaselineData as IntelligenceGrowthSchemaDriftBaseline;

const DEFAULT_CORE_FIXTURES: Record<IntelligenceDimension, readonly JsonObject[]> = {
  context: contextCases as readonly JsonObject[],
  object_signal: objectSignalCases as readonly JsonObject[],
  memory: memoryCases as readonly JsonObject[],
  routing: routingCases as readonly JsonObject[],
  action_outcome: actionOutcomeCases as readonly JsonObject[],
  worker_skill: workerSkillCases as readonly JsonObject[],
  prompt_policy: promptPolicyCases as readonly JsonObject[],
  eval_replay: evalReplayCases as readonly JsonObject[],
  tenant_personalization: tenantPersonalizationCases as readonly JsonObject[],
  cost_model_tool: costModelToolCases as readonly JsonObject[],
};

const AUTHORITY_FLAG_EXPECTATIONS: Readonly<Record<string, boolean>> = {
  candidateOnly: true,
  runtimeAllowed: false,
  runtimeAdoptionAllowed: false,
  officialWriteAllowed: false,
  autoExecutionAllowed: false,
  canonicalMemoryWriteAllowed: false,
  promptOrPolicyUpdateAllowed: false,
  skillAutoPromotionAllowed: false,
};

export function runIntelligenceGrowthSchemaDriftEval(
  options: IntelligenceGrowthSchemaDriftEvalOptions = {},
): IntelligenceGrowthSchemaDriftSummary {
  const root = options.root ?? process.cwd();
  const baseline = options.baseline ?? DEFAULT_SCHEMA_DRIFT_BASELINE;
  const typesText = options.typesText ?? readRepoFile(root, "lib/intelligence-growth/types.ts");
  const fixtureLintText = options.fixtureLintText ??
    readRepoFile(root, "lib/evals/intelligence-growth-fixture-lint-evals.ts");
  const coreFixtures = { ...DEFAULT_CORE_FIXTURES, ...(options.coreFixtures ?? {}) };
  const snapshotFixture =
    options.snapshotFixture ?? (snapshotFixtureData as IntelligenceGrowthSchemaDriftSnapshotFixture);
  const failures: { source: string; reason: string }[] = [];

  const typesDimensions = parseUnionMembers(typesText, "IntelligenceDimension", failures);
  const typesDecisions = parseUnionMembers(typesText, "GrowthDecision", failures);
  const typesBoundaries = parseUnionMembers(typesText, "NoGoBoundary", failures);
  const fixtureLintDimensions = parseConstArrayMembers(fixtureLintText, "INTELLIGENCE_DIMENSIONS", failures);
  const fixtureLintDecisions = parseConstArrayMembers(fixtureLintText, "VALID_GROWTH_DECISIONS", failures);
  const fixtureLintBoundaries = parseConstArrayMembers(fixtureLintText, "VALID_NO_GO_BOUNDARIES", failures);
  const contractDimensions = INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS.map((descriptor) => descriptor.id);
  const contractDecisions = uniqueSorted(
    INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS.flatMap((descriptor) => descriptor.allowedDecisions),
  );
  const contractBoundaries = uniqueSorted(
    INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS.flatMap((descriptor) => descriptor.noGoBoundaries),
  );

  const dimensionParityOk = compareAllSources("dimensions", baseline.dimensions, failures, {
    types: typesDimensions,
    contracts: contractDimensions,
    fixture_lint: fixtureLintDimensions,
  });
  const decisionParityOk = compareAllSources("decisions", baseline.decisions, failures, {
    types: typesDecisions,
    contracts: contractDecisions,
    fixture_lint: fixtureLintDecisions,
  });
  const boundaryParityOk = compareAllSources("no_go_boundaries", baseline.noGoBoundaries, failures, {
    types: typesBoundaries,
    contracts: contractBoundaries,
    fixture_lint: fixtureLintBoundaries,
  });

  validateSummaryKeySets(baseline, snapshotFixture, failures);
  validateAuthorityFlags(snapshotFixture, failures);
  validateCoreFixtureKeys(baseline, coreFixtures, failures);

  if (baseline.expectedSnapshotFixtureVersion !== snapshotFixture.version) {
    failures.push({ source: "eval_replay_snapshot", reason: "snapshot_version_mismatch" });
  }

  const uniqueFailures = deduplicateFailures(failures);

  return {
    passed: uniqueFailures.length === 0,
    baselineVersion: baseline.version,
    dimensionParityOk,
    decisionParityOk,
    boundaryParityOk,
    trackedSummaryCount: baseline.summaryKeySets.length,
    summaryKeySetMismatchCount: uniqueFailures.filter((failure) =>
      failure.reason.startsWith("summary_key_set_mismatch") ||
      failure.reason === "summary_missing_from_snapshot" ||
      failure.reason === "summary_unexpected_in_snapshot",
    ).length,
    authorityFlagWrongValueCount: uniqueFailures.filter((failure) =>
      failure.reason.startsWith("authority_flag_wrong_value"),
    ).length,
    fixtureKeySetMismatchCount: uniqueFailures.filter((failure) =>
      failure.reason.startsWith("fixture_key_set_mismatch") ||
      failure.reason === "fixture_dimension_missing",
    ).length,
    fixtureExpectedKeySetMismatchCount: uniqueFailures.filter((failure) =>
      failure.reason.startsWith("fixture_expected_key_set_mismatch"),
    ).length,
    snapshotVersionPinned: baseline.expectedSnapshotFixtureVersion === snapshotFixture.version,
    snapshotVersionMismatchCount: uniqueFailures.filter((failure) =>
      failure.reason === "snapshot_version_mismatch",
    ).length,
    unionLiteralParseFailureCount: uniqueFailures.filter((failure) =>
      failure.reason.startsWith("union_literal_parse_failure") ||
      failure.reason.startsWith("const_array_parse_failure"),
    ).length,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    failures: uniqueFailures,
  };
}

function validateSummaryKeySets(
  baseline: IntelligenceGrowthSchemaDriftBaseline,
  snapshotFixture: IntelligenceGrowthSchemaDriftSnapshotFixture,
  failures: { source: string; reason: string }[],
): void {
  const baselineByProducerId = new Map(
    baseline.summaryKeySets.map((entry) => [entry.producerId, normalizeStringArray(entry.keys)]),
  );
  const snapshotByProducerId = new Map(
    snapshotFixture.snapshots.map((entry) => [entry.producerId, normalizeStringArray(Object.keys(entry.expected))]),
  );

  for (const [producerId, expectedKeys] of baselineByProducerId.entries()) {
    const actualKeys = snapshotByProducerId.get(producerId);
    if (!actualKeys) {
      failures.push({ source: producerId, reason: "summary_missing_from_snapshot" });
      continue;
    }
    if (!sameStringArray(expectedKeys, actualKeys)) {
      failures.push({
        source: producerId,
        reason: `summary_key_set_mismatch:${actualKeys.join(",")}`,
      });
    }
  }

  for (const producerId of snapshotByProducerId.keys()) {
    if (!baselineByProducerId.has(producerId)) {
      failures.push({ source: producerId, reason: "summary_unexpected_in_snapshot" });
    }
  }
}

function validateAuthorityFlags(
  snapshotFixture: IntelligenceGrowthSchemaDriftSnapshotFixture,
  failures: { source: string; reason: string }[],
): void {
  for (const snapshot of snapshotFixture.snapshots) {
    for (const [flag, expectedValue] of Object.entries(AUTHORITY_FLAG_EXPECTATIONS)) {
      if (!(flag in snapshot.expected)) continue;
      if (snapshot.expected[flag] !== expectedValue) {
        failures.push({
          source: snapshot.producerId,
          reason: `authority_flag_wrong_value:${flag}`,
        });
      }
    }
  }
}

function validateCoreFixtureKeys(
  baseline: IntelligenceGrowthSchemaDriftBaseline,
  coreFixtures: Partial<Record<IntelligenceDimension, readonly JsonObject[]>>,
  failures: { source: string; reason: string }[],
): void {
  for (const dimension of baseline.dimensions) {
    const cases = coreFixtures[dimension as IntelligenceDimension];
    if (!cases || cases.length === 0) {
      failures.push({ source: `core:${dimension}`, reason: "fixture_dimension_missing" });
      continue;
    }
    for (const item of cases) {
      const fixtureId = typeof item.id === "string" ? item.id : `core:${dimension}`;
      const topLevelKeys = normalizeStringArray(Object.keys(item));
      if (!sameStringArray(topLevelKeys, baseline.coreFixtureTopLevelKeys)) {
        failures.push({
          source: fixtureId,
          reason: `fixture_key_set_mismatch:${topLevelKeys.join(",")}`,
        });
      }
      const expected = item.expected;
      if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
        failures.push({ source: fixtureId, reason: "fixture_expected_key_set_mismatch:missing_expected" });
        continue;
      }
      const expectedKeys = normalizeStringArray(Object.keys(expected));
      if (!sameStringArray(expectedKeys, baseline.coreFixtureExpectedKeys)) {
        failures.push({
          source: fixtureId,
          reason: `fixture_expected_key_set_mismatch:${expectedKeys.join(",")}`,
        });
      }
    }
  }
}

function compareAllSources(
  label: string,
  expected: readonly string[],
  failures: { source: string; reason: string }[],
  sources: Readonly<Record<string, readonly string[]>>,
): boolean {
  let ok = true;
  const normalizedExpected = normalizeStringArray(expected);
  for (const [source, values] of Object.entries(sources)) {
    const normalizedValues = normalizeStringArray(values);
    if (!sameStringArray(normalizedExpected, normalizedValues)) {
      failures.push({ source, reason: `${label}_parity_mismatch:${normalizedValues.join(",")}` });
      ok = false;
    }
  }
  return ok;
}

function parseUnionMembers(
  sourceText: string,
  typeName: string,
  failures: { source: string; reason: string }[],
): readonly string[] {
  const match = stripLineComments(sourceText).match(new RegExp(`export\\s+type\\s+${typeName}\\s*=([\\s\\S]*?);`));
  if (!match) {
    failures.push({ source: typeName, reason: `union_literal_parse_failure:${typeName}` });
    return [];
  }
  return extractStringLiterals(match[1] ?? "");
}

function parseConstArrayMembers(
  sourceText: string,
  constName: string,
  failures: { source: string; reason: string }[],
): readonly string[] {
  const match = stripLineComments(sourceText).match(
    new RegExp(`const\\s+${constName}[\\s\\S]*?=\\s*(?:new\\s+Set(?:<[^>]+>)?\\s*\\()?\\s*\\[([\\s\\S]*?)\\]`),
  );
  if (!match) {
    failures.push({ source: constName, reason: `const_array_parse_failure:${constName}` });
    return [];
  }
  return extractStringLiterals(match[1] ?? "");
}

function extractStringLiterals(sourceText: string): readonly string[] {
  return uniqueSorted([...sourceText.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? ""));
}

function stripLineComments(sourceText: string): string {
  return sourceText
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function readRepoFile(root: string, relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeStringArray(values: readonly string[]): readonly string[] {
  return [...values].sort();
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = normalizeStringArray(left);
  const normalizedRight = normalizeStringArray(right);
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function deduplicateFailures(
  failures: readonly { readonly source: string; readonly reason: string }[],
): readonly { readonly source: string; readonly reason: string }[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.source}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
