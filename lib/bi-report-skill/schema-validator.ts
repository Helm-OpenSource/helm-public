import type {
  BiReportRow,
  BiReportRowValue,
  BiReportSchemaColumn,
  BiReportSchemaDefinition,
} from "@/lib/bi-report-skill/types";

type ValidationResult = {
  ok: boolean;
  errors: string[];
  rows: BiReportRow[];
};

export function validateBiReportRows(schema: BiReportSchemaDefinition, rows: Array<Record<string, unknown>>): ValidationResult {
  const errors: string[] = [];
  const normalizedRows = rows.map((row, rowIndex) => {
    const nextRow: BiReportRow = {};

    for (const column of schema.columns) {
      const result = normalizeColumnValue(column, row[column.name]);
      if (!result.ok) {
        errors.push(`row ${rowIndex + 1} column ${column.name}: ${result.error}`);
        nextRow[column.name] = null;
        continue;
      }
      nextRow[column.name] = result.value;
    }

    return nextRow;
  });

  return {
    ok: errors.length === 0,
    errors,
    rows: normalizedRows,
  };
}

export function assertValidBiReportRows(schema: BiReportSchemaDefinition, rows: Array<Record<string, unknown>>) {
  const result = validateBiReportRows(schema, rows);
  if (!result.ok) {
    throw new Error(`Bi report schema validation failed: ${result.errors.join("; ")}`);
  }
  return result.rows;
}

function normalizeColumnValue(column: BiReportSchemaColumn, input: unknown): {
  ok: boolean;
  value: BiReportRowValue;
  error?: string;
} {
  if (input == null || input === "") {
    if (column.required) {
      return { ok: false, value: null, error: "required value is missing" };
    }
    return { ok: true, value: null };
  }

  switch (column.type) {
    case "string":
      return { ok: true, value: String(input) };
    case "date": {
      if (typeof input !== "string") {
        return { ok: false, value: null, error: "date value must be a string" };
      }
      const text = input.trim();
      if (!text || Number.isNaN(Date.parse(text))) {
        return { ok: false, value: null, error: "date value is not parseable" };
      }
      return { ok: true, value: text };
    }
    case "integer": {
      const value = typeof input === "number" ? input : Number(input);
      if (!Number.isInteger(value)) {
        return { ok: false, value: null, error: "integer value is invalid" };
      }
      return { ok: true, value };
    }
    case "decimal": {
      const value = typeof input === "number" ? input : Number(input);
      if (!Number.isFinite(value)) {
        return { ok: false, value: null, error: "decimal value is invalid" };
      }
      return { ok: true, value };
    }
    case "boolean": {
      if (typeof input === "boolean") {
        return { ok: true, value: input };
      }
      if (input === "true") return { ok: true, value: true };
      if (input === "false") return { ok: true, value: false };
      return { ok: false, value: null, error: "boolean value is invalid" };
    }
    default:
      return { ok: false, value: null, error: "unsupported column type" };
  }
}
