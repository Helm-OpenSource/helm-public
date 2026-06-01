/**
 * Helm Business Advancement - Phase 3A / PF3A-002
 * Opportunity.updatedAt source audit (planning-only artifact).
 *
 * This artifact resolves PF3A-002 as a source-audit deliverable. It does NOT
 * authorize any runtime change. It captures, deterministically, every
 * application/runtime and operator-run non-test code path found in the current
 * repository that creates, updates, upserts, or otherwise touches Opportunity
 * rows in a way that could cause Prisma's @updatedAt decorator to auto-bump
 * Opportunity.updatedAt. Seed/test fixture writers are intentionally excluded
 * because they do not affect production staleness semantics. It also captures a
 * small set of read-only references so the writer/reader distinction is
 * explicit.
 *
 * The audit feeds the later TPQR-002 staleness heuristic question:
 *
 *   Is "Opportunity.updatedAt < NOW() - 14d" a safe staleness signal,
 *   or does some scheduled / system-only writer auto-bump updatedAt
 *   without any human action?
 *
 * Schema fact: prisma/schema.prisma model Opportunity declares
 *   updatedAt DateTime @updatedAt
 * which means EVERY db.opportunity.update / updateMany / upsert call
 * (regardless of which fields are in `data`) will auto-bump updatedAt.
 *
 * Boundary: this file is planning evidence only. It does not modify the
 * Prisma schema, queries, runtime extractors, CRM connectors, mobile/search
 * surfaces, or any production behavior. It does not authorize:
 *   - schema changes (e.g. lastHumanActivityAt or sync-write-exempt flag)
 *   - runtime adoption of the staleness heuristic
 *   - official writes / auto-sends / auto-approvals
 *   - LLM final ranking
 *   - production query adoption
 */

// ---------------------------------------------------------------------------
// Audit row types
// ---------------------------------------------------------------------------

export type OperationKind =
  | "create"
  | "update"
  | "upsert"
  | "raw_sql"
  | "import_projection"
  | "read_only_reference"
  | "unknown";

export type SourceClass =
  | "human"
  | "system"
  | "mixed"
  | "read_only"
  | "unknown";

export type UpdatedAtBehavior =
  | "explicit_set"
  | "prisma_auto_bump_possible"
  | "no_write"
  | "unknown";

export type StalenessHeuristicImpact =
  | "safe"
  | "conditional"
  | "unsafe"
  | "none";

export interface OpportunityWriterAuditRow {
  /** Stable identifier for this audit row. */
  readonly writerId: string;
  /** Repo-relative file path of the touch site. */
  readonly filePath: string;
  /** file:line or symbol locator pinning the evidence. */
  readonly evidenceLocator: string;
  /** Kind of operation (create / update / upsert / raw_sql / import_projection / read_only_reference / unknown). */
  readonly operationKind: OperationKind;
  /** Triggering source class (human / system / mixed / read_only / unknown). */
  readonly sourceClass: SourceClass;
  /** Whether this code path can touch Opportunity rows in any way. */
  readonly touchesOpportunityRows: boolean;
  /** Whether updatedAt is explicitly set, prisma auto-bumped, not written, or unknown. */
  readonly updatedAtBehavior: UpdatedAtBehavior;
  /** Impact on the planned TPQR-002 staleness heuristic. */
  readonly stalenessHeuristicImpact: StalenessHeuristicImpact;
  /** Short summary of what the path does at the cited evidence locator. */
  readonly evidenceSummary: string;
  /** Boundary notes preserving recommendation/explanation/draft/proof distinctions. */
  readonly boundaryNotes: readonly string[];
}

// ---------------------------------------------------------------------------
// Shared boundary notes (audit row level)
// ---------------------------------------------------------------------------

const SHARED_BOUNDARY_NOTES: readonly string[] = [
  "recommendation != commitment - any audit finding stays advisory until separately approved.",
  "explanation != approval - citing a writer site does not authorize runtime adoption.",
  "draft != send - drafted heuristics must not be acted upon as official changes.",
  "proof != external write success - verifying internal writer set does not authorize outbound writes or sends.",
];

// ---------------------------------------------------------------------------
// Repo-truth audit rows
//
// All evidence locators below were verified against the current repo at the
// time this artifact was authored. The Opportunity schema declares
// updatedAt DateTime @updatedAt in prisma/schema.prisma, so any db.opportunity
// .update / .updateMany / .upsert call auto-bumps updatedAt.
// ---------------------------------------------------------------------------

