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

  it("covers every server action exactly once", () => {
    expect(CAIO_OPERATOR_OPERATIONS.map((operation) => operation.key).sort()).toEqual([
      "acceptInitializationGate", "activateMandate", "createCatalogEntry", "createMandateDraft", "createObservationProgram",
      "recordCatalogAuthorization", "recordCatalogClassification", "recordCatalogConnection", "recordCatalogInitialization",
      "recordGuardianStop", "recordInitializationAssessment", "registerObservationSource", "registerPrincipalBinding",
      "resumeGuardianStop", "revokeInitializationGate", "revokeMandate", "revokePrincipalBinding", "suspendMandate",
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

  it("labels every operation in both languages and marks CEO/guardian acts", () => {
    for (const operation of CAIO_OPERATOR_OPERATIONS) {
      expect(operation.title.zh).toMatch(/\S/);
      expect(operation.title.en).toMatch(/\S/);
    }
    expect(CAIO_OPERATOR_OPERATIONS.filter((operation) => operation.actor !== "owner").map((operation) => operation.key).sort())
      .toEqual(["acceptInitializationGate", "activateMandate", "recordGuardianStop", "resumeGuardianStop",
        "revokeInitializationGate", "revokeMandate", "suspendMandate"]);
  });
});
