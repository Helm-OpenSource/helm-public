# Helm Operating Judgement Fusion v0.1

Status: contract + offline-eval layer (fixture-only). Advice-only. No real customer data,
no LLM/neural, no execution / writeback / external send / memory promotion.

## What it is

Deterministic fusion of multiple governed, evidence-bound, already `LINKED` weak operating
signals on the **same** business object into **one** advice-only operating judgement that
carries a calibratable confidence — and a held-out evaluation that proves the fused
judgement is more accurate than the single-signal baseline.

This is **not** an enterprise "world model". v0.1 is single-object, multi-signal fusion.
The moat claim it serves: *governed weak-signal fusion that is provably more accurate than
single-signal selection on a sealed held-out set, where every step is auditable,
reviewable, and not self-promoting.*

## The three gaps v0.1 fills (everything else is reused)

1. **Weak-signal fusion** — replaces single-signal pressure-pick with deterministic
   multi-signal fusion over the same object.
2. **Judgement synthesis** — turns multiple signals + evidence + confidence into one
   advice packet (reusing the existing readout/boundary surfaces, not a new packet type).
3. **Confidence calibration** — `confidenceBand` is a self-reported enum; v0.1 adds real
   calibration (Brier, Expected/Max Calibration Error, reliability bins, overconfidence).

Reused verbatim: `OperatingSignalFlowEvent`, the 6 `objectKind`s, `evidenceCoverage`,
`confidenceBand`; `operating-signal-governance` source classes + improvement gate;
`expert-capability` `ExpertOutput`, `PreRegistration`, content hashing,
`validatePreRegistration`, `validateEvaluationRun`, `validateJudgementPacket`.

## Contracts (`lib/operating-judgement-fusion`)

- `OperatingJudgement` / `JudgementFusionInput` / `JudgementFusionResult` (`contract.ts`).
- `fuseOperatingSignals` / `singleSignalBaseline` (`fuse.ts`) — pure functions.
- `computeCalibration` / `pearsonCorrelation` (`calibration.ts`).
- `runFusionHeldoutEval` / `buildFusionPreRegistration` (`eval.ts`).
- `buildOperatingJudgementReadout` / `assertReadoutPublicSafe` (`readout.ts`).

## Fail-closed boundaries (enforced by types + validators + tests)

- **Source-class gate before fusion.** Every input signal carries a source envelope; an
  improvement-use fusion (public/held-out eval, training) hard-rejects
  `fleet_customer_health` / `oss_governance`. The envelope must be bound to the signal
  (`source.signalId === event.signalKey`) or the gate fails.
- **Input public-safety.** A signal with `redactionStatus: "raw_blocked"`, a raw/private
  marker, a private contact/host pattern, or an unsafe (write/send/execute) evidence ref is
  **excluded as a blocker**, never silently stripped.
- **Deterministic only.** `confidenceSource: "llm_ranking"` and cross-tenant signals are
  excluded; `confidence.method` is fixed; there is no model call.
- **Advice only / never self-promotes.** `commitmentClass: "advice"`,
  `humanReviewerRequired: true`, `promotionTriggered: false` (literal), no forbidden action
  refs. The readout exposes only aggregates (never raw `objectRef` / `evidenceRefs`), with
  all adoption guards `false`.

## Falsifiable held-out evaluation

A run is content-bound: the fusion cases are mapped into an expert-capability A/B set and
run through `validatePreRegistration`, so declared A/B/gold/replay/content hashes must equal
hashes recomputed from the actual cases, metric weights must sum to 1 with a positive
margin, and B must contain a synthetic and a boundary-trap case. `validateEvaluationRun`
adds the run-level anti-cheat: a hard-gate failure cannot be masked by a passing score, and
an expert-vs-rules tie is not a pass. The verdict reports lift (fusion accuracy − baseline
accuracy), calibration, and evidence-completeness correlation, and is downgraded from
`fusion_beats_baseline` whenever the set is poisoned, the model is overconfident, the
pre-registration is unbound/tampered, or the run gate fails.

Run it: `npm run eval:operating-judgement-fusion`.

## v0.1 does NOT claim

An enterprise world model is built; the judgement is "calibrated" unless ECE passes; a
capability is promoted (it only produces owner-review evidence); fusion is "more accurate"
unless the held-out lift, no-poison, and non-overconfident gates all hold; coverage of all
operating scenarios.