export const OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT: readonly OpportunityWriterAuditRow[] =
  [
    // -----------------------------------------------------------------------
    // Human-triggered server actions
    // -----------------------------------------------------------------------
    {
      writerId: "PF3A-002-W01",
      filePath: "features/opportunities/actions.ts",
      evidenceLocator: "features/opportunities/actions.ts:96-123 saveOpportunityAction",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Server action gated by getCurrentWorkspaceSession + canManageWorkspaceRecords; performs db.opportunity.update or .create on direct user submission of the opportunity edit form.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-triggered writer; auto-bumping updatedAt here reflects real human activity.",
      ],
    },
    {
      writerId: "PF3A-002-W02",
      filePath: "features/opportunities/actions.ts",
      evidenceLocator: "features/opportunities/actions.ts:161 moveOpportunityStageAction",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Server action requires session + record management capability; updates Opportunity.stage and lossReason on user click.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-triggered stage change; staleness heuristic stays safe for this writer.",
      ],
    },
    {
      writerId: "PF3A-002-W03",
      filePath: "features/opportunities/actions.ts",
      evidenceLocator: "features/opportunities/actions.ts:390 updateOpportunityNextActionAction",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Server action gated by session + capability check; writes nextAction on direct user submission.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-triggered nextAction edit; updatedAt bump reflects real human activity.",
      ],
    },
    {
      writerId: "PF3A-002-W04",
      filePath: "features/opportunities/actions.ts",
      evidenceLocator: "features/opportunities/actions.ts:442 assignOpportunityOwnerAction",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Server action gated by session + record management capability; reassigns ownerId only on direct user click.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-triggered owner assignment; updatedAt bump reflects real human activity.",
      ],
    },
    {
      writerId: "PF3A-002-W05",
      filePath: "features/opportunities/actions.ts",
      evidenceLocator: "features/opportunities/actions.ts:511 bulkUpdateOpportunitiesAction",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "db.opportunity.updateMany on user-submitted batch payload (ids array, stage / ownerId / dueDate); requires record management capability.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-triggered batch edit; updatedAt bump reflects real human activity for every row in the batch.",
      ],
    },
    {
      writerId: "PF3A-002-W06",
      filePath: "features/companies/actions.ts",
      evidenceLocator: "features/companies/actions.ts:72 createOpportunityForCompanyAction",
      operationKind: "create",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Server action; creates a new Opportunity bound to a company on direct user click from the company surface.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-triggered create; new row's updatedAt mirrors createdAt and is human-meaningful.",
      ],
    },
    {
      writerId: "PF3A-002-W07",
      filePath: "features/contacts/actions.ts",
      evidenceLocator: "features/contacts/actions.ts:123 linkContactToOpportunity",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Server action; connects a Contact to an Opportunity via db.opportunity.update({ data: { contacts: { connect } } }) on user click.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-triggered relation edit; updatedAt bump reflects user-initiated relationship change.",
      ],
    },
    {
      writerId: "PF3A-002-W08",
      filePath: "features/contacts/actions.ts",
      evidenceLocator: "features/contacts/actions.ts:181 mergeContactsAction (per-opportunity loop)",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Server action; in a contact-merge flow, walks source.opportunities and rebinds each Opportunity's contacts to the target contact id.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-triggered merge; updatedAt bump reflects deliberate contact reorganization by the user.",
      ],
    },
    {
      writerId: "PF3A-002-W09",
      filePath: "features/inbox/actions.ts",
      evidenceLocator: "features/inbox/actions.ts:198 createOpportunityFromInboxThread",
      operationKind: "create",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Server action; user converts an EmailThread into a new Opportunity from the inbox surface.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-triggered create; new row's updatedAt mirrors createdAt and is human-meaningful.",
      ],
    },

    // -----------------------------------------------------------------------
    // CSV / CRM import flows (human-initiated)
    // -----------------------------------------------------------------------
    {
      writerId: "PF3A-002-W10",
      filePath: "lib/imports/index.ts",
      evidenceLocator: "lib/imports/index.ts:658 CSV opportunity row import",
      operationKind: "create",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Inside the operator-initiated CSV import pipeline; creates Opportunity rows from mapped row data after the user submits an import job.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-initiated import; new rows' updatedAt reflects the import event the operator just performed.",
      ],
    },
    {
      writerId: "PF3A-002-W11",
      filePath: "lib/imports/crm-orchestrator.service.ts",
      evidenceLocator: "lib/imports/crm-orchestrator.service.ts:483 upsertOpportunityFromExternal (update branch)",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "conditional",
      evidenceSummary:
        "Inside upsertOpportunityFromExternal; when identity decision resolves an existing Opportunity, db.opportunity.update writes companyId / ownerId / title / stage / dueDate / nextAction / externalSource / externalSyncedAt / lastProgressAt. Reachable only through an operator-initiated CRM import job in the current repo.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Currently invoked only by operator-initiated CRM import jobs; if a future scheduler routes to this code path, sourceClass MUST be re-classified to mixed or system and the heuristic re-evaluated.",
      ],
    },
    {
      writerId: "PF3A-002-W12",
      filePath: "lib/imports/crm-orchestrator.service.ts",
      evidenceLocator: "lib/imports/crm-orchestrator.service.ts:501 upsertOpportunityFromExternal (create branch)",
      operationKind: "create",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "conditional",
      evidenceSummary:
        "Sibling create branch of the same upsertOpportunityFromExternal helper; creates Opportunity from external CRM payload during a CRM import job.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Currently invoked only by operator-initiated CRM import jobs; if a future scheduler routes to this code path, sourceClass MUST be re-classified to mixed or system and the heuristic re-evaluated.",
      ],
    },
    {
      writerId: "PF3A-002-W13",
      filePath: "lib/imports/crm-orchestrator.service.ts",
      evidenceLocator: "lib/imports/crm-orchestrator.service.ts:811 applyAssociations OPPORTUNITY-COMPANY",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "conditional",
      evidenceSummary:
        "Inside applyAssociations; binds companyId on previously imported Opportunities. Reachable only through an operator-initiated CRM import job.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Currently human-initiated import; status MUST be re-checked if any scheduled job is later wired to invoke applyAssociations.",
      ],
    },
    {
      writerId: "PF3A-002-W14",
      filePath: "lib/imports/crm-orchestrator.service.ts",
      evidenceLocator: "lib/imports/crm-orchestrator.service.ts:823 applyAssociations OPPORTUNITY-CONTACT",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "conditional",
      evidenceSummary:
        "Sibling branch of the same applyAssociations helper; connects contacts to imported Opportunities.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Currently human-initiated import; status MUST be re-checked if any scheduled job is later wired to invoke applyAssociations.",
      ],
    },
    {
      writerId: "PF3A-002-W15",
      filePath: "lib/imports/crm-orchestrator.service.ts",
      evidenceLocator: "lib/imports/crm-orchestrator.service.ts:1353 conflict resolution create",
      operationKind: "create",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Inside the import-conflict resolution flow on /imports/conflicts; creates a fresh Opportunity when an operator resolves a conflict by choosing CREATE_NEW.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Operator-decided create; new row's updatedAt reflects the human resolution action.",
      ],
    },

    // -----------------------------------------------------------------------
    // Policy engine (mixed: governed actions can be auto-within-threshold or human-confirmed)
    // -----------------------------------------------------------------------
    {
      writerId: "PF3A-002-W16",
      filePath: "lib/policies/engine.ts",
      evidenceLocator: "lib/policies/engine.ts:423 ASSIGN_OWNER governed action",
      operationKind: "update",
      sourceClass: "mixed",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "conditional",
      evidenceSummary:
        "Inside the governed-action executor; reassigns Opportunity.ownerId when the ASSIGN_OWNER action runs. The action can be invoked through human approval or, for AUTO_WITHIN_THRESHOLD policy rules, by the policy engine itself.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Policy-driven path is mixed: human-confirmed in most flows, but AUTO_WITHIN_THRESHOLD rules exist (see UPDATE_OPPORTUNITY_STAGE seed config). Heuristic is conditional until runtime planning confirms which trigger ran.",
      ],
    },
    {
      writerId: "PF3A-002-W17",
      filePath: "lib/policies/engine.ts",
      evidenceLocator: "lib/policies/engine.ts:1039 updateOpportunityProgress",
      operationKind: "update",
      sourceClass: "mixed",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "conditional",
      evidenceSummary:
        "Helper updateOpportunityProgress writes stage / nextAction / dueDate; called from UPDATE_OPPORTUNITY_STAGE, CHANGE_DUE_DATE and related governed actions, which can be human-approved or auto-within-threshold.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Mixed source; runtime planning must label each upstream caller before declaring the staleness heuristic safe for these rows.",
      ],
    },

    // -----------------------------------------------------------------------
    // DingTalk readonly connector ingestion (CRITICAL - mixed: hourly cron + manual sync)
    // -----------------------------------------------------------------------
    {
      writerId: "PF3A-002-W18",
      filePath: "lib/connectors/dingtalk-ingestion.ts",
      evidenceLocator: "lib/connectors/dingtalk-ingestion.ts:1287 weekly-report opportunity progress update",
      operationKind: "update",
      sourceClass: "mixed",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "unsafe",
      evidenceSummary:
        "Inside syncDingTalkReadonlyConnector; when an ingested DingTalk weekly report references an Opportunity, it writes lastProgressAt and nextStepSummary via db.opportunity.update. The auto-bumped updatedAt is the critical signal for PF3A-002. syncDingTalkReadonlyConnector is invoked from BOTH (a) app/api/runtime/dingtalk/hourly-sync/route.ts (hourly system cron, triggeredBy: \"system-cron\", actorType: SYSTEM) and (b) features/connectors/actions.ts:502 (user-initiated manual sync). The system cron path means Opportunity.updatedAt can be bumped without any human action on the Opportunity itself.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "This is the load-bearing finding for PF3A-002: a scheduled system writer can bump Opportunity.updatedAt without human action on the Opportunity, which would invalidate a naive updatedAt < NOW() - 14d staleness filter.",
        "Phase 3A does NOT propose a fix here; any sync-exempt rule, lastHumanActivityAt field, or alternative timestamp choice is a separate schema/runtime review.",
      ],
    },

    // -----------------------------------------------------------------------
    // helm-v2 layered runtime (each path reached only after explicit human review)
    // -----------------------------------------------------------------------
    {
      writerId: "PF3A-002-W19",
      filePath: "lib/helm-v2/opportunity-judge-runtime.ts",
      evidenceLocator: "lib/helm-v2/opportunity-judge-runtime.ts:1648 consumeReviewedOpportunityJudgement",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Reached only after a reviewer explicitly confirms or edit-confirms an opportunity-judgement bundle (see reviewOpportunityJudgeRuntime / consumeReviewedOpportunityJudgement). Writes shadow* fields, nextStepSummary, and lastProgressAt; updatedAt is auto-bumped.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Gate is explicit human review; even though the data fields are shadow-only, updatedAt still bumps - acceptable because a human just acted.",
      ],
    },
    {
      writerId: "PF3A-002-W20",
      filePath: "lib/helm-v2/human-action-execution-runtime.ts",
      evidenceLocator: "lib/helm-v2/human-action-execution-runtime.ts:1237 syncManagedNextStepSummary",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Updates the managed nextStepSummary block on the linked Opportunity after a human action execution is acknowledged; reached through human ack flow only.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Human-acknowledged execution; updatedAt bump reflects real human activity adjacent to the Opportunity.",
      ],
    },
    {
      writerId: "PF3A-002-W21",
      filePath: "lib/helm-v2/official-system-integration-runtime.ts",
      evidenceLocator: "lib/helm-v2/official-system-integration-runtime.ts:2452 managed nextStepSummary section",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Refreshes the managed nextStepSummary section on the Opportunity after an official-write related event; gated by the official-system-integration runtime, which runs in response to human review/ack actions.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Reached only via human-driven official-write flow; bump reflects a proximate human action.",
      ],
    },
    {
      writerId: "PF3A-002-W22",
      filePath: "lib/helm-v2/official-system-integration-runtime.ts",
      evidenceLocator: "lib/helm-v2/official-system-integration-runtime.ts:2520 followThrough managed sync",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Refreshes follow-through managed nextStepSummary and (optionally) shadowBlockersSummary on the linked Opportunity; called from the same human-driven official-system-integration flow.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Reached only via human-driven follow-through ack; bump reflects a proximate human action.",
      ],
    },
    {
      writerId: "PF3A-002-W23",
      filePath: "lib/helm-v2/official-system-integration-runtime.ts",
      evidenceLocator: "lib/helm-v2/official-system-integration-runtime.ts:2670 acknowledged crm.update_official_stage",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Inside applyAcknowledgedOfficialWriteSuccess; for crm.update_official_stage, writes Opportunity.stage and lastProgressAt only after a reviewer has acknowledged the official write success.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Reviewer-acknowledged official-write success; bump reflects a deliberate human 已确认.",
      ],
    },
    {
      writerId: "PF3A-002-W24",
      filePath: "lib/helm-v2/official-system-integration-runtime.ts",
      evidenceLocator: "lib/helm-v2/official-system-integration-runtime.ts:2684 acknowledged crm.update_next_action",
      operationKind: "update",
      sourceClass: "human",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "safe",
      evidenceSummary:
        "Sibling branch of applyAcknowledgedOfficialWriteSuccess; for crm.update_next_action, writes nextAction and lastProgressAt only after reviewer ack.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Reviewer-acknowledged official-write success; bump reflects a deliberate human 已确认.",
      ],
    },

    // -----------------------------------------------------------------------
    // Operator-run backfill script (system-class-by-default; not invoked at runtime)
    // -----------------------------------------------------------------------
    {
      writerId: "PF3A-002-W25",
      filePath: "scripts/dingtalk-backfill-from-ingestion.ts",
      evidenceLocator: "scripts/dingtalk-backfill-from-ingestion.ts:504 backfill opportunity progress",
      operationKind: "update",
      sourceClass: "system",
      touchesOpportunityRows: true,
      updatedAtBehavior: "prisma_auto_bump_possible",
      stalenessHeuristicImpact: "unsafe",
      evidenceSummary:
        "Operator-run backfill script. When invoked without --dryRun, writes lastProgressAt and nextStepSummary on Opportunities derived from prior DingTalk ingestion records; bumps updatedAt without any per-row human action.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Backfill is operator-run rather than scheduled, but its effect on updatedAt is system-class: many rows can be bumped at once without per-row human meaning. Runtime planning must consider this when choosing the staleness signal.",
      ],
    },

    // -----------------------------------------------------------------------
    // Read-only references (NOT writers - included to make the distinction explicit)
    // -----------------------------------------------------------------------
    {
      writerId: "PF3A-002-R01",
      filePath: "features/business-advancement/read-model-feasibility.ts",
      evidenceLocator: "features/business-advancement/read-model-feasibility.ts:165",
      operationKind: "read_only_reference",
      sourceClass: "read_only",
      touchesOpportunityRows: false,
      updatedAtBehavior: "no_write",
      stalenessHeuristicImpact: "none",
      evidenceSummary:
        "Documentation string referencing opportunity.updatedAt as the proposed staleness column; no write, no projection, no runtime read.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Read-only documentation reference; included to show that not every Opportunity-related symbol is a writer.",
      ],
    },
    {
      writerId: "PF3A-002-R02",
      filePath: "features/business-advancement/thin-projection-query-review.ts",
      evidenceLocator: "features/business-advancement/thin-projection-query-review.ts:268",
      operationKind: "read_only_reference",
      sourceClass: "read_only",
      touchesOpportunityRows: false,
      updatedAtBehavior: "no_write",
      stalenessHeuristicImpact: "none",
      evidenceSummary:
        "Planning artifact text describing the proposed TPQR-002 filter shape; not a runtime query, not a writer.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Read-only planning text; included to anchor the writer/reader distinction.",
      ],
    },
    {
      writerId: "PF3A-002-R03",
      filePath: "features/workspace/queries.ts",
      evidenceLocator: "features/workspace/queries.ts:145",
      operationKind: "read_only_reference",
      sourceClass: "read_only",
      touchesOpportunityRows: false,
      updatedAtBehavior: "no_write",
      stalenessHeuristicImpact: "none",
      evidenceSummary:
        "Workspace query maps an existing Opportunity row's updatedAt into a derived feed item createdAt field; pure read.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Read-only mapping; does not affect updatedAt.",
      ],
    },
    {
      writerId: "PF3A-002-R04",
      filePath: "lib/recommendations/recommendation.service.ts",
      evidenceLocator: "lib/recommendations/recommendation.service.ts:149",
      operationKind: "read_only_reference",
      sourceClass: "read_only",
      touchesOpportunityRows: false,
      updatedAtBehavior: "no_write",
      stalenessHeuristicImpact: "none",
      evidenceSummary:
        "Recommendation candidate generator reads opportunity.lastProgressAt with updatedAt fallback to compute daysSinceLastTouch; pure read.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Read-only computation; does not affect updatedAt.",
      ],
    },
    {
      writerId: "PF3A-002-R05",
      filePath: "lib/evolution/pattern-detection.service.ts",
      evidenceLocator: "lib/evolution/pattern-detection.service.ts:291",
      operationKind: "read_only_reference",
      sourceClass: "read_only",
      touchesOpportunityRows: false,
      updatedAtBehavior: "no_write",
      stalenessHeuristicImpact: "none",
      evidenceSummary:
        "Pattern detection reads opportunity.lastProgressAt ?? opportunity.updatedAt to anchor evolution windowing; pure read.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Read-only computation; does not affect updatedAt.",
      ],
    },
  ] as const;

