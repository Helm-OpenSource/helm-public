import { describe, expect, it } from "vitest";

import { validateBiReportRows } from "@/lib/bi-report-skill/schema-validator";
import type { BiReportSchemaDefinition } from "@/lib/bi-report-skill/types";

const schema = (type: string): BiReportSchemaDefinition =>
  ({
    version: "v1",
    parameters: [],
    columns: [{ name: "v", type }],
  }) as unknown as BiReportSchemaDefinition;

describe("validateBiReportRows integer coercion", () => {
  it("accepts a safe integer", () => {
    const result = validateBiReportRows(schema("integer"), [{ v: 42 }]);
    expect(result.ok).toBe(true);
    expect(result.rows[0].v).toBe(42);
  });

  it("rejects a 21-digit business key that would lose precision as integer", () => {
    const result = validateBiReportRows(schema("integer"), [
      { v: "202606101456051238591" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("safe range");
    expect(result.errors[0]).toContain("string");
  });

  it("preserves the 21-digit key verbatim when declared as string", () => {
    const result = validateBiReportRows(schema("string"), [
      { v: "202606101456051238591" },
    ]);
    expect(result.ok).toBe(true);
    expect(result.rows[0].v).toBe("202606101456051238591");
  });
});
