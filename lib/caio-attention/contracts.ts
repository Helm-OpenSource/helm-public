import { z } from "zod";

import { CAIO_REF_PATTERN } from "@/lib/caio-operating-context/contracts";

/**
 * CAIO operating attention cases: contracts only, no IO and no clock.
 * A case is a system suggestion; an OWNER confirms it before anyone is assigned, and closing it records
 * that operating handling was reviewed, never a business outcome. Core treats role keys as opaque
 * strings: overlays register the static rules and the tenant stores the versioned people bindings.
 */

export const CAIO_ATTENTION_ROUTES_SCHEMA_VERSION = "caio-attention-routes/v1";
export const CAIO_ATTENTION_CATEGORIES = ["business", "technical", "compliance"] as const;
export type CaioAttentionCategory = (typeof CAIO_ATTENTION_CATEGORIES)[number];
/** Only warning and critical candidates become cases; info never does. */
export const CAIO_ATTENTION_SEVERITIES = ["warning", "critical"] as const;
export type CaioAttentionSeverity = (typeof CAIO_ATTENTION_SEVERITIES)[number];

const USER_REF_PATTERN = /^user:([A-Za-z0-9_-]{1,191})$/u;
const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;
const ENTERPRISE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;

/** Config stores `user:<id>`; everything downstream compares canonical bare ids only. */
export function parseCaioAttentionUserRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  return USER_REF_PATTERN.exec(ref)?.[1] ?? null;
}

const roleKey = z.string().regex(ROLE_KEY_PATTERN);
const userRefs = z.array(z.string().regex(USER_REF_PATTERN)).max(20)
  .refine((refs) => new Set(refs).size === refs.length, "duplicate_user_ref");
const bindings = z.record(roleKey, userRefs);

const routeConfigSchema = z.object({
  schemaVersion: z.literal(CAIO_ATTENTION_ROUTES_SCHEMA_VERSION),
  roleBindings: bindings,
  // An override list that is present but empty means "nobody holds this role for that enterprise".
  enterpriseOverrides: z.record(z.string().regex(ENTERPRISE_SLUG_PATTERN), bindings).default({}),
}).strict();

export type CaioAttentionRoleBindings = Readonly<Record<string, readonly string[]>>;
export type CaioAttentionRouteConfig = Readonly<{
  roleBindings: CaioAttentionRoleBindings;
  enterpriseOverrides: Readonly<Record<string, CaioAttentionRoleBindings>>;
}>;

const toBareIds = (source: Record<string, string[]>): CaioAttentionRoleBindings =>
  Object.fromEntries(Object.entries(source).map(([key, refs]) => [key, refs.map((ref) => parseCaioAttentionUserRef(ref)!)]));

export function parseCaioAttentionRouteConfig(raw: unknown):
  | { ok: true; config: CaioAttentionRouteConfig }
  | { ok: false; errorCode: "route_config_invalid" } {
  const parsed = routeConfigSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errorCode: "route_config_invalid" };
  return {
    ok: true,
    config: {
      roleBindings: toBareIds(parsed.data.roleBindings),
      enterpriseOverrides: Object.fromEntries(
        Object.entries(parsed.data.enterpriseOverrides).map(([slug, roles]) => [slug, toBareIds(roles)]),
      ),
    },
  };
}

const ref = z.string().regex(CAIO_REF_PATTERN);
const routeRuleSchema = z.object({
  detectorId: ref,
  reasonCodes: z.array(ref).min(1).max(20).optional(),
  category: z.enum(CAIO_ATTENTION_CATEGORIES),
  primaryRoleKey: roleKey,
  primaryFallbackRoleKeys: z.array(roleKey).max(5),
  ccRoleKeys: z.array(roleKey).max(5),
  escalationRoleKey: roleKey,
  // Used when the escalation holder is also the primary (e.g. after a fallback); typically the
  // workspace owner role, so nobody escalates to themselves.
  escalationFallbackRoleKey: roleKey,
  reviewerRoleKey: roleKey,
  reviewerFallbackRoleKey: roleKey,
  compatibleRuleVersions: z.array(ref).min(1).max(10),
  // "owner_required": no due date is suggested and the OWNER must enter one (e.g. next release window).
  committedDue: z.enum(["suggest", "owner_required"]),
}).strict().superRefine((rule, ctx) => {
  // A cc role is never promoted to primary, never reviews and never escalates, so it stays out of every chain.
  const chains = [rule.primaryRoleKey, ...rule.primaryFallbackRoleKeys, rule.reviewerRoleKey, rule.reviewerFallbackRoleKey,
    rule.escalationRoleKey, rule.escalationFallbackRoleKey];
  if (rule.ccRoleKeys.some((key) => chains.includes(key))) ctx.addIssue({ code: "custom", message: "cc_role_in_chain" });
});

export type CaioAttentionRouteRule = z.infer<typeof routeRuleSchema>;

export function parseCaioAttentionRouteRule(raw: unknown):
  | { ok: true; rule: CaioAttentionRouteRule }
  | { ok: false; errorCode: "route_rule_invalid" } {
  const parsed = routeRuleSchema.safeParse(raw);
  return parsed.success ? { ok: true, rule: parsed.data } : { ok: false, errorCode: "route_rule_invalid" };
}

/** Only the trailing `:enterprise:<slug>` suffix counts; the slug still needs the overlay scope hook. */
export function parseCaioAttentionEnterpriseSuffix(mergeKey: string): { base: string; slug: string } | null {
  const match = /^(.+):enterprise:([a-z0-9][a-z0-9-]*)$/u.exec(mergeKey);
  return match ? { base: match[1], slug: match[2] } : null;
}
