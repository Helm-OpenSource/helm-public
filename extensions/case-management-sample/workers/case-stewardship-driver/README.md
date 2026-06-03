# Case Stewardship Driver / 案件 Stewardship Driver

> **语言 / Language**: **中文主文本** + **English reference**

纯 rule-based sample worker，用于让每个 active case 在关闭前持续可见。

Pure rule-based sample worker that keeps every active case visible until it is closed.

Boundaries / 边界:

- no IO, DB, connector, runtime registration, or external side effects
- outputs roster entries and read-only flags only
- every output remains `commitment: "suggestion_only"`
- it does not assign, close, or escalate a case by itself

Validation / 验证:

```bash
npx vitest run extensions/case-management-sample/workers/case-stewardship-driver/decide.test.ts
```
