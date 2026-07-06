import {
  ExecutionReceiptOutcome,
  ExecutionReceiptVerificationState,
  RejectionReasonCode,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeExecutionReceiptQuality } from "@/lib/receipts/execution-receipt-quality";

describe("computeExecutionReceiptQuality", () => {
  it("scores a verified, evidenced success high", () => {
    const result = computeExecutionReceiptQuality({
      outcome: ExecutionReceiptOutcome.SUCCESS,
      evidenceRefCount: 2,
      hasNextStep: false,
      hasNote: false,
      rejectionReasonCode: null,
      verificationState: ExecutionReceiptVerificationState.VERIFIED,
    });

    expect(result.score).toBe(90);
    expect(result.flags).toEqual([]);
  });

  it("scores a well-evidenced classified rejection above an evidence-free success claim", () => {
    const classifiedRejection = computeExecutionReceiptQuality({
      outcome: ExecutionReceiptOutcome.REJECTED,
      evidenceRefCount: 1,
      hasNextStep: true,
      hasNote: true,
      rejectionReasonCode: RejectionReasonCode.EVIDENCE_MISSING,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
    });
    const bareSuccess = computeExecutionReceiptQuality({
      outcome: ExecutionReceiptOutcome.SUCCESS,
      evidenceRefCount: 0,
      hasNextStep: false,
      hasNote: false,
      rejectionReasonCode: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
    });

    expect(classifiedRejection.score).toBeGreaterThan(bareSuccess.score);
    expect(bareSuccess.flags).toContain("no_evidence_refs");
    expect(bareSuccess.flags).toContain("bare_receipt");
    expect(bareSuccess.flags).toContain("self_reported_only");
  });

  it("flags negative outcomes without a classified reason", () => {
    const result = computeExecutionReceiptQuality({
      outcome: ExecutionReceiptOutcome.FAILURE,
      evidenceRefCount: 0,
      hasNextStep: true,
      hasNote: true,
      rejectionReasonCode: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
    });

    expect(result.flags).toContain("unclassified_negative_outcome");
    expect(result.score).toBe(35);
  });

  it("flags non-success closures that declare no next step", () => {
    const result = computeExecutionReceiptQuality({
      outcome: ExecutionReceiptOutcome.NOT_EXECUTED,
      evidenceRefCount: 1,
      hasNextStep: false,
      hasNote: true,
      rejectionReasonCode: RejectionReasonCode.OTHER,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
    });

    expect(result.flags).toContain("no_next_step_on_non_success");
  });

  it("is deterministic", () => {
    const input = {
      outcome: ExecutionReceiptOutcome.PARTIAL_SUCCESS,
      evidenceRefCount: 3,
      hasNextStep: true,
      hasNote: true,
      rejectionReasonCode: null,
      verificationState: ExecutionReceiptVerificationState.VERIFIED,
    };

    expect(computeExecutionReceiptQuality(input)).toEqual(
      computeExecutionReceiptQuality(input),
    );
  });
});
