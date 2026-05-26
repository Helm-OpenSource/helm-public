---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2 Data Model v1

## Purpose

This document expands Helm v2 into a planned data model.

It does **not** mean all of these tables already exist on current main.
It means Helm v2 now has an explicit table-design direction before runtime implementation widens.

After Sprint 8, current main already had a narrow v2 runtime persistence layer for:

- `RuntimeEvent`
- `WorkerRun`
- `ArtifactBundle`
- `MemoryItem`
- `ApprovalRequest`
- `ArtifactReview`
- `HumanActionExecution`
- `OfficialWriteIntent`
- `LimitedAutoIntent`
- `OfficialFollowThrough`
- `ConnectorIngestionRecord`
- `RetrievalTrace`

After Sprint 9, current main keeps that same narrow runtime persistence layer and adds richer official receipt / reconciliation posture for:

- `RuntimeEvent`
- `WorkerRun`
- `ArtifactBundle`
- `MemoryItem`
- `ApprovalRequest`
- `ArtifactReview`
- `HumanActionExecution`
- `OfficialWriteIntent`
- `LimitedAutoIntent`
- `ConnectorIngestionRecord`
- `RetrievalTrace`

These tables now also carry richer current-main posture around:

- official write intent receipt / reconciliation trace
- limited auto eligibility / manual-only / blocked posture
- receipt-driven audit / summary writeback decisions
- official follow-through / exception / reconciliation state and resolution write-back

Planned tables beyond these still remain next-layer design, not rollout claims.

## Design rules

1. facts and inferences must not collapse into one field
2. shadow state and official state must remain physically distinguishable
3. reusable execution outputs should become artifacts
4. audit and approval must stay tied to concrete action keys
5. memory promotion must stay explicit and reviewable

## Existing current-main objects to build on

Current main already has:

- `Workspace`
- `Opportunity`
- `Meeting`
- `ActionItem`
- `ApprovalTask`
- `AuditLog`
- `MemoryEntry`

Helm v2 should build on these seams rather than replacing them all at once.

## Planned v2 tables

### 1. `RuntimeObject`

Purpose:

- unify the object graph for workspace / customer / opportunity / meeting / proposal / quote / approval / task / handoff

Suggested fields:

- `id`
- `workspace_id`
- `object_type`
- `object_ref_id`
- `label`
- `status_shadow`
- `status_official`
- `owner_id`
- `priority_score`
- `current_summary`
- `last_event_at`
- `created_at`
- `updated_at`

### 2. `MemoryItem`

Purpose:

- replace single-pool memory semantics with layered memory semantics

Suggested fields:

- `id`
- `workspace_id`
- `kind`
- `scope`
- `namespace`
- `writer`
- `verification`
- `confidence`
- `sensitivity`
- `retention`
- `promotion_rule`
- `supersedes_id`
- `last_validated_at`
- `payload_json`
- `created_at`
- `updated_at`

### 3. `MemoryItemSource`

Purpose:

- attach source provenance explicitly

Suggested fields:

- `id`
- `memory_item_id`
- `source_type`
- `source_id`
- `source_span`
- `trust_class`

### 4. `ArtifactBundle`

Purpose:

- make worker output reusable, reviewable, and traceable

Suggested fields:

- `id`
- `workspace_id`
- `primary_event_type`
- `primary_object_id`
- `bundle_status`
- `approval_tier`
- `recommended_next_action`
- `confidence`
- `open_questions_json`
- `created_by`
- `created_at`
- `updated_at`

### 5. `ArtifactPart`

Purpose:

- store each artifact output explicitly

Suggested fields:

- `id`
- `artifact_bundle_id`
- `artifact_kind`
- `scope`
- `content_ref`
- `summary`
- `approval_tier`
- `created_at`

### 6. `RuntimeEvent`

Purpose:

- make the event layer explicit

Suggested fields:

- `id`
- `workspace_id`
- `event_type`
- `triggered_by`
- `object_refs_json`
- `payload_json`
- `status`
- `created_at`

### 7. `ActionReview`

Purpose:

- tie action-level approval posture to concrete v2 action keys

Suggested fields:

- `id`
- `workspace_id`
- `action_key`
- `approval_tier`
- `review_status`
- `mandatory_reviewers_json`
- `required_approvals_json`
- `risk_review_ref`
- `decision_reason`
- `created_at`
- `resolved_at`

### 8. `HandoffCheckpoint`

Purpose:

- persist stage summaries and restart points for long-running work

Suggested fields:

