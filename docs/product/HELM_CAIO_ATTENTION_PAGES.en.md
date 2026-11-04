---
status: draft
owner: helm-core
created: 2026-11-04
review_after: 2026-12-04
public_safety: English reference for the CAIO attention pages. No tenant data, people, credentials, deployment identifiers or production receipts.
---

# CAIO Operating Attention Pages (English Reference)

> **语言 / Language**: [中文主文本](HELM_CAIO_ATTENTION_PAGES.md) + English reference

Status: pages and guards are formed. Until the lifecycle service and its authorized loader are wired in, the pages use a fail-closed stub that reads and writes no case data. The intake gate defaults to `PAUSED`; this document grants no activation.

## Boundaries

- The system only suggests and prefills people and a due date. People confirm dispatch, submit the disposition receipt and close after review.
- Only in-app targeted reminders; nothing is sent outside automatically. Closing records that operating handling was reviewed, never a business outcome.
- The module never reads or writes the generic governed-task tables (`check:caio-attention`).

## Pages

| Route | Content |
|---|---|
| `/caio/attention` | Queue: every case the member may read, pending (non-terminal) first, then severity and time, 20 per page |
| `/caio/attention/mine` | My cases: where the member is the primary, informed, escalation person or a reviewer of the current confirmed command |
| `/caio/attention/[caseId]` | Detail: object → confirmed command and its changes from the prefill (prefill before confirmation) → receipts, reviews, events → next-step forms |

Forms follow the loader's `allowedOperations`: confirm (prefill editable, live diff against the prefill), ack, note, disposition receipt, review accept/return; for the OWNER also dismiss (awaiting confirmation only), defer (pick an end time), cancel (in progress or awaiting review), reissue a new command version (diff against the current command) and change reviewers. Dismiss and cancel require a reason. The review form asks the reviewer to tick each external evidence item and requires a conclusion.

## Visibility

Pages never reach the database; they call `getCaioAttentionPageService()` only. The authorized loader filters with `canReadCaioAttentionCase`: before confirmation only the OWNER and ADMIN (read-only, a READ audit event per read); after it, the current command's participants and reviewer set. Unauthorized, cross-workspace or inactive members see no rows and get the same 404 as a missing case.

## Page-service contract

Defined in `features/caio-attention/service-contract.ts` and implemented by the lifecycle service:

- `listCases({ viewer, scope: "queue" | "mine", page, pageSize })` — ordering and paging inside the loader.
- `loadCase({ viewer, caseId, sourcePage })` — case view or `not_found`; ADMIN supervisory audit is written in the loader.
- `runCommand(input)` — `confirm`, `reissue`, `defer`, `dismiss`, `cancel`, `assignReviewers`, `ack`, `note`, `submitDisposition`, `reviewAccept`, `reviewReturn`. Each carries `expectedCommandVersion` and `clientRequestId` (idempotency); reviews and reviewer changes also carry `reviewerVersion`. `resumeDeferred` stays system-driven and has no page form. The service re-checks membership, the intake gate and the CAS in its transaction.

Until wired, `features/caio-attention/service.ts` serves a fail-closed stub (empty lists, `not_found`, `service_unavailable`) and exports `CAIO_ATTENTION_PAGE_SERVICE_BOUND = false`. Close capability is derived from the binding: `CAIO_ATTENTION_CLOSE_CAPABILITY_VERSION = BOUND ? 1 : 0`, and `capability.json` must equal it (guard-asserted), so an unbound node heartbeats 0 and attestation is separately blocked by `page_service_unbound`.

## Capability and guard

- The lifecycle service is bound (`lib/caio-attention-runtime/bound-page-service.ts`), so `lib/caio-attention/capability.json` is `closeCapabilityVersion: 1`, meaning the release can close cases. The probe's `pageServiceBound` is decided at runtime: true only when the pages are bound and the overlay has registered the attention pack (with its reminder policy); without it every command answers `service_unavailable` and attestation is blocked by `page_service_unbound`. The intake gate opens only when `requiredCloseCapability` is 1 and every expected node reports capability 1.
- `npm run check:caio-attention` (CI repo-guards): no generic governed-task tables; no direct database access from the page layer; pages read through the page service only; the capability declaration equals the binding-derived value and ships with the close-chain forms; the stub stays closed while unbound.

## Navigation entry

The workspace sidebar and mobile navigation show "Attention cases" as presentation only: hidden while the service is unbound or the member is inactive; shown to OWNER and ADMIN; shown to other members only when they take part in at least one current confirmed command. A failing loader hides the entry and never breaks the shell.
