/**
 * Helm — Shared sensitive-marker scanner for Delivery Engineer
 * static gates.
 *
 * Single source of truth for the regex set that
 *  - `delivery:doctor` runs against core case-management-sample files
 *  - `pack:fixture-check` runs against every fixture in a pack
 *
 * The intent of this scan is narrow: catch **obvious** generic
 * credentials and well-known third-party cloud hostnames before
 * they reach a public release or customer demo. It is NOT a full
 * PII / phone / email / redaction report — those still belong to a
 * future scrub stage, and the check name reflects that.
 *
 * Adding to this list is OK; removing requires a documented Phase 1
 * scope-reduction rationale, because both doctor and pack-fixture-check
 * derive their `*:credential-and-cloud-host-marker-scan` check from
 * this single inventory.
 */

export interface SensitiveMarkerDefinition {
  readonly id: string;
  readonly description: string;
  readonly pattern: RegExp;
}

/**
 * Patterns are anchored against substring presence; they do not have
 * to match the whole file. Every entry includes a short `id` used in
 * `scanForSensitiveMarkers` output so error reports can name which
 * marker fired without leaking the matched substring itself.
 */
export const SENSITIVE_MARKERS: readonly SensitiveMarkerDefinition[] = [
  {
    id: "aws_access_key_id",
    description: "AWS access key id prefix",
    pattern: /AKIA[0-9A-Z]{12,}/,
  },
  {
    id: "bearer_token",
    description: "HTTP Bearer auth header value",
    pattern: /Bearer\s+[A-Za-z0-9._-]{8,}/i,
  },
  {
    id: "openai_secret_key",
    description: "OpenAI / Anthropic-style sk-* secret key",
    pattern: /sk-[A-Za-z0-9_-]{8,}/i,
  },
  {
    id: "slack_token",
    description: "Slack xoxb/xoxp/xoxa style token",
    pattern: /xox[abp]-[A-Za-z0-9-]{8,}/,
  },
  {
    id: "github_token",
    description: "GitHub personal / app / server token prefix",
    pattern: /gh[pous]_[A-Za-z0-9]{16,}/,
  },
  {
    id: "jwt_header_payload",
    description: "JWT-shaped triple-segment base64 token",
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  },
  {
    id: "aliyun_host",
    description: "Aliyun cloud hostname",
    pattern: /aliyuncs(?:\.com)?/i,
  },
  {
    id: "aws_s3_host",
    description: "AWS S3 / general AWS hostname",
    pattern: /\bamazonaws\.com\b/i,
  },
  {
    id: "azure_blob_host",
    description: "Azure blob storage hostname",
    pattern: /\bblob\.core\.windows\.net\b/i,
  },
  {
    id: "tencent_cos_host",
    description: "Tencent Cloud COS / myqcloud hostname",
    pattern: /\b(?:cos\.ap-[a-z0-9-]+|myqcloud\.com)\b/i,
  },
] as const;

/**
 * Scans `content` for any sensitive markers. Returns the IDs of the
 * markers that matched, in the order they appear in
 * `SENSITIVE_MARKERS`. Empty array means "no markers fired".
 *
 * The function returns marker IDs, not matched substrings, on
 * purpose — calling code should report **which kind of leak** was
 * detected without echoing the leaked value back into logs or test
 * fixtures.
 */
export function scanForSensitiveMarkers(content: string): readonly string[] {
  const hits: string[] = [];
  for (const marker of SENSITIVE_MARKERS) {
    if (marker.pattern.test(content)) {
      hits.push(marker.id);
    }
  }
  return hits;
}
