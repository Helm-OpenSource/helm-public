import { parseCaioAttentionRouteRule, type CaioAttentionRouteRule } from "./contracts";
import { registerCaioAttentionScanConfig, resetCaioAttentionScanConfigForTests } from "./reminder-cron";
import type { CaioAttentionEnterpriseScope } from "./routing";
import { parseCaioAttentionPolicy, type CaioAttentionPolicy } from "./schedule";

/**
 * Tenant registration for attention suggestions: the static route rules, the cadence policy and two hooks.
 * Core ships no rule and no policy; until an overlay registers a pack, the generator does nothing, the page service
 * refuses every command and the reminder scan skips. This is the only registration: the same call hands the policy,
 * the route rules and the watchdog role to the reminder scan (reminder-cron.ts), so the two can never disagree.
 *
 *   verifyEnterpriseScope — is this `:enterprise:<slug>` suffix one the workspace really serves? Missing hook = unverified.
 *   applicableAt          — the static rule's applicable window, re-checked at generation time. Missing hook = always.
 */
export type CaioAttentionPack = Readonly<{
  packId: string;
  policy: CaioAttentionPolicy;
  rules: readonly CaioAttentionRouteRule[];
  verifyEnterpriseScope?: (input: { workspaceId: string; slug: string }) => Promise<boolean>;
  applicableAt?: (input: { detectorId: string; reasonCode: string; now: Date }) => boolean;
  /** Route-config role whose holders receive watchdog alerts; OWNERs when absent or unbound. */
  watchdogRoleKey?: string;
}>;

declare global {
  // Shared across Next.js entry bundles, same reason as the operating-context registry.
  var __helmCaioAttentionPack: CaioAttentionPack | undefined;
}

/** One pack per process: a second registration is an error, never a silent merge of two rule sets. */
export function registerCaioAttentionPack(pack: CaioAttentionPack): void {
  if (globalThis.__helmCaioAttentionPack) throw new Error(`caio_attention_pack_already_registered:${pack.packId}`);
  if (!parseCaioAttentionPolicy(pack.policy).ok) throw new Error("caio_attention_policy_invalid");
  if (pack.rules.some((rule) => !parseCaioAttentionRouteRule(rule).ok)) throw new Error("caio_attention_route_rule_invalid");
  globalThis.__helmCaioAttentionPack = pack;
  registerCaioAttentionScanConfig({ policy: pack.policy, routeRules: pack.rules, watchdogRoleKey: pack.watchdogRoleKey });
}

export function getRegisteredCaioAttentionPack(): CaioAttentionPack | null {
  return globalThis.__helmCaioAttentionPack ?? null;
}

export function resetCaioAttentionPackForTests(): void {
  globalThis.__helmCaioAttentionPack = undefined;
  resetCaioAttentionScanConfigForTests();
}

/** First rule for the detector whose reason filter (if any) admits the candidate's reason code. */
export function findCaioAttentionRouteRule(
  rules: readonly CaioAttentionRouteRule[], detectorId: string, reasonCode: string,
): CaioAttentionRouteRule | null {
  return rules.find((rule) => rule.detectorId === detectorId && (!rule.reasonCodes || rule.reasonCodes.includes(reasonCode))) ?? null;
}

export async function resolveCaioAttentionEnterpriseScope(
  pack: CaioAttentionPack, workspaceId: string, slug: string | null,
): Promise<CaioAttentionEnterpriseScope> {
  if (!slug) return "not_applicable";
  if (!pack.verifyEnterpriseScope) return "unverified";
  return (await pack.verifyEnterpriseScope({ workspaceId, slug }).catch(() => false)) ? "verified" : "unverified";
}
