/**
 * Anonymous least-privilege fixture for the CAIO attention tables: the grant matrix of the attention design
 * (generator / web / operator identities), used verbatim by the `caio-attention-mysql` CI job and by
 * schema.mysql.test.ts. Deployments provision their own identities from their own ACL plans; this fixture only
 * proves on a real MySQL that the matrix is enforceable and sufficient. It never carries a credential.
 *
 *   generator — runs the suggestion generator next to the quick check.
 *   web       — serves the lifecycle, reminders and watchdogs; may only add pause requests to the control plane.
 *   operator  — controlled operator CLI: intake control, deployment lease, readiness proofs, route configs.
 */
export const CAIO_ATTENTION_FIXTURE_IDENTITIES = ["attention_generator", "attention_web", "attention_ops"] as const;
export type CaioAttentionFixtureIdentity = (typeof CAIO_ATTENTION_FIXTURE_IDENTITIES)[number];

export type CaioAttentionPrivilege = "SELECT" | "INSERT" | "UPDATE" | "DELETE";
export type CaioAttentionTableGrant = Readonly<{
  privileges: readonly CaioAttentionPrivilege[];
  /** When set, UPDATE is granted on these columns only. */
  updateColumns?: readonly string[];
}>;

const S = ["SELECT"] as const;
const SI = ["SELECT", "INSERT"] as const;
const SIU = ["SELECT", "INSERT", "UPDATE"] as const;

/** Tables an identity is absent from receive no privilege at all. No identity is ever granted DELETE. */
export const CAIO_ATTENTION_GRANT_MATRIX: Readonly<Record<string, Readonly<Partial<Record<CaioAttentionFixtureIdentity, CaioAttentionTableGrant>>>>> = {
  CaioAttentionControl: { attention_generator: { privileges: S }, attention_web: { privileges: S }, attention_ops: { privileges: SIU } },
  CaioAttentionRuntimeNode: { attention_generator: { privileges: SIU }, attention_web: { privileges: SIU }, attention_ops: { privileges: S } },
  CaioAttentionNodeReadiness: {
    attention_generator: { privileges: S },
    attention_web: { privileges: S },
    attention_ops: { privileges: SIU, updateColumns: ["revokedAt", "revokedByRef", "revokedEpoch"] },
  },
  CaioAttentionPauseRequest: { attention_generator: { privileges: S }, attention_web: { privileges: SI }, attention_ops: { privileges: S } },
  CaioAttentionCase: { attention_generator: { privileges: SI }, attention_web: { privileges: SIU }, attention_ops: { privileges: S } },
  CaioAttentionCaseEvent: { attention_generator: { privileges: SI }, attention_web: { privileges: SI } },
  CaioAttentionDisposition: { attention_web: { privileges: SI } },
  CaioAttentionReview: { attention_web: { privileges: SI } },
  CaioAttentionRouteConfig: { attention_generator: { privileges: S }, attention_web: { privileges: S }, attention_ops: { privileges: SI } },
  CaioAttentionRouteConfigHead: { attention_generator: { privileges: S }, attention_web: { privileges: S }, attention_ops: { privileges: SIU } },
  CaioDetectorEvaluation: { attention_generator: { privileges: SI }, attention_web: { privileges: S } },
};

/**
 * Existing Core tables (not attention tables) that a fixture identity touches, mirroring the deployed ACLs (design
 * v4 §9.1: deployments already grant them). One entry per table holding every identity's grant, so no slice's grant
 * can overwrite another's:
 *   generator — locks the candidate it suggests from (FOR UPDATE needs UPDATE) and reads memberships to skip inactive
 *               people in the prefill.
 *   web       — re-reads membership and role (FOR SHARE) in every lifecycle transaction, writes in-app notices,
 *               reads display names, and reads the quick-check ticks and candidates the watchdogs inspect. The
 *               evidence-source reads belong to lib/caio-attention-runtime/evidence-resolver.ts, which passes its
 *               grants to renderCaioAttentionGrantSql as `extra`; they are merged per table, never spread over.
 * The readiness probe never lists these tables.
 */
