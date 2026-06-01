# Case Allocation Driver

Pure rule-based sample worker for assigning open cases to active reviewers.

Boundaries:

- no IO, DB, connector, runtime registration, or external side effects
- `proposalKind=propose_assignment_recommendation` starts in observer mode and is suppressed
- every output remains `commitment: "suggestion_only"`
- boundary-attempt cases only emit read-only review flags

Validation:

```bash
npx vitest run extensions/case-management-sample/workers/case-allocation-driver/decide.test.ts
```
