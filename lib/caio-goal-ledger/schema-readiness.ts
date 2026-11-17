/**
 * Migration readiness probe for the CAIO goal ledger tables.
 *
 * Fails closed: the schema is ready only when every expected column of both tables is visible to the current
 * connection. information_schema lists only tables the session user holds a privilege on; both fixture identities
 * read both tables, so a table the caller cannot see reports as missing. Deliberately separate from the attention
 * schema manifest, which feeds that module's release gate.
 */
export const CAIO_GOAL_LEDGER_SCHEMA_MANIFEST = {
  CaioGoalLedgerEntry: [
    "id", "workspaceId", "seq", "entryHash", "prevHash", "entryJson", "documentFileKey", "documentHash", "documentText",
    "effectiveAt", "source", "recordedByUserId", "createdAt",
  ],
  CaioGoalLedgerHead: ["id", "workspaceId", "headSeq", "headHash", "rowVersion", "updatedByUserId", "updatedAt"],
} as const satisfies Record<string, readonly string[]>;

export type CaioGoalLedgerTable = keyof typeof CAIO_GOAL_LEDGER_SCHEMA_MANIFEST;
export const CAIO_GOAL_LEDGER_TABLES = Object.keys(CAIO_GOAL_LEDGER_SCHEMA_MANIFEST) as CaioGoalLedgerTable[];

export type CaioGoalLedgerSchemaReadiness =
  | Readonly<{ ready: true }>
  | Readonly<{ ready: false; reason: "schema_incomplete" | "probe_failed"; missing: readonly string[] }>;

export type CaioGoalLedgerSchemaQueryPort = Readonly<{
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}>;

export async function probeCaioGoalLedgerSchemaReadiness(client: CaioGoalLedgerSchemaQueryPort): Promise<CaioGoalLedgerSchemaReadiness> {
  let rows: Array<{ tableName: string; columnName: string }>;
  try {
    rows = await client.$queryRawUnsafe(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${CAIO_GOAL_LEDGER_TABLES.map(() => "?").join(", ")})`,
      ...CAIO_GOAL_LEDGER_TABLES,
    );
  } catch {
    return { ready: false, reason: "probe_failed", missing: [] };
  }
  // Table names compare case-insensitively: lower_case_table_names differs between platforms.
  const present = new Set(rows.map((row) => `${String(row.tableName).toLowerCase()}.${String(row.columnName).toLowerCase()}`));
  const missing = CAIO_GOAL_LEDGER_TABLES.flatMap((table) => CAIO_GOAL_LEDGER_SCHEMA_MANIFEST[table]
    .filter((column) => !present.has(`${table.toLowerCase()}.${column.toLowerCase()}`))
    .map((column) => `${table}.${column}`));
  return missing.length > 0 ? { ready: false, reason: "schema_incomplete", missing } : { ready: true };
}
