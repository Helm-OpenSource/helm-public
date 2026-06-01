import type {
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
    metricsByKey[definition.key] = input.rows.reduce((sum, row) => sum + readNumericValue(row[definition.field]), 0);
  }

  const rankings = buildRankings(input.rows, input.definitions.rankings ?? []);

  for (const definition of input.definitions.aggregations) {
    if (definition.type === "ratio") {
      metricsByKey[definition.key] = safeRatio(metricsByKey[definition.numerator], metricsByKey[definition.denominator]);
      continue;
    }

    if (definition.type === "pct_change") {
      metricsByKey[definition.key] = calculatePctChange(metricsByKey[definition.current], metricsByKey[definition.previous]);
      continue;
    }

    if (definition.type === "ranking_count") {
      metricsByKey[definition.key] = rankings[definition.rankingKey]?.length ?? 0;
    }
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
