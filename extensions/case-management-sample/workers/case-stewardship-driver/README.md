# Case Stewardship Driver

Pure rule-based sample worker that keeps every active case visible until it is closed.

Boundaries:

- no IO, DB, connector, runtime registration, or external side effects
- outputs roster entries and read-only flags only
- every output remains `commitment: "suggestion_only"`
- it does not assign, close, or escalate a case by itself

Validation:

```bash
npx vitest run extensions/case-management-sample/workers/case-stewardship-driver/decide.test.ts
```
