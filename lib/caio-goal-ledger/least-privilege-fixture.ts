/**
 * Anonymous least-privilege fixture for the CAIO goal ledger tables: the grant matrix of the ledger's two identities,
 * for an isolated MySQL test database. Deployments provision their own identities from their own ACL plans and merge
 * the reader matrix into whichever identities read the ledger; this fixture only proves on a real MySQL that the
 * matrix is enforceable and sufficient. It never carries a credential.
 *
 *   reader — every identity that reads the ledger: SELECT only.
 *   ops    — the controlled operator command: appends entries and moves the head under an OWNER re-check.
 *
 * Separate from the attention fixture's identities: each fixture proves its own matrix, and neither widens the other.
 */
export const CAIO_GOAL_LEDGER_FIXTURE_IDENTITIES = ["goal_ledger_reader", "goal_ledger_ops"] as const;
export type CaioGoalLedgerFixtureIdentity = (typeof CAIO_GOAL_LEDGER_FIXTURE_IDENTITIES)[number];

export type CaioGoalLedgerPrivilege = "SELECT" | "INSERT" | "UPDATE" | "DELETE";
type GrantMap = Readonly<Record<string, Readonly<Partial<Record<CaioGoalLedgerFixtureIdentity, readonly CaioGoalLedgerPrivilege[]>>>>>;

const S = ["SELECT"] as const;
const SI = ["SELECT", "INSERT"] as const;

/** Tables an identity is absent from receive no privilege at all. No identity is ever granted DELETE. */
export const CAIO_GOAL_LEDGER_GRANT_MATRIX: GrantMap = {
  // Append-only: nobody can change or remove an entry.
  CaioGoalLedgerEntry: { goal_ledger_reader: S, goal_ledger_ops: SI },
  // One row per workspace, inserted with the first entry and then moved by a compare-and-swap on rowVersion.
  CaioGoalLedgerHead: { goal_ledger_reader: S, goal_ledger_ops: ["SELECT", "INSERT", "UPDATE"] },
};

/**
 * Existing Core tables a ledger identity touches. The probe never lists them.
 *   reader — resolves the pinned role-binding version of the attention route configuration.
 *   ops    — checks the pin on write, re-reads the actor's membership inside the write transaction (FOR SHARE needs
 *            SELECT only) and writes one audit row per successful write.
 */
export const CAIO_GOAL_LEDGER_CORE_TABLE_GRANTS: GrantMap = {
  CaioAttentionRouteConfig: { goal_ledger_reader: S, goal_ledger_ops: S },
  CaioAttentionRouteConfigHead: { goal_ledger_reader: S, goal_ledger_ops: S },
  Membership: { goal_ledger_ops: S },
  AuditLog: { goal_ledger_ops: SI },
};

function identifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/u.test(value)) throw new Error(`unsafe MySQL identifier: ${value}`);
  return `\`${value}\``;
}

/** GRANT statements for an existing database whose fixture users already exist (created with random passwords). */
export function renderCaioGoalLedgerGrantSql(database: string, host = "%"): string {
  if (!/^[A-Za-z0-9_.%-]+$/u.test(host)) throw new Error(`unsafe MySQL host: ${host}`);
  const lines: string[] = [];
  for (const [table, byIdentity] of Object.entries({ ...CAIO_GOAL_LEDGER_GRANT_MATRIX, ...CAIO_GOAL_LEDGER_CORE_TABLE_GRANTS })) {
    for (const identity of CAIO_GOAL_LEDGER_FIXTURE_IDENTITIES) {
      const privileges = byIdentity[identity];
      if (privileges) lines.push(`GRANT ${privileges.join(", ")} ON ${identifier(database)}.${identifier(table)} TO '${identity}'@'${host}';`);
    }
  }
  return `${lines.join("\n")}\n`;
}