// ---------------------------------------------------------------------------
// Conclusion
// ---------------------------------------------------------------------------

export type SourceAuditConclusion =
  | "safe_for_later_thin_read_model_planning"
  | "conditional_requires_runtime_guard"
  | "blocked"
  | "incomplete_audit";

export interface SourceAuditConclusionDecision {
  readonly conclusion: SourceAuditConclusion;
  readonly reason: string;
  readonly residualBlockers: readonly string[];
}

/**
 * Deterministic conclusion logic.
 *
 *  - If any system or mixed writer can auto-bump updatedAt via Prisma, the
 *    later TPQR-002 staleness heuristic stays conditional (or worse); it
 *    must not be declared safe yet.
 *  - If only human writers exist, the heuristic is safe-for-later-planning.
 *  - The audit is "incomplete" if no rows are present.
 */
export function deriveSourceAuditConclusion(
  rows: readonly OpportunityWriterAuditRow[],
): SourceAuditConclusionDecision {
  if (rows.length === 0) {
    return {
      conclusion: "incomplete_audit",
      reason: "No audit rows present; cannot enumerate writers.",
      residualBlockers: ["No writer rows recorded yet."],
    };
  }

  const writers = rows.filter((row) => row.touchesOpportunityRows);

  const unsafeWriters = writers.filter(
    (row) => row.stalenessHeuristicImpact === "unsafe",
  );
  const conditionalWriters = writers.filter(
    (row) => row.stalenessHeuristicImpact === "conditional",
  );

  const systemAutoBump = writers.filter(
    (row) =>
      (row.sourceClass === "system" || row.sourceClass === "mixed") &&
      row.updatedAtBehavior === "prisma_auto_bump_possible",
  );

  const blockers: string[] = [];

  if (unsafeWriters.length > 0) {
    blockers.push(
      `Unsafe writers found: ${unsafeWriters.map((row) => row.writerId).join(", ")}.`,
    );
  }
  if (systemAutoBump.length > 0) {
    blockers.push(
      `System / mixed writers that auto-bump updatedAt: ${systemAutoBump.map((row) => row.writerId).join(", ")}.`,
    );
  }
  if (conditionalWriters.length > 0) {
    blockers.push(
      `Conditional writers requiring later runtime review: ${conditionalWriters.map((row) => row.writerId).join(", ")}.`,
    );
  }

  if (systemAutoBump.length > 0 || unsafeWriters.length > 0) {
    return {
      conclusion: "conditional_requires_runtime_guard",
      reason:
        "At least one system or mixed writer can auto-bump Opportunity.updatedAt via Prisma without per-row human action; the staleness heuristic cannot be declared safe until a later runtime design picks a human-activity-safe field, sync-exempt rule, or alternative timestamp.",
      residualBlockers: blockers,
    };
  }

  if (conditionalWriters.length > 0) {
    return {
      conclusion: "conditional_requires_runtime_guard",
      reason:
        "All writer paths are currently human-triggered, but at least one path is reachable through a flow that could later be re-wired to a scheduler; PF3A-002 stays conditional until that re-wiring decision is made.",
      residualBlockers: blockers,
    };
  }

  return {
    conclusion: "safe_for_later_thin_read_model_planning",
    reason:
      "All Opportunity-touching writers are human-triggered with no system / mixed auto-bump path; the staleness heuristic can be planned as safe (still planning-only).",
    residualBlockers: blockers,
  };
}

