# Case Management Sample BI Report / Case Management Sample BI 报表

> **语言 / Language**: **中文主文本** + **English reference**

> synthetic daily case activity readout 的 BI report cookbook。它是 static、
> read-only 的 public sample，不接入 runtime delivery。
>
> BI report cookbook for a synthetic daily case activity readout. It is static,
> read-only, and not wired to runtime delivery.

## 当前内容 / Current Content

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

## 边界 / Boundaries

- `maxEffectMode: "read_only"` — 不写入 / no writes
- `customerFacingAllowed: false` — 不在 public mirror 暴露给 end customer / not exposed to end customers in public mirror
- `requiresReviewByDefault: true` — 每份 readout 都走 review gate / every readout passes through review gate
- `nonCommitmentOnly: true` — readout 永远不变成 commitment / readout never becomes commitment

## 不是什么 / What This Is Not

- 不是完整 BI platform / Not a full BI platform
- 不是 real-time reporting（只有 dry-run + tenant-local readout）/ Not real-time reporting (dry-run + tenant-local readout only)
- 默认不连接真实 connector（`authMode=MOCK`）/ Not connected to real connectors out of the box (`authMode=MOCK` default)

## 验证 / Validation

```bash
npx vitest run extensions/case-management-sample/bi-report/manifest.test.ts
```

See / 参见: [`../README.md`](../README.md) · [extraction spec](../../../docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md)
