# Case Allocation Driver / 案件分配 Driver

> **语言 / Language**: **中文主文本** + **English reference**

纯 rule-based sample worker，用于把 open cases 分配给 active reviewers。

Pure rule-based sample worker for assigning open cases to active reviewers.

Boundaries / 边界:

- no IO, DB, connector, runtime registration, or external side effects
- `proposalKind=propose_assignment_recommendation` starts in observer mode and is suppressed
- every output remains `commitment: "suggestion_only"`
- boundary-attempt cases only emit read-only review flags

Validation / 验证:

```bash
npx vitest run extensions/case-management-sample/workers/case-allocation-driver/decide.test.ts
```
