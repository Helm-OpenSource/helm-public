# Helm Public Refactor Plans

## Runtime Upgrade Decomposition (2026-07-10)

### Goal

Reduce the responsibility and review surface of
`lib/helm-v2/runtime-upgrade.ts` without changing its exported API, database
effects, review-first boundaries, or runtime event contracts.

### Architecture Decisions

- Keep `runtime-upgrade.ts` as the orchestration facade and compatibility
  export surface.
- Move pure payload-budget, verification, and reflection calculations into
  focused modules before moving stateful database workflows.
- Preserve every existing import path through facade re-exports.
- Add no dependency and make no schema, migration, route, or UI change.

### Task List

- [x] Extract payload budgeting and verification into one pure module.
- [ ] Extract reflection candidate and job-summary calculations into one pure
  module.
- [ ] Run the focused runtime-upgrade suite after each extraction.
- [ ] Run public typecheck and strict lint for every touched source file.

### Later Checkpoints

- [ ] Separate runtime event parsing from database orchestration.
- [ ] Split continuity read-model construction by operator and business-loop
  responsibility.
- [ ] Review the next largest public hotspots only after the runtime-upgrade
  facade is stable.

### Rollback

Each extraction remains independently revertible. Reverting a slice restores
the previous inline implementation without data migration or runtime cleanup.
