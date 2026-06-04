# Helm Signal First Mile Selector Recommendation

> Advisory, review-first recommendation. This is not approval, deployment readiness, connector authorization, external send, writeback, or memory promotion.

## Recommendation

| Field | Value |
|---|---|
| Material type | `business_web_app` |
| Access level | `ui_change_allowed` |
| Source family | `web_app` |
| Signal family | `risk` |
| Collection mode | `marked_dom` |
| Disposition mode | `escalate_blocker` |
| Layer | `L0` |
| Confidence | `recommended` |

## Reason

The business UI can emit explicit signal fields without page scraping or writeback.

## Prerequisites

- Use synthetic, redacted, or alias-only content.
- Name the human reviewer before any customer-visible action.
- Add only explicit data-helm-* fields; do not scrape page text.
- Export the ledger locally before HSI fixture conversion.

## Next Commands

- `node templates/signal-first-mile/signal-first-mile-selector.js templates/signal-first-mile/selector-input.sample.json /tmp/helm-sfm-selector-output.md`
- `node templates/signal-first-mile/ledger-to-review-packet.js templates/signal-first-mile/signal-ledger.sample.json /tmp/helm-sfm-review-packet.md`
- `npm run eval:headless-signal-interface -- --fixture templates/signal-first-mile/hsi-fixture.sample.json`

## Acceptance Checks

- Recommended collectionMode is marked_dom.
- Recommended dispositionMode is escalate_blocker.
- No raw_private content enters the public ledger, fixture, or review packet.
- Review packet names a human reviewer and missing evidence before any action.
- HSI fixture eval passes before connector or pack implementation work.

## Forbidden Actions

- `auto_send`
- `auto_approve`
- `auto_writeback`
- `auto_assign_owner`
- `auto_promote_memory`
- `production_credential_collection`

## Boundary

Selector output is advisory and review-first. It is not approval, customer deployment readiness, connector authorization, external send, writeback, or memory promotion.

