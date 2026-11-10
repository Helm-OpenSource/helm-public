---
status: active
owner: helm-core
created: 2026-08-24
review_after: 2026-09-24
public_safety: Generic Core deployment controls only. No customer, credential, endpoint, or production receipt data.
---

# Helm Deployment Capability Gates

## Purpose

Core deployment capability gates stop a named effect before its first provider
or persistence sink. They are independent deployment policy inputs. Enabling a
gate does not configure a provider, start a scheduler, grant authorization,
satisfy consent, or bypass another gate required by the same path.

Values accept only case-insensitive `true` or `false`. Explicit `false` and
invalid values deny the named capability. Existing capabilities preserve their
legacy behavior when a key is absent. Outbound voice ASR, automated customer
calls, and SMS are unbound in public Core and default to denied when absent.
Existing `ASR_ENABLED` and `ASR_PROVIDER` settings apply only to conversation
capture. They stay outside this capability matrix, do not select or enable an
outbound voice provider, and are not an outbound voice deployment gate.

## Contract

| Capability | Environment key | Missing-key behavior | Core interception points |
|---|---|---|---|
| LLM provider | `LLM_ENABLED` | Legacy-compatible allow; provider configuration still required | LLM configuration readiness and OpenAI-compatible adapter before `fetch` |
| Engineering review cron | `ENGINEERING_REVIEW_CRON_ENABLED` | Legacy-compatible allow | Timer registration and refresh execution before Git or database access |
| Signal runtime writes | `HELM_SIGNAL_RUNTIME_WRITES_ENABLED` | Legacy-compatible allow | Scheduler registration and runner, signal collection route, registry runner, notification dispatcher, and notification write stores |
| DingTalk runtime sync | `DINGTALK_RUNTIME_SYNC_ENABLED` | Legacy-compatible allow | Hourly sync route and ingestion entry before provider or database access |
| DingTalk workflow bridge | `DINGTALK_WORKFLOW_BRIDGE_ENABLED` | Legacy-compatible allow | Ingestion bridge selection and direct workflow bridge entry |
| Customer-visible send | `HELM_CUSTOMER_VISIBLE_SENDS_ENABLED` | Legacy-compatible allow | Direct DingTalk invite sink and settings path, system mail, signal notification route and dispatcher |
| Outbound voice ASR | `HELM_OUTBOUND_VOICE_ASR_ENABLED` | Safe default deny | No public Core binding; reserved for a separately reviewed outbound voice adapter without fallback or provider racing |
| Automated customer call | `HELM_AUTOMATED_CUSTOMER_CALLS_ENABLED` | Safe default deny | No public Core provider binding; reserved as a required gate for a future separately reviewed adapter |
| SMS send | `HELM_SMS_SENDS_ENABLED` | Safe default deny | No public Core provider binding; reserved as a required gate for a future separately reviewed adapter |
| Financial action | `HELM_FINANCIAL_ACTIONS_ENABLED` | Legacy-compatible allow | Billing settings actions, billing integration and payment-provider adapters, and Stripe, Alipay, and WeChat Pay webhooks before verification or writes |

The generated `.env.example` sets every gate to `false`. That is a safe
fresh-deployment example, not the missing-key compatibility rule. Production
contracts should set every key explicitly and validate the observed values
before startup.

## Composition Rules

- A path requiring one capability checks only that capability. Closing signal
  runtime writes does not close engineering review, LLM, ASR, or DingTalk sync.
- A path that genuinely performs two effects checks both. Signal notification
  dispatch requires signal runtime writes for status persistence and
  customer-visible send for provider delivery.
- DingTalk sync and workflow bridging are separate. Sync may run with bridge
  disabled; direct bridge calls still fail before audit or action creation.
- A future real-customer voice path must pass its outbound ASR and call-dispatch
  gates plus its existing test, provider, consent, and owner controls.
  Conversation-capture ASR configuration or probes cannot satisfy that
  contract.
- `true` is necessary but never sufficient. Existing authentication, feature
  flags, consent, scheduler, provider configuration, and governance checks still
  apply.

## Denial Behavior

HTTP entrypoints return `503` with the stable public-safe shape:

```json
{
  "ok": false,
  "error": "deployment_capability_disabled",
  "capability": "financial_action"
}
```

Internal sinks throw `deployment_capability_disabled:<capability>`. Neither
form includes environment values, credentials, provider responses, or stack
traces.

## Compatibility And Rollback

Missing-key compatibility avoids silently disabling existing open-source
installations. Its tradeoff is that an incomplete production contract can retain
legacy behavior. Production materializers should therefore require all keys,
reject invalid values, and record only non-secret capability decisions.

Rollback is code-only: revert the capability-gate change. This contract has no
schema migration, data mutation, credential change, provider configuration, or
network change.
