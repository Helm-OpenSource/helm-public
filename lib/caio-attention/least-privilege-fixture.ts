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
 * Existing tables outside the attention set that a fixture identity touches, mirroring the deployed ACLs. Each table
 * holds one entry per identity:
 *   generator — locks the candidate it suggests from (FOR UPDATE needs UPDATE) and reads memberships to skip inactive
 *               people in the prefill.
 *   web       — re-reads membership and role (FOR SHARE) inside every lifecycle transaction.
 */
export const CAIO_ATTENTION_NEIGHBOUR_GRANTS: typeof CAIO_ATTENTION_GRANT_MATRIX = {
  CaioAnomalyCandidate: { attention_generator: { privileges: ["SELECT", "UPDATE"] } },
  Membership: { attention_generator: { privileges: S }, attention_web: { privileges: S } },
};

export function caioAttentionTableGrant(identity: CaioAttentionFixtureIdentity, table: string): CaioAttentionTableGrant | null {
  return CAIO_ATTENTION_GRANT_MATRIX[table]?.[identity] ?? null;
}

function identifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/u.test(value)) throw new Error(`unsafe MySQL identifier: ${value}`);
  return `\`${value}\``;
}

/** GRANT statements for an existing database whose fixture users already exist (created with random passwords). */
export function renderCaioAttentionGrantSql(database: string, host = "%"): string {
  if (!/^[A-Za-z0-9_.%-]+$/u.test(host)) throw new Error(`unsafe MySQL host: ${host}`);
  const lines: string[] = [];
  for (const [table, byIdentity] of Object.entries({ ...CAIO_ATTENTION_GRANT_MATRIX, ...CAIO_ATTENTION_NEIGHBOUR_GRANTS })) {
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
