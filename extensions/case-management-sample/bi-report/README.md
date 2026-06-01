# Case Management Sample · BI Report

> BI report cookbook for a synthetic daily case activity readout. It is static, read-only, and not wired to runtime delivery.

## Current content

```
report-skills/
└── daily-activity-readout/
    ├── query.sql                # synthetic schema only
    ├── schema.json
    ├── metrics.json
    ├── result-criteria.json
    ├── prompt.md
    ├── message-template.md
    ├── skill.json
    └── sample-input.json

resources/
└── case-management-sample.daily.resource.yaml
```

## Boundaries

- `maxEffectMode: "read_only"` — no writes
- `customerFacingAllowed: false` — not exposed to end customers in public mirror
- `requiresReviewByDefault: true` — every readout passes through review gate
- `nonCommitmentOnly: true` — readout never becomes commitment

## What this is not

- Not a full BI platform
- Not real-time reporting (dry-run + tenant-local readout only)
- Not connected to real connectors out of the box (`authMode=MOCK` default)

## Validation

```bash
npx vitest run extensions/case-management-sample/bi-report/manifest.test.ts
```

See: [`../README.md`](../README.md) · [extraction spec](../../../docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md)
