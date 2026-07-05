/**
 * Helm Business Advancement — self-tenant event intake map.
 *
 * Pure reference map from the four approved self-tenant event classes to the
 * EXISTING review-first surfaces, actions, and models that carry them. It is
 * the code-anchored companion of the self-tenant minimal-live gate: minimal
 * live usage reuses standard surfaces instead of adding new intake paths.
 *
 * It is NOT a runtime adapter, NOT a DB reader, NOT an API, NOT a page
 * integration, NOT a schema change, NOT an official write path, and NOT
 * automated execution authority.
 */

import {
  SELF_TENANT_EVENT_CLASSES,
  type SelfTenantEventClass,
} from "./self-tenant-minimal-live-gate";

export const SELF_TENANT_EVENT_INTAKE_MAP_RULE_VERSION =
  "business-advancement-self-tenant-event-intake-map/v1" as const;

export type SelfTenantIntakeReviewPosture = "review_first";

export interface SelfTenantEventIntakeRoute {
  readonly eventClass: SelfTenantEventClass;
  readonly labelZh: string;
  readonly labelEn: string;
  /** Existing pages a workspace member uses to enter this event class. */
  readonly existingSurfaces: readonly string[];
  /** Existing server actions / services that persist the objects. */
  readonly existingEntryPoints: readonly string[];
  /** Existing Prisma models that carry the resulting objects. */
  readonly targetModels: readonly string[];
  readonly reviewPosture: SelfTenantIntakeReviewPosture;
  readonly boundaryNote: string;
}

export const SELF_TENANT_EVENT_INTAKE_ROUTES: readonly SelfTenantEventIntakeRoute[] =
  [
    {
      eventClass: "lead_or_customer_contact",
      labelZh: "线索 / 客户接触",
      labelEn: "Lead / customer contact",
      existingSurfaces: [
        "app/(workspace)/companies",
        "app/(workspace)/contacts",
        "app/(workspace)/opportunities",
      ],
      existingEntryPoints: [
        "features/opportunities/actions.ts#saveOpportunityAction",
        "features/companies/actions.ts#createCompanyQuickOpportunityAction",
        "features/contacts/actions.ts#appendContactMemoryAction",
      ],
      targetModels: ["Company", "Contact", "Opportunity"],
      reviewPosture: "review_first",
      boundaryNote:
        "Manual entry only; no auto-send, no CRM writeback, no external commitment.",
    },
    {
      eventClass: "poc_or_project_advancement",
      labelZh: "POC / 项目推进",
      labelEn: "POC / project advancement",
      existingSurfaces: [
        "app/(workspace)/opportunities",
        "app/(workspace)/meetings",
      ],
      existingEntryPoints: [
        "features/opportunities/actions.ts#saveOpportunityAction",
        "lib/memory/commitment.service.ts#createCommitment",
        "lib/memory/blocker.service.ts#createBlocker",
      ],
      targetModels: ["Opportunity", "Commitment", "Blocker"],
      reviewPosture: "review_first",
      boundaryNote:
        "Stage changes and commitments stay suggestion-first; customer-visible wording requires human review.",
    },
    {
      eventClass: "work_assignment_and_acceptance",
      labelZh: "派工与验收",
      labelEn: "Work assignment and acceptance",
      existingSurfaces: [
        "app/(workspace)/meetings",
        "app/(workspace)/approvals",
      ],
      existingEntryPoints: [
        "lib/memory/commitment.service.ts#createCommitment",
        "features/meetings/actions.ts#createFollowUpMeetingAction",
      ],
      targetModels: ["Commitment", "Meeting"],
      reviewPosture: "review_first",
      boundaryNote:
        "Acceptance is a manual confirmation on the commitment; no auto-settlement and no DriAssignment (runtime-session-bound).",
    },
    {
      eventClass: "builder_backlog",
      labelZh: "Builder 需求池",
      labelEn: "Builder backlog",
      existingSurfaces: ["app/(workspace)/search?mode=ask"],
      existingEntryPoints: [
        "features/search/ask-helm-signal-candidate-actions.ts#submitAskHelmSignalCandidateAction",
      ],
      targetModels: ["AuditLog (AskHelmSignalCandidate, review_required)"],
      reviewPosture: "review_first",
      boundaryNote:
        "Candidates land in the audit-log candidate queue as review_required; promotion into formal objects is a human decision.",
    },
  ] as const;

export function getSelfTenantEventIntakeRoute(
  eventClass: SelfTenantEventClass,
): SelfTenantEventIntakeRoute {
  const route = SELF_TENANT_EVENT_INTAKE_ROUTES.find(
    (candidate) => candidate.eventClass === eventClass,
  );
  if (!route) {
    throw new Error(
      `Unknown self-tenant event class for intake route: ${eventClass}`,
    );
  }
  return route;
}

export function listSelfTenantIntakeGaps(): readonly string[] {
  const covered = new Set(
    SELF_TENANT_EVENT_INTAKE_ROUTES.map((route) => route.eventClass),
  );
  return SELF_TENANT_EVENT_CLASSES.filter(
    (eventClass) => !covered.has(eventClass),
  );
}