// ---------------------------------------------------------------------------
// Evaluator (pure, no side effects)
// ---------------------------------------------------------------------------

export interface SourceAuditCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface SourceAuditEvalSummary {
  readonly totalRows: number;
  readonly writerRowCount: number;
  readonly readOnlyRowCount: number;
  readonly conclusion: SourceAuditConclusionDecision;
  readonly checks: readonly SourceAuditCheckResult[];
  readonly allPassed: boolean;
}

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "may add a schema",
  "may add schema",
  "may create schema",
  "authorizes schema design",
  "may add runtime extractor",
  "may add a runtime extractor",
  "may create extractor",
  "may add event queue",
  "may create event queue",
  "authorizes official write",
  "may auto-write",
  "may auto write",
  "grants execution authority",
  "may auto-send",
  "may auto send",
  "may auto-approve",
  "may auto approve",
  "llm may determine",
  "llm may rank",
  "may change page behavior",
  "may add api route",
  "approves runtime adoption",
  "approves production query adoption",
] as const;

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

function checkAtLeastOneAuditRow(): SourceAuditCheckResult {
  const passed = OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.length > 0;
  return {
    checkName: "at_least_one_audit_row",
    passed,
    detail: passed
      ? `Audit contains ${OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.length} row(s).`
      : "Audit must contain at least one row.",
  };
}

