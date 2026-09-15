import { describe, expect, it } from "vitest";

import { CAIO_OPERATOR_GROUPS, CAIO_OPERATOR_OPERATIONS } from "./operator-operations";
import * as schemas from "./schemas";

describe("CAIO operator operation catalog", () => {
  it("has unique keys and only known groups", () => {
    const keys = CAIO_OPERATOR_OPERATIONS.map((operation) => operation.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const operation of CAIO_OPERATOR_OPERATIONS) {
      expect(CAIO_OPERATOR_GROUPS.map((group) => group.key)).toContain(operation.group);
    }
  });

  it("covers every server action exactly once", async () => {
    const actionModule = await import("./actions");
    expect(Object.keys(actionModule).map((name) => name.replace(/Action$/u, "")).sort())
      .toEqual(CAIO_OPERATOR_OPERATIONS.map((operation) => operation.key).sort());
    expect(CAIO_OPERATOR_OPERATIONS.map((operation) => operation.key).sort()).toEqual([
      "acceptInitializationGate", "createCatalogEntry", "createObservationProgram",
      "recordCatalogAuthorization", "recordCatalogClassification", "recordCatalogConnection", "recordCatalogInitialization",
      "recordInitializationAssessment", "registerObservationSource", "revokeInitializationGate",
    ]);
  });

  it.each(CAIO_OPERATOR_OPERATIONS.map((operation) => [operation.key, operation] as const))(
    "%s template parses with its schema so the panel never ships a drifted example",
    (_key, operation) => {
      const schema = (schemas as Record<string, { safeParse: (value: unknown) => { success: boolean } }>)[operation.schemaName];
      expect(schema, operation.schemaName).toBeDefined();
      expect(schema.safeParse(operation.template).success).toBe(true);
    },
  );

  it("labels every operation in both languages and marks CEO acts", () => {
    for (const operation of CAIO_OPERATOR_OPERATIONS) {
      expect(operation.title.zh).toMatch(/\S/);
      expect(operation.title.en).toMatch(/\S/);
    }
    expect(CAIO_OPERATOR_OPERATIONS.filter((operation) => operation.actor !== "owner").map((operation) => operation.key).sort())
      .toEqual(["acceptInitializationGate", "revokeInitializationGate"]);
  });
});
