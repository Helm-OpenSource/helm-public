/**
 * Closed-set failure reasons for controlled member activation.
 * The message stays the single generic string so existing callers and user-facing copy are unchanged;
 * `code` is for server-side diagnostics only and must not be echoed to unauthenticated clients
 * (e.g. token_consumed vs token_invalid would become a token-state oracle).
 */
export const MEMBER_ACTIVATION_FAILURE_CODES = [
  "activation_disabled",
  "clock_unavailable",
  "issuer_session_invalid",
  "issuer_membership_invalid",
  "issuer_password_format",
  "issuer_credential_missing",
  "issuer_password_mismatch",
  "issuer_changed",
  "target_membership_invalid",
  "target_already_activated",
  "evidence_ref_invalid",
  "password_policy",
  "authority_unavailable",
  "authority_result_invalid",
  "authority_binding_mismatch",
  "token_invalid",
  "token_revoked",
  "token_expired",
  "token_consumed",
  "target_drifted",
  "claim_conflict",
] as const;
export type MemberActivationFailureCode = (typeof MEMBER_ACTIVATION_FAILURE_CODES)[number];
export const MEMBER_ACTIVATION_UNAVAILABLE_MESSAGE = "Member activation unavailable";
export class MemberActivationError extends Error {
  readonly code: MemberActivationFailureCode;
  constructor(code: MemberActivationFailureCode) {
    super(MEMBER_ACTIVATION_UNAVAILABLE_MESSAGE);
    this.name = "MemberActivationError";
    this.code = code;
  }
}
