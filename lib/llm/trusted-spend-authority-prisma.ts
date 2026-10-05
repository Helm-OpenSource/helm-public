/** Runtime read-only consumer of a separately provisioned protected registry.
 * No issuance API. Call with the SAME transaction that claims/reserves dispatch. */
import type { Prisma } from "@prisma/client";
import type { GovernedSpendAuthority } from "./model-egress-store.service";
import { parseWorkspaceSpendBudgetPolicy, type WorkspaceSpendBudgetPolicyRow } from "./workspace-spend-budget-policy";
import { reserveSpendInTransaction } from "./spend-reservation-prisma-store";
import type { SpendChargeQuote, ReserveSpendRecord } from "./spend-reservation";
import { authorityDate, authorityHash, authorityRef, canonicalAuthorityJson, computeMaximumCharge,
  exactObject, monthAt, readSignedAuthority, refuse, type AuthorityEnvelope, type AuthorityKind } from "./trusted-spend-authority";

import { verifyTrustedUsageInTransaction, type UsageRegistryConfig } from "./trusted-usage-evidence-prisma";

type Tx = Prisma.TransactionClient;
export type TrustedSpendRegistryConfig = {
  expectedPeriodPolicyVersion: string;
  /** Independently governed key-grant pins, NEVER accepted from a task/request.
   * Empty defaults refuse. Pins alone do not authenticate external provisioning. */
  trustedIssuerGrants: Readonly<Record<string, string>>;
  /** No default attestor, task-supplied evidence or production root. */
  usage?: UsageRegistryConfig;
};
type Workspace = WorkspaceSpendBudgetPolicyRow & { id: string; llmBudgetCurrency: string | null;
  llmBudgetPriceBookRef: string | null; llmBudgetFxPolicyRef: string | null };
type RecordRow = { workspaceId: string; ref: string; kind: string; version: string;
  issuerGrantId: string; envelopeJson: string; signatureBase64: string; contentHash: string; revokedAt: Date | null };
export type IssuerGrantRow = { id: string; workspaceId: string; issuerUserId: string; publicKeyPem: string;
  allowedKindsJson: string; sourceReceiptHash: string; contentHash: string;
  validFrom: Date; validUntil: Date; revokedAt: Date | null };
export function issuerGrantHash(row: IssuerGrantRow): string {
  return authorityHash({ schema: "helm.spend-issuer-grant/v1", id: row.id, workspaceId: row.workspaceId,
    issuerUserId: row.issuerUserId, publicKeyPem: row.publicKeyPem, allowedKindsJson: row.allowedKindsJson,
    sourceReceiptHash: row.sourceReceiptHash, validFrom: row.validFrom.toISOString(), validUntil: row.validUntil.toISOString() });
}
export type TrustedDispatchInput = { workspaceId: string; operationRef: string; attemptRef: string;
  provider: string; model: string; pricingVersion: string; maxInputTokens: number;
  maxOutputTokens: number; requestedMaxOutputTokens: number; leaseMs: number; dispatchLeaseExpiresAt?: Date };

