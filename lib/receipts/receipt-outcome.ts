// Shared receipt-outcome taxonomy consumed by both the company-memory and the
// agentos-decision-supervision contracts. Verified outcomes teach; rejected /
// blocked outcomes must flow back as review signals; self-reported outcomes
// only suggest and never raise any usable level or promotion posture.
export const RECEIPT_OUTCOMES = [
  "verified_success",
  "verified_failure",
  "rejected",
  "blocked",
  "self_reported_only",
] as const;

export type ReceiptOutcome = (typeof RECEIPT_OUTCOMES)[number];
