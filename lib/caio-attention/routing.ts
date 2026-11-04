import type { CaioAttentionRouteConfig, CaioAttentionRouteRule } from "./contracts";

/**
 * Prefill resolution and confirm-time validation for attention cases. Pure: membership is passed in as
 * predicates, and the enterprise-scope result comes from the overlay hook. The resolver runs when a
 * suggestion is generated; the validator runs again inside the confirm / reissue transaction, where
 * the OWNER may have edited any prefilled field.
 */

export type CaioAttentionEnterpriseScope = "not_applicable" | "verified" | "unverified";

export type CaioAttentionRoutingBlock = "route_missing" | "enterprise_unverified" | "primary_unavailable"
  | "primary_is_confirmer" | "escalation_unavailable" | "reviewer_unavailable";

export type CaioAttentionRoutingNote =
  | { kind: "primary_fallback"; roleKey: string }
  | { kind: "cc_absent"; roleKey: string };

export type CaioAttentionPrefill = Readonly<Omit<CaioAttentionOwnerCommandPeople, "committedDueAt"> & {
  blocks: readonly CaioAttentionRoutingBlock[];
  notes: readonly CaioAttentionRoutingNote[];
}>;

export type CaioAttentionRouteInput = Readonly<{
  rule: CaioAttentionRouteRule | null;
  config: CaioAttentionRouteConfig | null;
  enterpriseSlug: string | null;
  enterpriseScope: CaioAttentionEnterpriseScope;
  isActive: (userId: string) => boolean;
  confirmerUserId?: string | null;
}>;

const EMPTY_PREFILL = { primaryUserId: null, ccUserIds: [], escalationUserId: null, reviewerUserIds: [], notes: [] };

export function resolveCaioAttentionPrefill(input: CaioAttentionRouteInput): CaioAttentionPrefill {
  const { rule, config, enterpriseSlug, isActive } = input;
  if (!rule || !config) return { ...EMPTY_PREFILL, blocks: ["route_missing"] };
  // An unverified enterprise suffix gets no people at all; the OWNER cannot release it by hand either.
  if (input.enterpriseScope === "unverified") return { ...EMPTY_PREFILL, blocks: ["enterprise_unverified"] };

  const candidates = (roleKey: string): string[] => {
    const defaults = (config.roleBindings[roleKey] ?? []).filter(isActive);
    const override = enterpriseSlug ? config.enterpriseOverrides[enterpriseSlug]?.[roleKey] : undefined;
    if (override === undefined) return defaults;
    if (override.length === 0) return []; // explicitly nobody here: go straight to the fallback chain
    const active = override.filter(isActive);
    return active.length > 0 ? active : defaults;
  };

  const blocks: CaioAttentionRoutingBlock[] = [];
  const notes: CaioAttentionRoutingNote[] = [];
  let primaryUserId: string | null = candidates(rule.primaryRoleKey)[0] ?? null;
  // Fall back only along the declared primary chain; cc roles are structurally excluded from it.
  for (const roleKey of rule.primaryFallbackRoleKeys) {
    if (primaryUserId) break;
    primaryUserId = candidates(roleKey)[0] ?? null;
    if (primaryUserId) notes.push({ kind: "primary_fallback", roleKey });
  }
  if (!primaryUserId) blocks.push("primary_unavailable");
  else if (input.confirmerUserId && primaryUserId === input.confirmerUserId) blocks.push("primary_is_confirmer");

  const ccUserIds: string[] = [];
  for (const roleKey of rule.ccRoleKeys) {
    const people = candidates(roleKey).filter((id) => id !== primaryUserId);
    if (people.length === 0) notes.push({ kind: "cc_absent", roleKey });
    for (const id of people) if (!ccUserIds.includes(id)) ccUserIds.push(id);
  }

  const escalationUserId = candidates(rule.escalationRoleKey)[0] ?? null;
  if (!escalationUserId) blocks.push("escalation_unavailable");

  const eligibleReviewer = (id: string) => id !== primaryUserId && !ccUserIds.includes(id);
  const reviewer = candidates(rule.reviewerRoleKey).find(eligibleReviewer)
    ?? candidates(rule.reviewerFallbackRoleKey).find(eligibleReviewer);
  if (!reviewer) blocks.push("reviewer_unavailable");

  return { primaryUserId, ccUserIds, escalationUserId, reviewerUserIds: reviewer ? [reviewer] : [], blocks, notes };
}

export type CaioAttentionOwnerCommandPeople = Readonly<{
  primaryUserId: string | null;
  ccUserIds: readonly string[];
  escalationUserId: string | null;
  reviewerUserIds: readonly string[];
  committedDueAt: Date | null;
}>;

export type CaioAttentionCommandError = "enterprise_unverified" | "primary_missing" | "primary_inactive"
  | "primary_is_confirmer" | "cc_inactive" | "escalation_missing" | "escalation_inactive" | "reviewer_missing"
  | "reviewer_inactive" | "reviewer_not_capable" | "reviewer_conflict" | "committed_due_missing";

/** Confirm / reissue check on the final (possibly edited) command. Empty result means dispatchable. */
export function validateCaioAttentionOwnerCommand(input: Readonly<{
  command: CaioAttentionOwnerCommandPeople;
  confirmerUserId: string;
  enterpriseScope: CaioAttentionEnterpriseScope;
  isActive: (userId: string) => boolean;
  canReview: (userId: string) => boolean;
}>): CaioAttentionCommandError[] {
  const { command, isActive } = input;
  const errors = new Set<CaioAttentionCommandError>();
  if (input.enterpriseScope === "unverified") errors.add("enterprise_unverified");
  if (!command.primaryUserId) errors.add("primary_missing");
  else if (!isActive(command.primaryUserId)) errors.add("primary_inactive");
  if (command.primaryUserId && command.primaryUserId === input.confirmerUserId) errors.add("primary_is_confirmer");
  if (command.ccUserIds.some((id) => !isActive(id))) errors.add("cc_inactive");
  if (!command.escalationUserId) errors.add("escalation_missing");
  else if (!isActive(command.escalationUserId)) errors.add("escalation_inactive");
  if (command.reviewerUserIds.length === 0) errors.add("reviewer_missing");
  for (const id of command.reviewerUserIds) {
    if (!isActive(id)) errors.add("reviewer_inactive");
    if (!input.canReview(id)) errors.add("reviewer_not_capable");
    if (id === command.primaryUserId || command.ccUserIds.includes(id)) errors.add("reviewer_conflict");
  }
  if (!command.committedDueAt) errors.add("committed_due_missing");
  return [...errors].sort();
}

/** Field names the OWNER changed relative to the prefill; recorded on the confirm event. */
export function diffCaioAttentionPrefill(
  prefill: CaioAttentionOwnerCommandPeople,
  command: CaioAttentionOwnerCommandPeople,
): string[] {
  const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
  const changed: string[] = [];
  if (prefill.primaryUserId !== command.primaryUserId) changed.push("primaryUserId");
  if (!sameList(prefill.ccUserIds, command.ccUserIds)) changed.push("ccUserIds");
  if (prefill.escalationUserId !== command.escalationUserId) changed.push("escalationUserId");
  if (!sameList(prefill.reviewerUserIds, command.reviewerUserIds)) changed.push("reviewerUserIds");
  if (prefill.committedDueAt?.getTime() !== command.committedDueAt?.getTime()) changed.push("committedDueAt");
  return changed;
}
