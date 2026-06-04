# Case Management Sample Signals / Case Management Sample 信号

> **语言 / Language**: **中文主文本** + **English reference**

> case-management sample 的 public-safe signal contract 与第一个 mapper。
>
> Public-safe signal contract and first mapper for the case-management sample.

## 当前内容 / Current Content

- `types.ts` — generic operating-signal identity / scope / trace / commitment types
- `types.test.ts` — deterministic key 和 tenant pinning tests
- `case/` — 使用 synthetic records 的 case signal mapper + tests
- `review-packet.ts` — pure preparation helpers from signal -> memory candidate -> review packet
- `../fixtures/` — provenance under review 的 public sample case / day-board / employee / qc-issue examples

## 边界 / Boundaries

- Contract level 全部 read-only（`maxEffectMode: "read_only"`）
- 不 auto-execute，不写 commitment（`nonCommitmentOnly: true`）
- Every signal must carry sourceRef, observed time, subject, confidence, and gap fields before it can become a memory candidate or review packet.
- Memory outputs are candidate-only; review packets are preparation-only and cannot send, approve, execute, write CRM, or promote official memory.
- Public fixtures 不得包含真实客户数据；synthetic evidence gate sign-off 前保持 provenance under review

See / 参见: [`../README.md`](../README.md) · [extraction spec](../../../docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md)
