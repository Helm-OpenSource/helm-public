import { describe, expect, it } from "vitest";

import {
  CAIO_GOAL_LEDGER_CORE_TABLE_GRANTS,
  CAIO_GOAL_LEDGER_FIXTURE_IDENTITIES,
  CAIO_GOAL_LEDGER_GRANT_MATRIX,
  renderCaioGoalLedgerGrantSql,
} from "./least-privilege-fixture";
import { CAIO_GOAL_LEDGER_TABLES } from "./schema-readiness";

const everyGrant = Object.entries({ ...CAIO_GOAL_LEDGER_GRANT_MATRIX, ...CAIO_GOAL_LEDGER_CORE_TABLE_GRANTS })
  .flatMap(([table, byIdentity]) => Object.entries(byIdentity).map(([identity, privileges]) => ({ table, identity, privileges: privileges ?? [] })));

describe("CAIO goal ledger least-privilege fixture", () => {
  it("covers exactly the probed tables, and lists the existing Core tables apart from them", () => {
    expect(Object.keys(CAIO_GOAL_LEDGER_GRANT_MATRIX).sort()).toEqual([...CAIO_GOAL_LEDGER_TABLES].sort());
    for (const table of Object.keys(CAIO_GOAL_LEDGER_CORE_TABLE_GRANTS)) {
      expect(CAIO_GOAL_LEDGER_TABLES as readonly string[], table).not.toContain(table);
    }
  });

  it("never grants DELETE, gives the reader SELECT only, and keeps entries append-only", () => {
    expect(everyGrant.length).toBeGreaterThan(0);
    for (const { table, identity, privileges } of everyGrant) {
      expect(CAIO_GOAL_LEDGER_FIXTURE_IDENTITIES as readonly string[], `${table} ${identity}`).toContain(identity);
      expect(privileges, `${table} ${identity}`).not.toContain("DELETE");
      if (identity === "goal_ledger_reader") expect(privileges, table).toEqual(["SELECT"]);
    }
    expect(CAIO_GOAL_LEDGER_GRANT_MATRIX.CaioGoalLedgerEntry.goal_ledger_ops).toEqual(["SELECT", "INSERT"]);
    expect(CAIO_GOAL_LEDGER_GRANT_MATRIX.CaioGoalLedgerHead.goal_ledger_ops).toEqual(["SELECT", "INSERT", "UPDATE"]);
    expect(CAIO_GOAL_LEDGER_CORE_TABLE_GRANTS.Membership.goal_ledger_reader).toBeUndefined();
    expect(CAIO_GOAL_LEDGER_CORE_TABLE_GRANTS.AuditLog.goal_ledger_reader).toBeUndefined();
  });

  it("renders one GRANT per table and identity, and nothing broader", () => {
    const db = "helm_caio_goal_ledger_ci";
    const sql = renderCaioGoalLedgerGrantSql(db);
    expect(sql).toBe([
      `GRANT SELECT ON \`${db}\`.\`CaioGoalLedgerEntry\` TO 'goal_ledger_reader'@'%';`,
      `GRANT SELECT, INSERT ON \`${db}\`.\`CaioGoalLedgerEntry\` TO 'goal_ledger_ops'@'%';`,
      `GRANT SELECT ON \`${db}\`.\`CaioGoalLedgerHead\` TO 'goal_ledger_reader'@'%';`,
      `GRANT SELECT, INSERT, UPDATE ON \`${db}\`.\`CaioGoalLedgerHead\` TO 'goal_ledger_ops'@'%';`,
      `GRANT SELECT ON \`${db}\`.\`CaioAttentionRouteConfig\` TO 'goal_ledger_reader'@'%';`,
      `GRANT SELECT ON \`${db}\`.\`CaioAttentionRouteConfig\` TO 'goal_ledger_ops'@'%';`,
      `GRANT SELECT ON \`${db}\`.\`CaioAttentionRouteConfigHead\` TO 'goal_ledger_reader'@'%';`,
      `GRANT SELECT ON \`${db}\`.\`CaioAttentionRouteConfigHead\` TO 'goal_ledger_ops'@'%';`,
      `GRANT SELECT ON \`${db}\`.\`Membership\` TO 'goal_ledger_ops'@'%';`,
      `GRANT SELECT, INSERT ON \`${db}\`.\`AuditLog\` TO 'goal_ledger_ops'@'%';`,
      "",
    ].join("\n"));
    expect(sql).not.toMatch(/DELETE|ALL PRIVILEGES|GRANT OPTION|\*\./u);
    expect(renderCaioGoalLedgerGrantSql(db, "127.0.0.1")).toContain("TO 'goal_ledger_ops'@'127.0.0.1';");
  });

  it("refuses unsafe identifiers", () => {
    expect(() => renderCaioGoalLedgerGrantSql("x`; DROP DATABASE y; --")).toThrow(/unsafe MySQL identifier/u);
    expect(() => renderCaioGoalLedgerGrantSql("helm_caio_goal_ledger_ci", "%' OR '1")).toThrow(/unsafe MySQL host/u);
  });
});
