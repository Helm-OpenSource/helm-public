# Case Management Sample · Workers

> Worker cookbook with pure rule-based decision functions. Runtime drivers are intentionally not enabled in the public reference.

## Current content

- `worker-modes.ts` — observer / shadow / active mode invariants
- `lifecycle-objectives.ts` — simple recovery / effort / speed objective helper
- `case-allocation-driver/` — assignment recommendation cookbook
- `case-stewardship-driver/` — active-case roster and follow-through cookbook

## Boundaries (hard invariants per driver)

1. `commitment: "suggestion_only"` — always true; never overridable
2. Executable `propose_*_recommendation` outputs require approval; observer-mode copies are suppressed and never enter an approval queue
3. `proposalKey` deterministic (no UUID / no ms timestamps)
4. Closed cases never appear in worker outputs
5. Inactive workforce never receives proposals
6. Stewardship roster sees every active case

These are enforced by unit tests, not policy comments.

## What this is not

- Not a production driver framework
- Not an LLM-as-final-ranker layer (LLM forbidden on commitment paths)
- Not an auto-execute system (every proposal requires explicit human approval)

## Validation

```bash
npx vitest run \
  extensions/case-management-sample/workers/manifest.test.ts \
  extensions/case-management-sample/workers/worker-modes.test.ts \
  extensions/case-management-sample/workers/lifecycle-objectives.test.ts \
  extensions/case-management-sample/workers/case-allocation-driver/decide.test.ts \
  extensions/case-management-sample/workers/case-stewardship-driver/decide.test.ts
```

See: [`../README.md`](../README.md) · [extraction spec](../../../docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md)
