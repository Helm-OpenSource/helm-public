/**
 * Migration readiness probe for the CAIO attention tables (the `migrationReady` input of the capability probe).
 *
 * Fails closed: the schema is ready only when every expected column of every requested table is visible to the
 * current connection and the seeded Control row exists. information_schema lists only tables the session user holds
 * a privilege on, so a caller probes the tables its own identity uses; a table it cannot see reports as missing.
 */
export const CAIO_ATTENTION_SCHEMA_MANIFEST = {
  CaioAttentionControl: [
    "id", "intakeState", "epoch", "openEpoch", "leaseToken", "leaseNodeId", "leaseTargetDeploymentId", "leaseAcquiredAt",
    "leaseExpiresAt", "requiredCloseCapability", "minGuardVersion", "expectedNodesJson", "rowVersion", "updatedByRef", "updatedAt",
  ],
  CaioAttentionRuntimeNode: ["id", "nodeId", "role", "deploymentId", "closeCapabilityVersion", "remindersEnabled", "lastSeenAt"],
  CaioAttentionNodeReadiness: [
    "id", "nodeId", "deploymentId", "closeCapabilityVersion", "guardVersion", "epoch", "verifiedAt", "verifiedByRef",
    "revokedAt", "revokedByRef", "revokedEpoch",
  ],
  CaioAttentionPauseRequest: ["id", "openEpoch", "reasonCode", "requestedByRef", "createdAt"],
} as const satisfies Record<string, readonly string[]>;

export type CaioAttentionTable = keyof typeof CAIO_ATTENTION_SCHEMA_MANIFEST;
export const CAIO_ATTENTION_TABLES = Object.keys(CAIO_ATTENTION_SCHEMA_MANIFEST) as CaioAttentionTable[];

export type CaioAttentionSchemaReadiness =
  | Readonly<{ ready: true; tables: readonly CaioAttentionTable[] }>
  | Readonly<{ ready: false; reason: "schema_incomplete" | "control_row_missing" | "probe_failed"; missing: readonly string[] }>;

export type CaioAttentionSchemaQueryPort = Readonly<{
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}>;

export async function probeCaioAttentionSchemaReadiness(
  client: CaioAttentionSchemaQueryPort,
  tables: readonly CaioAttentionTable[] = CAIO_ATTENTION_TABLES,
): Promise<CaioAttentionSchemaReadiness> {
  if (tables.length === 0 || tables.some((table) => !(table in CAIO_ATTENTION_SCHEMA_MANIFEST))) {
    return { ready: false, reason: "probe_failed", missing: [] };
  }
  try {
    const rows = await client.$queryRawUnsafe<Array<{ tableName: string; columnName: string }>>(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tables.map(() => "?").join(", ")})`,
      ...tables,
    );
    const present = new Set(rows.map((row) => `${String(row.tableName).toLowerCase()}.${String(row.columnName).toLowerCase()}`));
    const missing = tables.flatMap((table) => CAIO_ATTENTION_SCHEMA_MANIFEST[table]
      .filter((column) => !present.has(`${table.toLowerCase()}.${column.toLowerCase()}`))
      .map((column) => `${table}.${column}`));
    if (missing.length > 0) return { ready: false, reason: "schema_incomplete", missing };
    if (tables.includes("CaioAttentionControl")) {
      const control = await client.$queryRawUnsafe<unknown[]>("SELECT `id` FROM `CaioAttentionControl` WHERE `id` = 'global'");
      if (control.length !== 1) return { ready: false, reason: "control_row_missing", missing: ["CaioAttentionControl.global"] };
    }
    return { ready: true, tables: [...tables] };
  } catch {
    return { ready: false, reason: "probe_failed", missing: [] };
  }
}
