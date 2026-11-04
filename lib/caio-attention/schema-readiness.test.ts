import { describe, expect, it } from "vitest";

import { CAIO_ATTENTION_EVIDENCE_GRANTS, CAIO_ATTENTION_EVIDENCE_SOURCE_TABLES } from "@/lib/caio-attention-runtime/evidence-resolver";

import {
  CAIO_ATTENTION_CORE_TABLE_GRANTS, CAIO_ATTENTION_FIXTURE_CORE_TABLES, CAIO_ATTENTION_GRANT_MATRIX, mergeCaioAttentionGrantMaps,
  renderCaioAttentionGrantSql,
} from "./least-privilege-fixture";
import {
  CAIO_ATTENTION_SCHEMA_MANIFEST,
  CAIO_ATTENTION_TABLES,
  probeCaioAttentionSchemaReadiness,
  type CaioAttentionSchemaQueryPort,
} from "./schema-readiness";

function fakeClient(columns: Array<[string, string]>, controlRows: unknown[] = [{ id: "global" }], fail = false): CaioAttentionSchemaQueryPort {
  return {
    async $queryRawUnsafe<T>(query: string): Promise<T> {
      if (fail) throw new Error("connection lost");
      if (query.includes("information_schema")) return columns.map(([tableName, columnName]) => ({ tableName, columnName })) as T;
      return controlRows as T;
    },
  };
}

const allColumns = CAIO_ATTENTION_TABLES.flatMap((table) =>
  CAIO_ATTENTION_SCHEMA_MANIFEST[table].map((column) => [table, column] as [string, string]));

describe("probeCaioAttentionSchemaReadiness", () => {
  it("is ready when every column is visible and the Control row exists, case-insensitively", async () => {
    const lowered = allColumns.map(([table, column]) => [table.toLowerCase(), column] as [string, string]);
    await expect(probeCaioAttentionSchemaReadiness(fakeClient(lowered))).resolves.toEqual({ ready: true, tables: CAIO_ATTENTION_TABLES });
  });

  it("names each missing column", async () => {
    const result = await probeCaioAttentionSchemaReadiness(fakeClient(allColumns.filter(([, column]) => column !== "openEpoch")));
    expect(result).toEqual({ ready: false, reason: "schema_incomplete", missing: ["CaioAttentionControl.openEpoch", "CaioAttentionPauseRequest.openEpoch", "CaioAttentionControlEvent.openEpoch"] });
  });

  it("fails closed without the seeded Control row, on query errors and on an unknown or empty table set", async () => {
    await expect(probeCaioAttentionSchemaReadiness(fakeClient(allColumns, []))).resolves.toMatchObject({ ready: false, reason: "control_row_missing" });
    await expect(probeCaioAttentionSchemaReadiness(fakeClient(allColumns, [], true))).resolves.toMatchObject({ ready: false, reason: "probe_failed" });
    await expect(probeCaioAttentionSchemaReadiness(fakeClient(allColumns), [])).resolves.toMatchObject({ ready: false, reason: "probe_failed" });
    await expect(probeCaioAttentionSchemaReadiness(fakeClient(allColumns), ["Workspace" as never])).resolves.toMatchObject({ ready: false, reason: "probe_failed" });
  });

  it("skips the Control row check when the caller does not probe Control", async () => {
    const pause = allColumns.filter(([table]) => table === "CaioAttentionPauseRequest");
    await expect(probeCaioAttentionSchemaReadiness(fakeClient(pause, []), ["CaioAttentionPauseRequest"])).resolves.toMatchObject({ ready: true });
  });
});

describe("CAIO attention least-privilege fixture", () => {
  it("covers exactly the probed tables and never grants DELETE", () => {
    expect(Object.keys(CAIO_ATTENTION_GRANT_MATRIX).sort()).toEqual([...CAIO_ATTENTION_TABLES].sort());
    for (const table of CAIO_ATTENTION_FIXTURE_CORE_TABLES) {
      expect(CAIO_ATTENTION_TABLES as readonly string[], table).not.toContain(table);
      expect(CAIO_ATTENTION_CORE_TABLE_GRANTS[table].attention_ops, table).toBeUndefined();
      expect(CAIO_ATTENTION_CORE_TABLE_GRANTS[table].attention_web?.privileges ?? [], table).not.toContain("UPDATE");
    }
    // The evidence lookups run as the web identity; every source table must be readable by it once merged.
    const withEvidence = renderCaioAttentionGrantSql("helm_caio_attention_ci", "%", CAIO_ATTENTION_EVIDENCE_GRANTS);
    for (const table of CAIO_ATTENTION_EVIDENCE_SOURCE_TABLES) {
      expect(withEvidence.match(new RegExp(`ON \`helm_caio_attention_ci\`\\.\`${table}\` TO 'attention_web'`, "gu")), table).toHaveLength(1);
    }
    expect(withEvidence).toContain("GRANT SELECT, UPDATE ON `helm_caio_attention_ci`.`CaioAnomalyCandidate` TO 'attention_generator'@'%';");
    expect(() => mergeCaioAttentionGrantMaps(
      { T: { attention_ops: { privileges: ["UPDATE"], updateColumns: ["a"] } } }, { T: { attention_ops: { privileges: ["UPDATE"] } } },
    )).toThrow(/update_columns_conflict/u);
    const sql = renderCaioAttentionGrantSql("helm_caio_attention_ci");
    expect(sql).not.toMatch(/DELETE|ALL PRIVILEGES|GRANT OPTION|\*\./u);
    expect(sql).toContain("GRANT SELECT ON `helm_caio_attention_ci`.`CaioAttentionControl` TO 'attention_web'@'%';");
    // Both identities keep their own grant on a shared Core table.
    expect(sql).toContain("GRANT SELECT, UPDATE ON `helm_caio_attention_ci`.`CaioAnomalyCandidate` TO 'attention_generator'@'%';");
    expect(sql).toContain("GRANT SELECT ON `helm_caio_attention_ci`.`CaioAnomalyCandidate` TO 'attention_web'@'%';");
    expect(sql).toContain("GRANT SELECT ON `helm_caio_attention_ci`.`Membership` TO 'attention_generator'@'%';");
    expect(sql).toContain("GRANT SELECT ON `helm_caio_attention_ci`.`Membership` TO 'attention_web'@'%';");
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE (`revokedAt`, `revokedByRef`, `revokedEpoch`) ON `helm_caio_attention_ci`.`CaioAttentionNodeReadiness` TO 'attention_ops'@'%';");
  });

  it("refuses unsafe identifiers", () => {
    expect(() => renderCaioAttentionGrantSql("x`; DROP DATABASE y; --")).toThrow(/unsafe/u);
    expect(() => renderCaioAttentionGrantSql("helm_caio_attention_ci", "%' OR '1")).toThrow(/unsafe/u);
  });
});
