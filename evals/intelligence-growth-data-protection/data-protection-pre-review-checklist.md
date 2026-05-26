# IGS Data Protection Pre-Review Checklist

Status: pending DPO review.

This checklist is the human-readable companion for `eval:intelligence-growth-data-protection-manifest`.
Passing the gate means the offline IGS fixture corpus has a complete redaction manifest and no detected raw PII / credential / cross-tenant alias incident. It does not mean Data Protection approval is granted.

## Required Before P1+

- Data Protection reviewer signs a real receipt outside this pending fixture.
- Founder approval and required reviewer approval are recorded before runtime or live calibration use.
- Redacted live calibration evidence is reviewed separately.
- Runtime, production query, API, UI, canonical memory write, prompt or policy update, and skill auto-promotion remain No-Go.

## Pending V1 Scope

- 17 checked-in IGS fixture JSON files.
- 10 intelligence growth dimensions.
- All manifest entries remain `dpReviewStatus: pending`.
- `reviewer-signoff-receipts.json` intentionally contains no approved receipt.