export const CAIO_ATTENTION_CORE_TABLE_GRANTS: typeof CAIO_ATTENTION_GRANT_MATRIX = {
  CaioAnomalyCandidate: { attention_generator: { privileges: ["SELECT", "UPDATE"] }, attention_web: { privileges: S } },
  CaioQuickCheckTick: { attention_web: { privileges: S } },
  Membership: { attention_generator: { privileges: S }, attention_web: { privileges: S } },
  Notification: { attention_web: { privileges: SI } },
  User: { attention_web: { privileges: S } },
};

export const CAIO_ATTENTION_FIXTURE_CORE_TABLES = Object.keys(CAIO_ATTENTION_CORE_TABLE_GRANTS);

export function caioAttentionTableGrant(identity: CaioAttentionFixtureIdentity, table: string): CaioAttentionTableGrant | null {
  return (CAIO_ATTENTION_GRANT_MATRIX[table] ?? CAIO_ATTENTION_CORE_TABLE_GRANTS[table])?.[identity] ?? null;
}

function identifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/u.test(value)) throw new Error(`unsafe MySQL identifier: ${value}`);
  return `\`${value}\``;
}

type CaioAttentionGrantMap = typeof CAIO_ATTENTION_GRANT_MATRIX;

/**
 * Per table and identity union of several grant maps. Two maps naming the same table and identity are merged into
 * one grant (privileges unioned); column-scoped UPDATE lists must agree, otherwise the merge refuses.
 */
export function mergeCaioAttentionGrantMaps(...maps: readonly CaioAttentionGrantMap[]): CaioAttentionGrantMap {
  const merged: Record<string, Partial<Record<CaioAttentionFixtureIdentity, CaioAttentionTableGrant>>> = {};
  for (const map of maps) {
    for (const [table, byIdentity] of Object.entries(map)) {
      const target = (merged[table] ??= {});
      for (const identity of CAIO_ATTENTION_FIXTURE_IDENTITIES) {
        const grant = byIdentity[identity];
        if (!grant) continue;
        const previous = target[identity];
        if (previous && JSON.stringify(previous.updateColumns ?? null) !== JSON.stringify(grant.updateColumns ?? null)) {
          throw new Error(`caio_attention_fixture_update_columns_conflict:${table}:${identity}`);
        }
        const privileges = [...new Set([...(previous?.privileges ?? []), ...grant.privileges])];
        target[identity] = grant.updateColumns ? { privileges, updateColumns: grant.updateColumns } : { privileges };
      }
    }
  }
  return merged;
}

/**
 * GRANT statements for an existing database whose fixture users already exist (created with random passwords).
 * `extra` carries grants owned by modules outside this one (the evidence lookups); they are merged per table.
 */
export function renderCaioAttentionGrantSql(database: string, host = "%", extra: CaioAttentionGrantMap = {}): string {
  if (!/^[A-Za-z0-9_.%-]+$/u.test(host)) throw new Error(`unsafe MySQL host: ${host}`);
  const lines: string[] = [];
  for (const [table, byIdentity] of Object.entries(mergeCaioAttentionGrantMaps(CAIO_ATTENTION_GRANT_MATRIX, CAIO_ATTENTION_CORE_TABLE_GRANTS, extra))) {
    for (const identity of CAIO_ATTENTION_FIXTURE_IDENTITIES) {
      const grant = byIdentity[identity];
      if (!grant) continue;
      const privileges = grant.privileges.map((privilege) =>
        privilege === "UPDATE" && grant.updateColumns ? `UPDATE (${grant.updateColumns.map(identifier).join(", ")})` : privilege);
      lines.push(`GRANT ${privileges.join(", ")} ON ${identifier(database)}.${identifier(table)} TO '${identity}'@'${host}';`);
    }
  }
  return `${lines.join("\n")}\n`;
}
