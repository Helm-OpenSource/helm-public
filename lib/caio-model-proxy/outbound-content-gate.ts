// CAIO model proxy — the outbound content boundary.
//
// LAN passthrough forwards the client's body to an upstream provider with only
// the `model` field replaced. Whatever the caller put in it leaves the
// enterprise network. This gate is the last check before that happens, and it
// applies in BOTH deployment postures — the owner ruling makes the content
// boundary part of "subordinate to governance", not part of the availability
// trade.
//
// ONE DETECTOR, REUSED. The Context Broker already owns hard-boundary
// detection (lib/caio-context-broker/broker-contracts.ts:
// detectHardBoundaryHits + the non-redactable category list). A second
// detector living here would drift from it, so this module only calls it and
// converts hits into a refusal.
//
// WHAT IS REPORTED, AND WHAT IS NOT. The assessment carries CATEGORY CODES
// only — never the matched text, never its offsets, never the body. A refusal
// reason must not become a new way to exfiltrate the very secret it refused.
//
// WHY EVERY CATEGORY DENIES. There is no redaction step on this path: the body
// is forwarded verbatim, so "redact and allow" does not exist here and every
// hit is a denial. Marker categories (local_only_marker,
// unauthorized_material) are additionally NON-REDACTABLE at the broker level —
// they can never be exempted by any future narrowing of this list, because the
// sensitive thing is the document the marker refers to, not the marker text.
//
// KNOWN COST, stated rather than hidden: the detectors are regular expressions
// and include identity-shaped values (email, IPv4/IPv6, UUID). A developer
// prompt that legitimately contains one of those is refused. That is a
// deliberate fail-closed choice for an egress boundary, not an oversight;
// narrowing CAIO_OUTBOUND_DENY_CATEGORIES is a product decision for the owner,
// and the marker categories are not eligible for it.

import {
  HARD_BOUNDARY_CATEGORIES,
  detectHardBoundaryHits,
  isNonRedactableHardBoundaryCategory,
  type HardBoundaryCategory,
} from "@/lib/caio-context-broker/broker-contracts";
import { canonicalJson } from "@/lib/expert-capability/hashing";

/**
 * The categories that refuse an outbound dispatch. Written as an explicit
 * closed list (rather than "everything the broker knows") so the policy is
 * visible in review; a test asserts every non-redactable category is present.
 */
export const CAIO_OUTBOUND_DENY_CATEGORIES: readonly HardBoundaryCategory[] =
  Object.freeze([...HARD_BOUNDARY_CATEGORIES]);

export type CaioOutboundContentAssessment =
  | Readonly<{ denied: false }>
  | Readonly<{
      denied: true;
      /** Category codes only, sorted and de-duplicated. No matched content. */
      categories: readonly HardBoundaryCategory[];
      /** True when at least one hit is in a marker (never-redactable) category. */
      nonRedactable: boolean;
    }>;

/**
 * Typed refusal for a dispatch whose body crosses the hard content boundary.
 * `categories` is safe to log; the body is not, and never travels with it.
 */
export class CaioOutboundContentDeniedError extends Error {
  readonly code = "caio_content_boundary_denied";
  readonly categories: readonly HardBoundaryCategory[];
  readonly nonRedactable: boolean;

  constructor(input: {
    categories: readonly HardBoundaryCategory[];
    nonRedactable: boolean;
  }) {
    super(`caio_content_boundary_denied: ${input.categories.join(",")}`);
    this.name = "CaioOutboundContentDeniedError";
    this.categories = Object.freeze([...input.categories]);
    this.nonRedactable = input.nonRedactable;
  }
}

/**
 * Assess one outbound body. The whole canonical JSON is scanned, so a secret
 * hidden in a nested tool argument or a system prompt is seen exactly like one
 * in the top-level text.
 */
export function assessCaioOutboundContent(
  body: unknown,
): CaioOutboundContentAssessment {
  let serialized: string;
  try {
    serialized = canonicalJson(body);
  } catch {
    // A body that cannot be canonicalized cannot be scanned; refusing to scan
    // is not permission to send.
    return Object.freeze({
      denied: true as const,
      categories: Object.freeze([] as readonly HardBoundaryCategory[]),
      nonRedactable: false,
    });
  }
  const denied = new Set<HardBoundaryCategory>();
  let nonRedactable = false;
  for (const hit of detectHardBoundaryHits(serialized)) {
    if (!CAIO_OUTBOUND_DENY_CATEGORIES.includes(hit.category)) continue;
    denied.add(hit.category);
    if (isNonRedactableHardBoundaryCategory(hit.category)) {
      nonRedactable = true;
    }
  }
  if (denied.size === 0) return Object.freeze({ denied: false as const });
  return Object.freeze({
    denied: true as const,
    categories: Object.freeze([...denied].sort()),
    nonRedactable,
  });
}

/** Throws CaioOutboundContentDeniedError when the body may not leave. */
export function assertCaioOutboundContentAllowed(body: unknown): void {
  const assessment = assessCaioOutboundContent(body);
  if (!assessment.denied) return;
  throw new CaioOutboundContentDeniedError({
    categories: assessment.categories,
    nonRedactable: assessment.nonRedactable,
  });
}