/** Same protected-record verifier for dispatch and terminal settlement. */
export async function readTrustedSpendRecordInTransaction(tx: Tx, workspaceId: string,
  ref: unknown, kind: AuthorityKind, config: TrustedSpendRegistryConfig, expectedHash?: unknown) {
    const target = authorityRef(ref);
    const [row] = await tx.$queryRaw<RecordRow[]>`
      SELECT workspaceId, ref, kind, version, issuerGrantId, envelopeJson, signatureBase64, contentHash, revokedAt
      FROM LLMSpendAuthorityRecord WHERE CAST(workspaceId AS BINARY)=CAST(${workspaceId} AS BINARY)
       AND CAST(ref AS BINARY)=CAST(${target} AS BINARY) FOR SHARE`;
    if (!row || row.workspaceId !== workspaceId || row.ref !== target || row.kind !== kind || row.revokedAt !== null) refuse("record_missing_or_revoked");
    const [grant] = await tx.$queryRaw<IssuerGrantRow[]>`
      SELECT id, workspaceId, issuerUserId, publicKeyPem, allowedKindsJson, sourceReceiptHash,
        contentHash, validFrom, validUntil, revokedAt
      FROM LLMSpendIssuerGrant WHERE CAST(id AS BINARY)=CAST(${row.issuerGrantId} AS BINARY) FOR SHARE`;
    if (!grant || grant.id !== row.issuerGrantId || grant.workspaceId !== workspaceId || grant.revokedAt !== null ||
        !/^sha256:[a-f0-9]{64}$/u.test(grant.sourceReceiptHash) ||
        config.trustedIssuerGrants[grant.id] !== grant.contentHash || issuerGrantHash(grant) !== grant.contentHash) refuse("issuer_untrusted");
    let kinds: unknown; try { kinds = JSON.parse(grant.allowedKindsJson); } catch { return refuse("issuer_purpose_invalid"); }
    if (!Array.isArray(kinds) || canonicalAuthorityJson(kinds) !== grant.allowedKindsJson ||
        kinds.length === 0 || new Set(kinds).size !== kinds.length ||
        kinds.some((k) => !["period", "price", "fx", "budget"].includes(k)) || !kinds.includes(kind)) refuse("issuer_purpose_invalid");
    const [actor] = await tx.$queryRaw<Array<{ userId: string }>>`
      SELECT u.id AS userId FROM Membership m INNER JOIN User u ON CAST(u.id AS BINARY)=CAST(m.userId AS BINARY)
      WHERE CAST(m.workspaceId AS BINARY)=CAST(${workspaceId} AS BINARY)
      AND CAST(m.userId AS BINARY)=CAST(${grant.issuerUserId} AS BINARY)
      AND CAST(m.role AS BINARY)=CAST('OWNER' AS BINARY) AND CAST(m.status AS BINARY)=CAST('ACTIVE' AS BINARY) FOR SHARE`;
    if (!actor || actor.userId !== grant.issuerUserId) refuse("reviewer_inactive");
    const envelope = readSignedAuthority(row.envelopeJson, row.signatureBase64, grant.publicKeyPem);
    if (envelope.workspaceId !== workspaceId || envelope.ref !== target || envelope.kind !== kind ||
        envelope.version !== row.version || envelope.issuerGrantId !== grant.id || envelope.approverId !== grant.issuerUserId ||
        authorityHash(envelope) !== row.contentHash || (expectedHash !== undefined && expectedHash !== row.contentHash)) refuse("record_binding_invalid");
    return { envelope, grant, hash: row.contentHash };
}

