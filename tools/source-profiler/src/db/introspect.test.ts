import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDbCatalogSnapshot } from "./types";
import { introspectFromSnapshot, introspectViaExecutor } from "./introspect";
import { catalogToDiscoveredObjects } from "./catalog-to-objects";
import { proposeMappings } from "../profiler/mapping-proposer";
import type { CatalogExecutor } from "./types";

const snapshot = parseDbCatalogSnapshot(
  JSON.parse(
    readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../fixtures/db-catalog/postgres-snapshot.json",
      ),
      "utf8",
    ),
  ),
);

describe("introspectFromSnapshot", () => {
  it("enforces the schema allowlist and never reads rows", () => {
    const { summary, excludedTables } = introspectFromSnapshot(snapshot, {
      schemas: ["public"],
      tables: [],
    });
    expect(summary.rowDataRead).toBe(false);
    expect(summary.tables.map((t) => t.name)).toEqual(["deals"]);
    expect(excludedTables).toContain("internal.audit_log");
  });

  it("tags columns and preserves foreign keys", () => {
    const { summary } = introspectFromSnapshot(snapshot, { schemas: ["public"], tables: [] });
    const deals = summary.tables[0];
    expect(deals.foreignKeys[0]).toMatchObject({ column: "company_id", referencesTable: "companies" });
    const amount = deals.columns.find((c) => c.name === "amount");
    expect(amount?.dataType).toBe("decimal");
    expect(amount?.semanticTags).toContain("amount");
  });

  it("warns when the allowlist is empty", () => {
    const { summary, warnings } = introspectFromSnapshot(snapshot, { schemas: [], tables: [] });
    expect(summary.tables).toEqual([]);
    expect(warnings.join(" ")).toMatch(/allowlist is empty/);
  });

  it("supports table-level allowlist (schema-qualified)", () => {
    const { summary } = introspectFromSnapshot(snapshot, {
      schemas: [],
      tables: ["internal.audit_log"],
    });
    expect(summary.tables.map((t) => t.name)).toEqual(["audit_log"]);
  });
});

describe("catalogToDiscoveredObjects + mapping", () => {
  it("derives an Opportunity candidate from the deals catalog table", () => {
    const { summary } = introspectFromSnapshot(snapshot, { schemas: ["public"], tables: [] });
    const objects = catalogToDiscoveredObjects(summary);
    const candidates = objects.flatMap(proposeMappings);
    expect(candidates.some((c) => c.targetEntity === "Opportunity")).toBe(true);
  });
});

describe("introspectViaExecutor — write canary", () => {
  it("warns (not fails) when the connection is write-capable", async () => {
    const executor: CatalogExecutor = {
      engine: "postgres",
      async query() {
        return [];
      },
      async probeWriteCapability() {
        return true;
      },
    };
    const { summary, warnings } = await introspectViaExecutor(executor, { schemas: ["public"], tables: [] });
    expect(summary.permissionPosture).toBe("write_capable_warned");
    expect(warnings.join(" ")).toMatch(/write-capable/);
    expect(summary.rowDataRead).toBe(false);
  });
});
