import {
  ExecutionReceiptOutcome,
  ExecutionReceiptVerificationState,
  type RejectionReasonCode,
} from "@prisma/client";

// Deterministic receipt quality scoring (0-100). Pure function, no IO, no
// randomness: the same receipt always scores the same, so the score can be
// audited and re-derived. The score measures STRUCTURE, not business success:
// a well-evidenced FAILURE receipt scores higher than an evidence-free
// SUCCESS claim — that is the point of the receipt chain.
export type ExecutionReceiptQualityInput = {
  outcome: ExecutionReceiptOutcome;
  evidenceRefCount: number;
  hasNextStep: boolean;
  hasNote: boolean;
  rejectionReasonCode: RejectionReasonCode | null;
  verificationState: ExecutionReceiptVerificationState;
};

export type ExecutionReceiptQuality = {
  score: number;
  flags: string[];
};

const NEGATIVE_OUTCOMES: ExecutionReceiptOutcome[] = [
  ExecutionReceiptOutcome.FAILURE,
  ExecutionReceiptOutcome.NOT_EXECUTED,
  ExecutionReceiptOutcome.REJECTED,
];

export function computeExecutionReceiptQuality(
  input: ExecutionReceiptQualityInput,
): ExecutionReceiptQuality {
  const flags: string[] = [];
  let score = 20; // structured outcome present at all

  if (input.evidenceRefCount >= 1) {
    score += 20;
    if (input.evidenceRefCount >= 2) {
      score += 10;
    }
  } else {
    flags.push("no_evidence_refs");
  }

  if (input.hasNextStep) {
    score += 15;
  } else if (input.outcome !== ExecutionReceiptOutcome.SUCCESS) {
    // A non-success closure without a declared next step is where work
    // silently dies; flag it instead of pretending it is complete.
    flags.push("no_next_step_on_non_success");
  } else {
    score += 5; // success without next step is acceptable but weaker
  }

  if (NEGATIVE_OUTCOMES.includes(input.outcome)) {
    if (input.rejectionReasonCode) {
      score += 15;
    } else {
      flags.push("unclassified_negative_outcome");
    }
  } else {
    score += 15; // positive outcomes do not need a rejection class
  }

  if (input.verificationState === ExecutionReceiptVerificationState.VERIFIED) {
    score += 20;
  } else {
    flags.push("self_reported_only");
  }

  if (!input.hasNote && input.evidenceRefCount === 0) {
    flags.push("bare_receipt");
  }

  return { score: Math.max(0, Math.min(100, score)), flags };
}