function checkEveryRowHasNonEmptyEvidenceAndBoundary(): SourceAuditCheckResult {
  const violations: string[] = [];
  for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
    if (row.filePath.trim() === "") {
      violations.push(`${row.writerId}: filePath is empty`);
    }
    if (row.evidenceLocator.trim() === "") {
      violations.push(`${row.writerId}: evidenceLocator is empty`);
    }
    if (row.evidenceSummary.trim() === "") {
      violations.push(`${row.writerId}: evidenceSummary is empty`);
    }
    if (row.boundaryNotes.length === 0) {
      violations.push(`${row.writerId}: boundaryNotes is empty`);
    }
    for (const note of row.boundaryNotes) {
      if (note.trim() === "") {
        violations.push(`${row.writerId}: boundaryNotes contains empty string`);
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "every_row_has_non_empty_evidence_and_boundary",
    passed,
    detail: passed
      ? "All rows carry non-empty filePath, evidenceLocator, evidenceSummary, and boundaryNotes."
      : `Empty fields: ${violations.join("; ")}`,
  };
}

function checkReadOnlyRowsAreNotClassifiedAsWriters(): SourceAuditCheckResult {
  const violations: string[] = [];
  for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
    if (row.operationKind === "read_only_reference") {
      if (row.touchesOpportunityRows) {
        violations.push(`${row.writerId}: read_only_reference must have touchesOpportunityRows = false`);
      }
      if (row.sourceClass !== "read_only") {
        violations.push(`${row.writerId}: read_only_reference must have sourceClass = "read_only"`);
      }
      if (row.updatedAtBehavior !== "no_write") {
        violations.push(`${row.writerId}: read_only_reference must have updatedAtBehavior = "no_write"`);
      }
      if (row.stalenessHeuristicImpact !== "none") {
        violations.push(`${row.writerId}: read_only_reference must have stalenessHeuristicImpact = "none"`);
      }
    }
    if (row.sourceClass === "read_only" && row.operationKind !== "read_only_reference") {
      violations.push(`${row.writerId}: sourceClass "read_only" requires operationKind "read_only_reference"`);
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "read_only_rows_are_not_classified_as_writers",
    passed,
    detail: passed
      ? "All read-only rows are properly classified and not treated as writers."
      : `Misclassified rows: ${violations.join("; ")}`,
  };
}

function checkNoRowGrantsRuntimeOrSchemaOrExecutionAuthority(): SourceAuditCheckResult {
  const violations: string[] = [];
  for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
    const fields: string[] = [
      row.evidenceSummary,
      ...row.boundaryNotes,
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${row.writerId}: contains forbidden authorization "${pattern}"`,
          );
        }
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "no_row_grants_runtime_schema_or_execution_authority",
    passed,
    detail: passed
      ? "No row authorizes auto-write, auto-send, execution authority, LLM ranking, schema design, runtime adoption, or production query adoption."
      : `Forbidden patterns: ${violations.join("; ")}`,
  };
}

function checkSystemMixedAutoBumpForcesConditionalConclusion(): SourceAuditCheckResult {
  const writers = OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.filter(
    (row) => row.touchesOpportunityRows,
  );
  const systemAutoBump = writers.filter(
    (row) =>
      (row.sourceClass === "system" || row.sourceClass === "mixed") &&
      row.updatedAtBehavior === "prisma_auto_bump_possible",
  );
  const conclusion = deriveSourceAuditConclusion(
    OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT,
  );
  let passed = true;
  let detail = "Conclusion is consistent with the writer mix.";
  if (systemAutoBump.length > 0) {
    if (
      conclusion.conclusion !== "conditional_requires_runtime_guard" &&
      conclusion.conclusion !== "blocked"
    ) {
      passed = false;
      detail = `System / mixed auto-bump writers exist (${systemAutoBump
        .map((row) => row.writerId)
        .join(", ")}) but conclusion is "${conclusion.conclusion}"; must be conditional_requires_runtime_guard or blocked.`;
    }
  }
  return {
    checkName: "system_or_mixed_auto_bump_forces_conditional_or_blocked",
    passed,
    detail,
  };
}

function checkBoundaryNotesPreserveDistinctions(): SourceAuditCheckResult {
  const violations: string[] = [];
  for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
    const combined = row.boundaryNotes.join(" \n ").toLowerCase();
    for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
      if (!combined.includes(phrase)) {
        violations.push(`${row.writerId}: boundaryNotes missing "${phrase}"`);
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "boundary_notes_preserve_recommendation_explanation_draft_proof",
    passed,
    detail: passed
      ? "All rows preserve recommendation/explanation/draft/proof distinctions in boundaryNotes."
      : `Missing distinctions: ${violations.join("; ")}`,
  };
}

function checkOperationKindsAndSourceClassesValid(): SourceAuditCheckResult {
  const allowedOperation = new Set<OperationKind>([
    "create",
    "update",
    "upsert",
    "raw_sql",
    "import_projection",
    "read_only_reference",
    "unknown",
  ]);
  const allowedSource = new Set<SourceClass>([
    "human",
    "system",
    "mixed",
    "read_only",
    "unknown",
  ]);
  const allowedBehavior = new Set<UpdatedAtBehavior>([
    "explicit_set",
    "prisma_auto_bump_possible",
    "no_write",
    "unknown",
  ]);
  const allowedImpact = new Set<StalenessHeuristicImpact>([
    "safe",
    "conditional",
    "unsafe",
    "none",
  ]);
  const violations: string[] = [];
  for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
    if (!allowedOperation.has(row.operationKind)) {
      violations.push(`${row.writerId}: invalid operationKind "${row.operationKind}"`);
    }
    if (!allowedSource.has(row.sourceClass)) {
      violations.push(`${row.writerId}: invalid sourceClass "${row.sourceClass}"`);
    }
    if (!allowedBehavior.has(row.updatedAtBehavior)) {
      violations.push(`${row.writerId}: invalid updatedAtBehavior "${row.updatedAtBehavior}"`);
    }
    if (!allowedImpact.has(row.stalenessHeuristicImpact)) {
      violations.push(`${row.writerId}: invalid stalenessHeuristicImpact "${row.stalenessHeuristicImpact}"`);
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "operation_kinds_and_source_classes_valid",
    passed,
    detail: passed
      ? "All rows use allowed operationKind, sourceClass, updatedAtBehavior, and stalenessHeuristicImpact values."
      : `Invalid values: ${violations.join("; ")}`,
  };
}

function checkWriterIdsAreUnique(): SourceAuditCheckResult {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
    if (seen.has(row.writerId)) {
      duplicates.push(row.writerId);
    } else {
      seen.add(row.writerId);
    }
  }
  const passed = duplicates.length === 0;
  return {
    checkName: "writer_ids_are_unique",
    passed,
    detail: passed
      ? "All writerId values are unique."
      : `Duplicate writerIds: ${duplicates.join(", ")}`,
  };
}

export function evaluateOpportunityUpdatedAtSourceAudit(): SourceAuditEvalSummary {
  const checks: SourceAuditCheckResult[] = [
    checkAtLeastOneAuditRow(),
    checkEveryRowHasNonEmptyEvidenceAndBoundary(),
    checkReadOnlyRowsAreNotClassifiedAsWriters(),
    checkNoRowGrantsRuntimeOrSchemaOrExecutionAuthority(),
    checkSystemMixedAutoBumpForcesConditionalConclusion(),
    checkBoundaryNotesPreserveDistinctions(),
    checkOperationKindsAndSourceClassesValid(),
    checkWriterIdsAreUnique(),
  ];
  const writerRowCount = OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.filter(
    (row) => row.touchesOpportunityRows,
  ).length;
  const readOnlyRowCount = OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.filter(
    (row) => !row.touchesOpportunityRows,
  ).length;
  return {
    totalRows: OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.length,
    writerRowCount,
    readOnlyRowCount,
    conclusion: deriveSourceAuditConclusion(
      OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT,
    ),
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