- `id`
- `workspace_id`
- `object_id`
- `checkpoint_type`
- `summary`
- `payload_json`
- `owner_id`
- `created_at`

### 9. `HumanActionExecution`

Purpose:

- represent the manual execution layer that starts only after an approved draft or approved shadow recommendation

Suggested fields:

- `id`
- `workspace_id`
- `meeting_id`
- `opportunity_id`
- `source_artifact_bundle_id`
- `action_type`
- `audience`
- `execution_intent`
- `execution_boundary`
- `execution_prerequisite`
- `execution_dependency`
- `execution_risk_level`
- `acknowledgement_status`

### 10. `OfficialWriteIntent`

Purpose:

- represent the guarded middle layer between approved shadow / execution proof and actual official system write acknowledgment

Suggested fields:

- `id`
- `workspace_id`
- `meeting_id`
- `opportunity_id`
- `source_artifact_bundle_id`
- `source_human_action_execution_id`
- `official_system_type`
- `official_object_ref`
- `write_action_type`
- `write_payload_draft`
- `write_boundary`
- `write_approval_tier`
- `write_approval_status`
- `write_execution_status`
- `write_acknowledgement_status`
- `write_acknowledgement_payload`
- `write_failure_reason`
- `write_audit_ref`
- `execution_proof_type`
- `execution_proof_payload`
- `execution_writeback_target`
- `follow_through_status`
- `created_at`
- `updated_at`

### 11. `ConnectorIngestionRecord`

Purpose:

- normalize richer connector input before it can influence retrieval or promotion

Suggested fields:

- `id`
- `workspace_id`
- `runtime_event_id`
- `meeting_id`
- `opportunity_id`
- `company_id`
- `ingestion_source_type`
- `ingestion_source_id`
- `ingestion_scope`
- `ingestion_trust_level`
- `ingestion_sensitivity`
- `ingestion_normalization_status`
- `ingestion_promotion_eligibility`
- `ingestion_boundary_note`
- `ingestion_evidence_ref`
- `ingestion_extracted_facts_json`
- `ingestion_draft_payload_json`
- `created_at`
- `updated_at`

### 12. `RetrievalTrace`

Purpose:

- explain which memory / policy / summary refs were loaded or skipped for a runtime

Suggested fields:

- `id`
- `workspace_id`
- `runtime_event_id`
- `meeting_id`
- `opportunity_id`
- `company_id`
- `runtime_label`
- `worker_id`
- `mode`
- `bucket`
- `trigger_key`
- `rationale`
- `loaded_refs_json`
- `skipped_refs_json`
- `evidence_refs_json`
- `source_provenance_json`
- `created_at`
- `updated_at`

## Memory item schema example

```json
{
  "memory_id": "mem_01J...",
  "kind": "object_fact",
  "scope": "object",
  "namespace": "meeting",
  "object_refs": {
    "workspace_id": "ws_123",
    "customer_id": "cust_456",
    "opportunity_id": "opp_789",
    "meeting_id": "mtg_001"
  },
  "source_refs": [
    {
      "type": "meeting",
      "id": "src_123"
    }
  ],
  "writer": "meeting-analyst",
  "verification": "draft",
  "confidence": 0.82,
  "sensitivity": "internal",
  "retention": "until_verified",
  "promotion_rule": "human_confirmed",
  "payload": {}
}
```

## Shadow vs official rule

Helm v2 should keep:

- `shadow` state for AI-suggested progression
- `official` state for reviewed or system-of-record confirmed progression

Examples:

- `opportunity.stage_shadow`
- `opportunity.stage_official`
- `quote.scope_shadow`
- `quote.scope_official`
- `execution_proof`

`execution_proof` is neither `shadow` nor `official`.
It is a separate acknowledgement layer that records what a human says they did, without implying that Helm itself sent, booked, or wrote an official external system.

## Trusted vs untrusted input rule

Trusted:

- CRM
- confirmed meeting facts
- approved docs
- organization knowledge base

Untrusted:

- raw emails
- web content
- external attachments
- free-form customer text
- third-party raw output

No untrusted content should jump directly into long-term promoted memory or high-risk actions without review.

## Migration approach

Helm v2 should not replace current-main objects all at once.

Safer order:

1. keep using `Workspace` / `Meeting` / `Opportunity` / `ApprovalTask` / `AuditLog` / `MemoryEntry`
2. add v2 runtime tables behind them
3. bridge with compatibility helpers
4. promote only once shadow/offical and artifact bundle semantics are proven

## Preserved boundaries

- no full CRM replacement
- no workflow-engine schema explosion
- no finance/admin platform expansion
- no silent commitment writes
