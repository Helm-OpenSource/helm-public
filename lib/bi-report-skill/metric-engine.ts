import type {
  BiReportAggregationDefinition,
  BiReportComputedMetrics,
  BiReportMetricDefinition,
  BiReportRankingDefinition,
  BiReportRankingItem,
  BiReportRow,
  BiReportSummaryMetric,
} from "@/lib/bi-report-skill/types";

export function computeBiReportMetrics(input: {
  definitions: BiReportMetricDefinition;
  rows: BiReportRow[];
}): BiReportComputedMetrics {
  const metricsByKey: Record<string, number> = {};

  for (const definition of input.definitions.aggregations) {
    if (definition.type !== "sum") continue;
    const sum = input.rows.reduce((acc, row) => acc + readNumericValue(row[definition.field]), 0);
    // Amount columns arrive from the ODPS bridge as JS numbers (doubles). Once a
    // sum crosses Number.MAX_SAFE_INTEGER (~9e15) it silently loses integer
    // precision — real financial totals are already in the trillions, so warn
    // when a metric enters that range rather than reporting a corrupted figure
    // as if it were exact.
    if (Number.isFinite(sum) && Math.abs(sum) > Number.MAX_SAFE_INTEGER) {
      console.warn(
        `[bi-report metric-engine] metric "${definition.key}" sum ${sum} exceeds Number.MAX_SAFE_INTEGER; precision may be lost — consider scaling the amount unit in the query.`,
      );
    }
    metricsByKey[definition.key] = sum;
  }

  const rankings = buildRankings(input.rows, input.definitions.rankings ?? []);

  // Derived metrics (ratio / pct_change / ranking_count) may reference other
  // metric keys. Resolve them in dependency order via a fixpoint so a derived
  // metric that references another derived metric is computed correctly
  // regardless of declaration order — previously a forward reference silently
  // read undefined and defaulted to 0.
  const pendingDerived = input.definitions.aggregations.filter(
    (definition) => definition.type !== "sum",
  );
  let progressed = true;
  while (progressed && pendingDerived.length > 0) {
    progressed = false;
    for (let index = pendingDerived.length - 1; index >= 0; index -= 1) {
      const definition = pendingDerived[index];
      const ready = derivedMetricDependencies(definition).every(
        (dependency) => dependency in metricsByKey,
      );
      if (!ready) continue;
      metricsByKey[definition.key] = computeDerivedMetric(definition, metricsByKey, rankings);
      pendingDerived.splice(index, 1);
      progressed = true;
    }
  }
  // Anything still pending references an undefined (or cyclic) metric: surface
  // it instead of silently emitting a plausible-looking 0, then compute with
  // whatever is available (missing dependencies resolve to 0).
  for (const definition of pendingDerived) {
    const missing = derivedMetricDependencies(definition).filter(
      (dependency) => !(dependency in metricsByKey),
    );
    console.warn(
      `[bi-report metric-engine] metric "${definition.key}" references undefined metric(s): ${missing.join(", ")}`,
    );
    metricsByKey[definition.key] = computeDerivedMetric(definition, metricsByKey, rankings);
  }

  const definitionOrder =
    input.definitions.displayOrder?.length
      ? input.definitions.displayOrder
      : input.definitions.aggregations.map((item) => item.key);

  const definitionsByKey = new Map(input.definitions.aggregations.map((item) => [item.key, item]));
  const summaryMetrics: BiReportSummaryMetric[] = definitionOrder
    .map((key) => {
      const definition = definitionsByKey.get(key);
      if (!definition) return null;

      return {
        key: definition.key,
        label: definition.label,
        value: metricsByKey[definition.key] ?? 0,
        format: definition.format ?? "decimal",
      };
    })
    .filter((item): item is BiReportSummaryMetric => Boolean(item));

  return {
    metricsByKey,
    summaryMetrics,
    rankings,
  };
}

function derivedMetricDependencies(definition: BiReportAggregationDefinition): string[] {
  if (definition.type === "ratio") return [definition.numerator, definition.denominator];
  if (definition.type === "pct_change") return [definition.current, definition.previous];
  // ranking_count depends on a ranking, not on other metrics.
  return [];
}

function computeDerivedMetric(
  definition: BiReportAggregationDefinition,
  metricsByKey: Record<string, number>,
  rankings: Record<string, BiReportRankingItem[]>,
): number {
  if (definition.type === "ratio") {
    return safeRatio(metricsByKey[definition.numerator], metricsByKey[definition.denominator]);
  }
  if (definition.type === "pct_change") {
    return calculatePctChange(metricsByKey[definition.current], metricsByKey[definition.previous]);
  }
  if (definition.type === "ranking_count") {
    return rankings[definition.rankingKey]?.length ?? 0;
  }
  return 0;
}

function buildRankings(rows: BiReportRow[], rankings: BiReportRankingDefinition[]) {
  const result: Record<string, BiReportRankingItem[]> = {};

  for (const definition of rankings) {
    if (definition.type === "row_pct_change") {
      const items = rows
        .map((row) => {
          const score = calculatePctChange(
            readNumericValue(row[definition.currentField]),
            readNumericValue(row[definition.previousField]),
          );
          return buildRankingItem(row, definition, score);
        })
        .sort((left, right) => compareNumbers(left.score, right.score, definition.order))
        .slice(0, definition.take);

      result[definition.key] = items;
      continue;
    }

    if (definition.type === "row_ratio_threshold") {
      const items = rows
        .map((row) => {
          const score = safeThresholdRatio(
            readNumericValue(row[definition.numeratorField]),
            readNumericValue(row[definition.denominatorField]),
          );
          return buildRankingItem(row, definition, score);
        })
        .filter((item) => item.score < definition.threshold)
        .sort((left, right) => compareNumbers(left.score, right.score, definition.order))
        .slice(0, definition.take);

      result[definition.key] = items;
    }
  }

  return result;
}

function buildRankingItem(row: BiReportRow, definition: BiReportRankingDefinition, score: number): BiReportRankingItem {
  const includeFields = definition.includeFields ?? [];
  const fields = Object.fromEntries(includeFields.map((field) => [field, row[field] ?? null]));

  return {
    label: String(row[definition.dimensionField] ?? "unknown"),
    score,
    fields,
  };
}

function compareNumbers(left: number, right: number, order: "asc" | "desc") {
  return order === "asc" ? left - right : right - left;
}

function readNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function safeRatio(numerator = 0, denominator = 0) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function safeThresholdRatio(numerator = 0, denominator = 0) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 1;
  }
  return numerator / denominator;
}

function calculatePctChange(current = 0, previous = 0) {
  if (!Number.isFinite(previous) || previous === 0) {
    if (!current) return 0;
    return current > 0 ? 1 : -1;
  }

  return (current - previous) / Math.abs(previous);
}
