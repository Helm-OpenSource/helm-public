# Case Management Sample · Signals

> Public-safe signal contract and first mapper for the case-management sample.

## Current content

- `types.ts` — generic operating-signal identity / scope / trace / commitment types
- `types.test.ts` — deterministic key and tenant pinning tests
- `case/` — case signal mapper + tests using synthetic records
- `../fixtures/` — 100% synthetic case / day-board / employee / qc-issue examples

## Boundaries

- All read-only at the contract level (`maxEffectMode: "read_only"`)
- No auto-execute, no commitment writes (`nonCommitmentOnly: true`)
- All fixtures 100% synthetic; no real customer data

See: [`../README.md`](../README.md) · [extraction spec](../../../docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md)