export async function resolveTrustedSpendInTransaction(tx: Tx, input: TrustedDispatchInput,
  config: TrustedSpendRegistryConfig): Promise<{ periodKey: string; periodPolicyVersion: string;
    quote: SpendChargeQuote; reservation: ReserveSpendRecord; providerAuthorized: false }> {
  authorityRef(input.workspaceId); authorityRef(input.operationRef); authorityRef(input.attemptRef);
  authorityRef(config.expectedPeriodPolicyVersion);
  for (const n of [input.maxInputTokens, input.maxOutputTokens, input.requestedMaxOutputTokens, input.leaseMs]) {
    if (!Number.isSafeInteger(n) || n <= 0) refuse("request_bound_invalid");
  }
  if (input.requestedMaxOutputTokens > input.maxOutputTokens || input.leaseMs > 1_800_000) refuse("request_bound_invalid");
  const [workspace] = await tx.$queryRaw<Workspace[]>`
    SELECT id, llmBudgetMode, llmMonthlyBudgetMicros, llmBudgetEnforcementMode,
      llmBudgetPeriodPolicyVersion, llmBudgetConfigVersion, llmBudgetApprovalRef,
      llmBudgetUpdatedBy, llmBudgetUpdatedAt, llmBudgetCurrency, llmBudgetPriceBookRef, llmBudgetFxPolicyRef
    FROM Workspace WHERE CAST(id AS BINARY)=CAST(${input.workspaceId} AS BINARY) FOR UPDATE`;
  if (!workspace || workspace.id !== input.workspaceId) refuse("workspace_missing");
  const parsed = parseWorkspaceSpendBudgetPolicy({ row: workspace,
    expectedPeriodPolicyVersion: config.expectedPeriodPolicyVersion });
  if (parsed.status !== "enforce_blocked" || !parsed.declaration || workspace.llmBudgetCurrency !== "USD") refuse("budget_not_enforceable");
  const policy = parsed.declaration;
  const checked: Array<{ envelope: AuthorityEnvelope; grant: IssuerGrantRow }> = [];
  const read = async (ref: unknown, kind: AuthorityKind, expectedHash?: unknown) => {
    const result = await readTrustedSpendRecordInTransaction(tx, input.workspaceId, ref, kind, config, expectedHash);
    checked.push({ envelope: result.envelope, grant: result.grant });
    return result;
  };
  const approval = await read(policy.approvalRef, "budget");
  const budget = exactObject(approval.envelope.payload, ["configVersion", "mode", "limitMicros", "currency",
    "updatedBy", "updatedAt", "periodRef", "periodHash", "priceRef", "priceHash", "fxRef", "fxHash"]);
  if (budget.configVersion !== policy.configVersion || budget.mode !== policy.mode || budget.currency !== "USD" ||
      budget.limitMicros !== (policy.budgetMicros === null ? null : String(policy.budgetMicros)) ||
      budget.updatedBy !== policy.updatedBy || budget.updatedAt !== policy.updatedAt.toISOString() ||
      budget.priceRef !== workspace.llmBudgetPriceBookRef || budget.fxRef !== workspace.llmBudgetFxPolicyRef) refuse("approval_config_mismatch");
  const period = await read(budget.periodRef, "period", budget.periodHash);
  const periodRule = exactObject(period.envelope.payload, ["algorithm", "timezone"]);
  if (period.envelope.version !== config.expectedPeriodPolicyVersion || periodRule.algorithm !== "calendar-month-v1" ||
      typeof periodRule.timezone !== "string") refuse("period_policy_invalid");
  const price = await read(budget.priceRef, "price", budget.priceHash);
  if (price.envelope.version !== input.pricingVersion || price.envelope.payload.provider !== input.provider ||
      price.envelope.payload.model !== input.model) refuse("price_route_mismatch");
  const fx = budget.fxRef === null ? null : await read(budget.fxRef, "fx", budget.fxHash);
  if ((fx === null && budget.fxHash !== null) || (price.envelope.payload.currency === "USD" && fx !== null)) refuse("fx_binding_invalid");
  // Read database time AFTER all waits/locks; no stale caller timestamp admits an expired grant.
  const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
  const now = clock.now;
  const expiresAt = input.dispatchLeaseExpiresAt ?? new Date(now.getTime() + input.leaseMs);
  if (!(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= now ||
      expiresAt.getTime() - now.getTime() > 1_800_000) refuse("dispatch_deadline_invalid");
  for (const { envelope, grant } of checked) {
    if (grant.validFrom > now || grant.validUntil.getTime() <= expiresAt.getTime() ||
        authorityDate(envelope.issuedAt) < grant.validFrom || authorityDate(envelope.issuedAt) > now || authorityDate(envelope.validFrom) > now ||
        authorityDate(envelope.validUntil).getTime() <= expiresAt.getTime()) refuse("authority_expired_or_future");
  }
  const maximumChargeMicros = computeMaximumCharge(price.envelope.payload, fx?.envelope.payload ?? null,
    BigInt(input.maxInputTokens), BigInt(input.requestedMaxOutputTokens));
  const periodKey = monthAt(now, periodRule.timezone);
  const quote: SpendChargeQuote = { contractVersion: 2, operationRef: input.operationRef,
    quoteRef: `quote:${input.attemptRef}`, quoteHash: authorityHash({ operationRef: input.operationRef,
      attemptRef: input.attemptRef, maximumChargeMicros: String(maximumChargeMicros), periodKey,
      approvalHash: approval.hash, priceHash: price.hash, fxHash: fx?.hash ?? null }), maximumChargeMicros,
    budgetCurrency: "USD", providerCurrency: price.envelope.payload.currency as "USD" | "CNY",
    priceBookRef: price.envelope.ref, priceBookVersion: price.envelope.version, priceBookHash: price.hash,
    fxSnapshotRef: fx?.envelope.ref ?? null, fxSnapshotHash: fx?.hash ?? null, policyApprovalRef: policy.approvalRef };
  return { periodKey, periodPolicyVersion: period.envelope.version, quote, providerAuthorized: false,
    reservation: { ...quote, workspaceId: input.workspaceId, periodKey, periodPolicyVersion: period.envelope.version,
      attemptRef: input.attemptRef, budgetConfigVersion: policy.configVersion, budgetMode: policy.mode,
      budgetLimitMicros: policy.budgetMicros, provider: input.provider, model: input.model,
      expiresAt, provenanceState: "complete" } };
}
export async function reserveTrustedSpendInTransaction(tx: Tx, input: TrustedDispatchInput, config: TrustedSpendRegistryConfig) {
  const resolved = await resolveTrustedSpendInTransaction(tx, input, config);
  const admission = await reserveSpendInTransaction(tx, resolved.reservation);
  return { ...resolved, admission };
}
/** Opt-in C3 port; not installed by the default gateway. Terminal is closed until
 * a distinct provider/usage evidence authority exists. No adapter amount is trusted. */
export function createRegisteredGovernedSpendAuthority(config: TrustedSpendRegistryConfig): GovernedSpendAuthority {
  const pinned: TrustedSpendRegistryConfig = { expectedPeriodPolicyVersion: config.expectedPeriodPolicyVersion,
    trustedIssuerGrants: Object.freeze({ ...config.trustedIssuerGrants }),
    usage: config.usage ? { trustedAttestorGrants: Object.freeze({ ...config.usage.trustedAttestorGrants }) } : undefined };
  return {
    async resolveDispatch({ tx, workspaceId, decision, runtime, dispatchLeaseExpiresAt }) {
      const route = decision.routeSnapshot;
      if (!route) refuse("route_missing");
      if (!(dispatchLeaseExpiresAt instanceof Date) || !Number.isFinite(dispatchLeaseExpiresAt.getTime())) refuse("dispatch_deadline_missing");
      if (decision.workspaceRef !== `workspace:${workspaceId}` || runtime.provider !== route.provider || runtime.modelId !== route.modelId) refuse("dispatch_route_binding_invalid");
      return resolveTrustedSpendInTransaction(tx, { workspaceId, operationRef: decision.decisionId,
        attemptRef: decision.decisionId, provider: route.provider, model: route.modelId,
        pricingVersion: route.pricingVersion, maxInputTokens: route.maxInputTokens,
        maxOutputTokens: route.maxOutputTokens, requestedMaxOutputTokens: decision.requestedMaxOutputTokens,
        leaseMs: 60_000, dispatchLeaseExpiresAt }, pinned);
    },
    async verifyTerminal(input) {
      if (!pinned.usage) return refuse("trusted_usage_evidence_unavailable");
      const { evidence, grant } = await verifyTrustedUsageInTransaction(input, pinned.usage);
      const price = await readTrustedSpendRecordInTransaction(input.tx, input.workspaceId,
        input.reserved.priceBookRef, "price", pinned, input.reserved.priceBookHash);
      const fx = input.reserved.fxSnapshotRef === null ? null : await readTrustedSpendRecordInTransaction(
        input.tx, input.workspaceId, input.reserved.fxSnapshotRef, "fx", pinned, input.reserved.fxSnapshotHash);
      const approval = await readTrustedSpendRecordInTransaction(input.tx, input.workspaceId,
        input.reserved.policyApprovalRef, "budget", pinned);
      const budget = exactObject(approval.envelope.payload, ["configVersion", "mode", "limitMicros", "currency", "updatedBy", "updatedAt", "periodRef", "periodHash", "priceRef", "priceHash", "fxRef", "fxHash"]);
      const period = await readTrustedSpendRecordInTransaction(input.tx, input.workspaceId, budget.periodRef, "period", pinned, budget.periodHash);
      const periodRule = exactObject(period.envelope.payload, ["algorithm", "timezone"]);
      // Refresh the database clock after every authority row lock wait.
      const [clock] = await input.tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
      const now = clock.now;
      if (authorityDate(grant.validUntil) <= now || authorityDate(grant.validFrom) > now) refuse("usage_attestor_expired");
      for (const r of [price, ...(fx ? [fx] : []), approval, period]) {
        if (r.grant.validFrom > now || r.grant.validUntil <= now || authorityDate(r.envelope.validFrom) > now ||
            authorityDate(r.envelope.validUntil) <= now) refuse("authority_expired_or_future");
      }
      const route = input.decision.routeSnapshot!;
      const maximum = computeMaximumCharge(price.envelope.payload, fx?.envelope.payload ?? null,
        BigInt(route.maxInputTokens), BigInt(input.decision.requestedMaxOutputTokens));
      if (price.envelope.version !== input.pricingVersion || price.envelope.payload.provider !== grant.provider ||
          price.envelope.payload.model !== grant.model || price.envelope.payload.sku !== grant.sku ||
          budget.priceRef !== input.reserved.priceBookRef || budget.priceHash !== input.reserved.priceBookHash ||
          budget.fxRef !== input.reserved.fxSnapshotRef || budget.fxHash !== input.reserved.fxSnapshotHash || budget.currency !== "USD" ||
          period.envelope.version !== input.reserved.periodPolicyVersion || periodRule.algorithm !== "calendar-month-v1" ||
          typeof periodRule.timezone !== "string" || maximum !== input.reserved.maximumChargeMicros ||
          input.reserved.quoteHash !== authorityHash({ operationRef: input.decision.decisionId, attemptRef: input.decision.decisionId,
            maximumChargeMicros: String(maximum), periodKey: input.reserved.periodKey, approvalHash: approval.hash,
            priceHash: price.hash, fxHash: fx?.hash ?? null })) refuse("usage_price_binding_invalid");
      return computeMaximumCharge(price.envelope.payload, fx?.envelope.payload ?? null,
        BigInt(evidence.promptTokens), BigInt(evidence.completionTokens));
    },
  };
}
