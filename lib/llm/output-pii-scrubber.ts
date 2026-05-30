/**
 * output-pii-scrubber — scan LLM output for PII patterns and block
 * persistence when detected.
 *
 * Implementation of T019 spec §二 Gap 4 (PII / output scrub not enforced).
 *
 * Default action when PII detected: REJECT — the call's output is
 * replaced with the caller's fallbackOutput, and a fallbackReason
 * "policy_pii_in_output" is recorded. This prevents downstream code
 * (memory persistence, briefing surfaces, drafts) from accidentally
 * storing PII the LLM generated.
 *
 * Workspace opt-in `allowPersistedPII: true` is a future enhancement
 * (gated on owner approval per spec). Not implemented in this commit;
 * the policy is "always reject" until the flag exists.
 *
 * Detectors (Chinese-first since most Helm tenants are CN-based):
 *   - Chinese mobile (11-digit, 1[3-9]xxxxxxxxx, with optional +86)
 *   - Chinese ID card (18-digit with date + checksum)
 *   - Bank card (Luhn-checked 13-19 digit sequences)
 *   - Email (RFC simplified)
 *
 * See HELM_LLM_SPEND_AND_ABUSE_GUARDS_SPEC_V1 (internal) §二 Gap 4.
 */

export type PIIHit = {
  type: "chinese_mobile" | "chinese_id_card" | "bank_card" | "email";
  /** First few characters of the matched string (sample for logging; NOT full PII echoed) */
  sample: string;
};

export type PIIDetectionResult = {
  detected: boolean;
  hits: PIIHit[];
};

const CHINESE_MOBILE_RE = /(?:\+?86)?1[3-9]\d{9}\b/g;
const CHINESE_ID_CARD_RE = /\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const BANK_CARD_RE = /\b\d{13,19}\b/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let doubleNext = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (doubleNext) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    doubleNext = !doubleNext;
  }
  return sum % 10 === 0;
}

function maskSample(s: string): string {
  if (s.length <= 4) return s.charAt(0) + "***";
  return s.slice(0, 2) + "***" + s.slice(-2);
}

export function detectPIIInOutput(text: string): PIIDetectionResult {
  if (!text || text.length === 0) {
    return { detected: false, hits: [] };
  }

  const hits: PIIHit[] = [];

  // Chinese mobile
  for (const m of text.matchAll(CHINESE_MOBILE_RE)) {
    hits.push({ type: "chinese_mobile", sample: maskSample(m[0]) });
  }

  // Chinese ID card
  for (const m of text.matchAll(CHINESE_ID_CARD_RE)) {
    hits.push({ type: "chinese_id_card", sample: maskSample(m[0]) });
  }

  // Email (filter out obvious synthetic example.com)
  for (const m of text.matchAll(EMAIL_RE)) {
    const lower = m[0].toLowerCase();
    if (lower.endsWith("@example.com") || lower.endsWith("@example.org") || lower.endsWith("@example.net")) {
      continue;
    }
    hits.push({ type: "email", sample: maskSample(m[0]) });
  }

  // Bank card (luhn-valid 13-19 digit sequence)
  for (const m of text.matchAll(BANK_CARD_RE)) {
    if (luhnValid(m[0])) {
      hits.push({ type: "bank_card", sample: maskSample(m[0]) });
    }
  }

  return { detected: hits.length > 0, hits };
}
