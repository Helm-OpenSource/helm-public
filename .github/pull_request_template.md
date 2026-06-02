## Goal

One sentence describing what this PR changes and why it belongs in public Core.

## Scope

- Main files or modules touched:
- Public docs or manifest changes:
- UI surfaces, if any:

## Boundary Check

- [ ] No customer names, private contacts, private domains, internal IPs, credentials, private deployment evidence, or commercial Pack / Overlay implementation details are included.
- [ ] This PR does not introduce automatic external send, broad auto-write, automatic approval, execution, settlement, marketplace, plugin sandbox, or customer commitment paths.
- [ ] If this changes customer-facing wording, recommendation remains distinct from commitment and any risky claim has a boundary, prerequisite, dependency, or non-commitment note.
- [ ] If this touches an integration, connector, or data ingest path, the behavior is read-first or review-first and has a fixture, dry-run, or guard plan.

## Verification

Commands run:

```bash
npm run check:public-docs
npm run check:public-release
```

Commands not run and why:

- `npm run db:reset`:
- `npm run self-check`:
- `npm run check:boundaries`:
- `npm run typecheck`:
- `npm run lint`:
- `npm run test`:
- `npm run build`:
- `npm run e2e`:
- `npm run quality:regression`:

Remaining risk:

## Screenshots Or Recording

Required for UI changes. Otherwise write `N/A`.

## Contribution Rights

- [ ] I have the right to contribute this work under Apache-2.0.
- [ ] Any third-party code or asset license is identified in this PR.

## Owner Gate

Required only for release, certification, external commitment, official brand wording, high-risk boundary, or protected-branch break-glass changes.

- Owner decision needed: `yes` / `no`
- Decision or receipt:
