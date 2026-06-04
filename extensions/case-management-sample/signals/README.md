# Case Management Sample · Signals

> Public-safe signal contract and first mapper for the case-management sample.

## Current content

- `types.ts` — generic operating-signal identity / scope / trace / commitment types
- `types.test.ts` — deterministic key and tenant pinning tests
- `case/` — case signal mapper + tests using synthetic records
- `review-packet.ts` — pure preparation helpers from signal -> memory candidate -> review packet
- `../fixtures/` — public sample case / day-board / employee / qc-issue examples with provenance under review

## Boundaries

- All read-only at the contract level (`maxEffectMode: "read_only"`)
- No auto-execute, no commitment writes (`nonCommitmentOnly: true`)
- Every signal must carry sourceRef, observed time, subject, confidence, and gap fields before it can become a memory candidate or review packet.
- Memory outputs are candidate-only; review packets are preparation-only and cannot send, approve, execute, write CRM, or promote official memory.
- Public fixtures must contain no real customer data; keep provenance under review until the synthetic evidence gate is signed off

See: [`../README.md`](../README.md) · [extraction spec](../../../docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md)
