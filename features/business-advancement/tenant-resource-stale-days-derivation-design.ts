/**
 * Helm Business Advancement - Phase 3A / PF3A-005
 * Tenant resource derivedStaleDays derivation design (planning-only artifact).
 *
 * This artifact records, deterministically, the current repository truth about
 * which timestamp sources are reachable inside the tenant resource readout
 * pipeline (lib/tenant-resources/workspace-operating-impact-query.ts ->
 * buildTenantResourceReadiness -> buildTenantResourceOperatingImpactReadout),
 * the existing readout-level normalization that already collapses
 * connector / import-source / capture-session timing into a single observedAt
 * value, and the absence of any derivedStaleDays / staleDays / lastSyncedAt
 * field on the current TenantResourceOperatingImpactItem type. It then selects
 * a single source field and a deterministic formula for derivedStaleDays so
 * that any FUTURE thin read-model filter (TPQR-005) has one - and only one -
 * documented derivation to evaluate.
 *
 * Repo truth restated (do not contradict):
 *   - lib/tenant-resources/workspace-operating-impact-query.ts:38 selects
 *     connector.lastSyncedAt; line 42 selects connector.updatedAt.
 *   - lib/tenant-resources/workspace-operating-impact-query.ts:55 selects
 *     importSource.lastSyncedAt; line 56 selects importSource.updatedAt.
 *   - lib/tenant-resources/workspace-operating-impact-query.ts:71 selects
 *     importJob.finishedAt; line 73 selects importJob.startedAt.
 *   - lib/tenant-resources/readiness.ts:270 derives connector freshness from
 *     connector.lastSyncedAt ?? connector.updatedAt; line 303 sets
 *     connection.lastSyncAt = connector.lastSyncedAt; line 339 sets
 *     resource.updatedAt = connector.updatedAt ?? connector.lastSyncedAt.
 *   - lib/tenant-resources/readiness.ts:356 derives import-source freshness
 *     from source.lastSyncedAt ?? latestJob.finishedAt ?? source.updatedAt;
 *     line 393 sets connection.lastSyncAt = source.lastSyncedAt
 *     ?? latestJob.finishedAt; line 428 sets resource.updatedAt =
 *     source.updatedAt ?? latestJob.finishedAt ?? source.lastSyncedAt.
 *   - lib/tenant-resources/evidence-detail.ts:175 sets
 *     timing.observedAt = resource.connection.lastSyncAt ?? resource.updatedAt
 *     for every readout (connector, import_source, capture_session,
 *     extension), making this the single normalized observedAt expression
 *     already produced by the readout pipeline.
 *   - lib/tenant-resources/operating-impact.ts:24 declares
 *     TenantResourceOperatingImpactItem with severity, primaryGap, status,
 *     trustLevel, mappingCompleteness, decision, primaryReasonCode,
 *     fallbackType, nextActionMode, nextActionTitle, followThroughStatus,
 *     proofRequired, summary, operatorNextMove, evidenceRefs, evidenceDetail,
 *     boundaryNotes, href - and NO derivedStaleDays / staleDays /
 *     lastSyncedAt field; surfacing such a field is a separate type-surface
 *     review and is out of Phase 3A scope.
 *   - features/mobile/lib/mobile-command-read-model.ts:350 declares
 *     loadTenantResourceIssues; the in-memory filter (severity critical/high
 *     OR proofRequired === true OR followThroughStatus === "blocked")
 *     contains NO derivedStaleDays branch today.
 *   - features/business-advancement/thin-projection-query-review.ts:315
 *     defines TPQR-005 with derivedStaleDays > 14, orderBy
 *     derivedStaleDays DESC, take: 2.
 *   - features/business-advancement/runtime-readiness-preflight.ts:187 marks
 *     PF3-005 as conditional_requires_runtime_guard pending derivedStaleDays
 *     formula.
 *   - features/business-advancement/runtime-guard-resolution-plan.ts:218
 *     classifies PF3A-005 as requires_readout_derivation_design.
 *
 * Selected source (planning-only):
 *   readiness_timing_observed_at_normalized
 * Selected formula (planning-only):
 *   derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000)
 *   where observedAtMs is the millisecond representation of
 *   TenantResourceEvidenceDetail.timing.observedAt (i.e.
 *   resource.connection.lastSyncAt ?? resource.updatedAt). When observedAt is
 *   null, an invalid date string, or a future timestamp relative to the
 *   reference clock, the result is null - "unknown / not filterable",
 *   never "stale".
 *
 * This artifact does NOT authorize:
 *   - Prisma schema changes
 *   - runtime extractor / event queue / background job
 *   - API route / data/queries.ts / app page modifications
 *   - lib/tenant-resources/* runtime modifications
 *   - features/mobile/lib/mobile-command-read-model.ts edits or any UI surface
 *   - additions to the TenantResourceOperatingImpactItem type or any other
 *     readout runtime type
 *   - LLM final ranking
 *   - official write / auto-send / auto-approval / auto-execute
 *   - production query adoption
 *
 * Adoption / gate posture (see PF3A005_ADOPTION_POSTURE):
 *   The selected source/formula are usable ONLY as an evidence-freshness
 *   planning candidate. The upstream PF3A-005 human-meaningful staleness
 *   guard recorded in
 *   features/business-advancement/runtime-guard-resolution-plan.ts:218 is
 *   NOT cleared by this artifact. Any future runtime, type-surface, or thin
 *   read-model planning that depends on PF3A-005 must either stop and
 *   re-surface this guard or explicitly downgrade scope to
 *   evidence-freshness-only semantics before any adoption is considered.
 */

// ---------------------------------------------------------------------------
// Evidence row types
// ---------------------------------------------------------------------------

export type DerivedStaleDaysEvidenceKind =
  | "selected_query_source"
  | "readiness_normalization"
  | "readout_observed_at_definition"
  | "impact_item_type_truth"
  | "existing_filter_call_site"
  | "tpqr005_proposal"
  | "phase3_preflight_doc"
  | "phase3a_guard_doc"
  | "design_decision_note";

/**
 * The three raw timestamp candidates surfaced by PF3A-005 plus the selected
 * normalized readout-level source.
 *   - connector_last_synced_at:               raw connector timestamp
 *   - import_source_updated_at:               raw import-source timestamp
 *   - import_job_finished_at:                 raw import-job timestamp
 *   - readiness_timing_observed_at_normalized: selected planning source
 *     (resource.connection.lastSyncAt ?? resource.updatedAt, computed inside
 *     the existing readout pipeline)
 */
export type StaleDaysSourceCandidateId =
  | "connector_last_synced_at"
  | "import_source_updated_at"
  | "import_job_finished_at"
  | "readiness_timing_observed_at_normalized";

export type StaleDaysSourceVerdict =
  | "selected"
  | "rejected_too_narrow"
  | "rejected_automated_sync_only"
  | "rejected_job_timing_only";

export interface StaleDaysSourceCandidate {
  readonly candidateId: StaleDaysSourceCandidateId;
  readonly originLocator: string;
  /** Plain-English description of what this timestamp captures. */
  readonly semantics: string;
  /** Why this candidate was selected or rejected. */
  readonly verdict: StaleDaysSourceVerdict;
  readonly verdictRationale: string;
  /**
   * Honest limitation that future runtime adoption MUST still surface.
   * Carried even on the selected candidate so future reviewers don't lose it.
   */
  readonly limitationNote: string;
}

/**
 * One PF3A-005 evidence row. Each row pins a deterministic, file-level fact
 * about the derivedStaleDays derivation question.
 */
export interface DerivedStaleDaysEvidenceRow {
  /** Stable identifier for this evidence row. */
  readonly evidenceId: string;
  /** Repo-relative file path of the evidence (or "(planning)" for design notes). */
  readonly filePath: string;
  /** file:line locator pinning the evidence. */
  readonly evidenceLocator: string;
  /** Kind of evidence. */
  readonly evidenceKind: DerivedStaleDaysEvidenceKind;
  /** Optional - which candidate this row constrains (when applicable). */
  readonly relatedSourceCandidate?: StaleDaysSourceCandidateId;
  /** Short summary of what this evidence asserts. */
  readonly evidenceSummary: string;
  /** Boundary notes preserving recommendation/explanation/draft/proof distinctions. */
  readonly boundaryNotes: readonly string[];
}

// ---------------------------------------------------------------------------
// Shared boundary notes (row level)
// ---------------------------------------------------------------------------

const SHARED_BOUNDARY_NOTES: readonly string[] = [
  "recommendation != commitment - any PF3A-005 finding stays advisory until separately approved.",
  "explanation != approval - citing repo evidence does not authorize runtime adoption.",
  "draft != send - a drafted derivation does not authorize official changes.",
  "proof != external write success - verifying internal logic does not authorize outbound writes or sends.",
];

const PLANNING_ONLY_BOUNDARY_NOTES: readonly string[] = [
  "Phase 3A scope: planning-only - this row does not approve runtime adoption.",
  "PF3A-005 does not modify lib/tenant-resources/*, TenantResourceOperatingImpactItem, features/mobile/lib/mobile-command-read-model.ts, prisma/schema.prisma, data/queries.ts, app/, or app/api/; the derivation memo is the only deliverable.",
];

// ---------------------------------------------------------------------------
// Source candidate catalog (planning-only)
// ---------------------------------------------------------------------------

export const DERIVED_STALE_DAYS_SOURCE_CATALOG: readonly StaleDaysSourceCandidate[] =
  [
    {
      candidateId: "connector_last_synced_at",
      originLocator: "lib/tenant-resources/workspace-operating-impact-query.ts:38",
      semantics:
        "Raw connector.lastSyncedAt selected by getWorkspaceTenantResourceOperatingImpactReadout - represents the most recent timestamp at which the connector's automated sync finished, regardless of whether a human acted.",
      verdict: "rejected_automated_sync_only",
      verdictRationale:
        "connector.lastSyncedAt only covers connector-shaped resources and is bumped by automated sync cycles, not by human follow-through. Using it directly would force every readout shape (connector, import_source, capture_session, extension) to fall back to ad-hoc rules and would conflate automated polling with operator activity.",
      limitationNote:
        "Even when reachable inside the readout pipeline, connector.lastSyncedAt is evidence-freshness timing, not human inactivity; future runtime adoption must still label any derivedStaleDays it influences as evidence-freshness staleness, not human inactivity.",
    },
    {
      candidateId: "import_source_updated_at",
      originLocator: "lib/tenant-resources/workspace-operating-impact-query.ts:56",
      semantics:
        "Raw importSource.updatedAt selected by getWorkspaceTenantResourceOperatingImpactReadout - represents the most recent row-level write to the ImportSource record, including system-driven status updates triggered by import jobs.",
      verdict: "rejected_too_narrow",
      verdictRationale:
        "importSource.updatedAt only covers import-source-shaped resources and bumps on system-driven status changes (e.g. SYNCING / ERROR transitions), so it would mark resources fresh whenever the system rewrites the row even if no operator interaction occurred. It also leaves connector / capture-session / extension shapes uncovered.",
      limitationNote:
        "Even when reachable, importSource.updatedAt mixes human and system writes; using it as the staleness source would silently treat sync-driven row updates as recency.",
    },
    {
      candidateId: "import_job_finished_at",
      originLocator: "lib/tenant-resources/workspace-operating-impact-query.ts:71",
      semantics:
        "Raw importJob.finishedAt selected by getWorkspaceTenantResourceOperatingImpactReadout - represents the moment a single import job finished, regardless of outcome (COMPLETED, COMPLETED_WITH_WARNINGS, FAILED).",
      verdict: "rejected_job_timing_only",
      verdictRationale:
        "importJob.finishedAt is per-job and per-import-source only; it does not cover connector / capture-session / extension shapes, and it represents pipeline timing, not operator activity. Choosing it would also require a separate latest-job projection step that already lives inside the readiness builder.",
      limitationNote:
        "Even when reachable, importJob.finishedAt is import-pipeline timing; treating it as staleness would label automated job ticks as recency.",
    },
    {
      candidateId: "readiness_timing_observed_at_normalized",
      originLocator: "lib/tenant-resources/evidence-detail.ts:175",
      semantics:
        "Selected planning source: TenantResourceEvidenceDetail.timing.observedAt, which the existing readout pipeline already computes as resource.connection.lastSyncAt ?? resource.updatedAt for every readout shape (connector, import_source, capture_session, extension). For connector resources resource.connection.lastSyncAt resolves to connector.lastSyncedAt; for import-source resources it resolves to source.lastSyncedAt ?? latestJob.finishedAt; in all shapes resource.updatedAt is the readiness-level fallback already documented in lib/tenant-resources/readiness.ts.",
      verdict: "selected",
      verdictRationale:
        "Reusing the readout-level normalized observedAt expression keeps a single, deterministic, already-existing field as the derivation source across all readout shapes; it avoids introducing a new query path or schema column and avoids privileging connector-only or import-source-only timing. The fallback to resource.updatedAt also gives every readout shape a value when connection.lastSyncAt is null.",
      limitationNote:
        "Even on the selected source, observedAt for connector and import-source readouts ultimately derives from connector.lastSyncedAt or source.lastSyncedAt ?? latestJob.finishedAt, which can still be automated sync timing rather than human inactivity. Any future runtime adoption MUST label the resulting derivedStaleDays as evidence-freshness staleness, not human inactivity, and MUST still pass a separate type-surface and runtime-adoption review before exposing the value on TenantResourceOperatingImpactItem.",
    },
  ] as const;

// ---------------------------------------------------------------------------
// Selected source / formula (planning-only)
// ---------------------------------------------------------------------------

export const SELECTED_DERIVED_STALE_DAYS_SOURCE: StaleDaysSourceCandidateId =
  "readiness_timing_observed_at_normalized";

export interface DerivedStaleDaysFormulaDefinition {
  readonly selectedSource: StaleDaysSourceCandidateId;
  readonly sourceExpression: string;
  readonly formulaExpression: string;
  readonly millisecondsPerDay: 86_400_000;
  readonly nullObservedAtRule: "null_returns_null_unknown";
  readonly invalidObservedAtRule: "invalid_string_returns_null_unknown";
  readonly futureObservedAtRule: "future_returns_null_unknown_not_negative_not_stale";
  readonly stalenessLabel:
    | "evidence_freshness_staleness_not_human_inactivity";
  readonly thresholdForTpqr005Filter: 14;
  readonly thresholdComparator: "strictly_greater_than";
  readonly noiseGuardTake: 2;
  readonly noiseGuardOrderBy:
    | "derivedStaleDays_desc_then_resource_key_asc";
}

export const DERIVED_STALE_DAYS_FORMULA: DerivedStaleDaysFormulaDefinition = {
  selectedSource: SELECTED_DERIVED_STALE_DAYS_SOURCE,
  sourceExpression:
    "TenantResourceEvidenceDetail.timing.observedAt (defined in lib/tenant-resources/evidence-detail.ts:175 as resource.connection.lastSyncAt ?? resource.updatedAt)",
  formulaExpression:
    "derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000)",
  millisecondsPerDay: 86_400_000,
  nullObservedAtRule: "null_returns_null_unknown",
  invalidObservedAtRule: "invalid_string_returns_null_unknown",
  futureObservedAtRule: "future_returns_null_unknown_not_negative_not_stale",
  stalenessLabel: "evidence_freshness_staleness_not_human_inactivity",
  thresholdForTpqr005Filter: 14,
  thresholdComparator: "strictly_greater_than",
  noiseGuardTake: 2,
  noiseGuardOrderBy: "derivedStaleDays_desc_then_resource_key_asc",
} as const;

// ---------------------------------------------------------------------------
// PF3A-005 adoption / gate posture (planning-only)
//
// Encodes the honest gate state that the upstream PF3A-005 guard row in
// features/business-advancement/runtime-guard-resolution-plan.ts:218 requires:
// the selected source documents formula/source for evidence-freshness planning
// only; the human-meaningful staleness guard is NOT cleared by this artifact;
// any future runtime adoption must either stop and re-surface PF3A-005 or
// explicitly downgrade scope to evidence-freshness-only semantics first.
// ---------------------------------------------------------------------------

export type Pf3a005FormulaStatus = "selected_for_planning";
export type Pf3a005HumanMeaningfulStalenessGate = "not_cleared";
export type Pf3a005SemanticScope =
  "evidence_freshness_only_not_human_inactivity";
export type Pf3a005NextRequiredDecision =
  "stop_or_explicit_scope_downgrade_before_runtime_adoption";

export interface Pf3a005AdoptionPosture {
  readonly selectedSource: StaleDaysSourceCandidateId;
  readonly formulaStatus: Pf3a005FormulaStatus;
  readonly humanMeaningfulStalenessGate: Pf3a005HumanMeaningfulStalenessGate;
  readonly semanticScope: Pf3a005SemanticScope;
  readonly nextRequiredDecision: Pf3a005NextRequiredDecision;
  readonly postureNotes: readonly string[];
}

export const PF3A005_ADOPTION_POSTURE: Pf3a005AdoptionPosture = {
  selectedSource: SELECTED_DERIVED_STALE_DAYS_SOURCE,
  formulaStatus: "selected_for_planning",
  humanMeaningfulStalenessGate: "not_cleared",
  semanticScope: "evidence_freshness_only_not_human_inactivity",
  nextRequiredDecision:
    "stop_or_explicit_scope_downgrade_before_runtime_adoption",
  postureNotes: [
    "PF3A-005 documents the formula and source as a planning candidate only - it does NOT clear the upstream human-meaningful staleness guard from runtime-guard-resolution-plan.ts:218.",
    "Future runtime, type-surface, or thin read-model planning that depends on PF3A-005 must either stop and re-surface this guard or explicitly downgrade scope to evidence-freshness-only semantics before any adoption.",
    "This posture does not authorize runtime adoption, schema, API, page behavior, readout type change, official write, auto-send, auto-approval, LLM ranking, or production query adoption.",
  ],
} as const;

// ---------------------------------------------------------------------------
// Pure derivation helper over planning fixtures only
// ---------------------------------------------------------------------------

/**
 * Minimal planning fixture - NOT a runtime type. This shape exists only so the
 * selected formula can be exercised in tests. It deliberately omits the full
 * TenantResourceOperatingImpactItem / TenantResourceEvidenceDetail shape from
 * lib/tenant-resources/* because PF3A-005 must not modify those types.
 */
export interface PlanningTenantResourceTimingFixture {
  /** Stable fixture identifier used for ordering and diagnostics. */
  readonly resourceKey: string;
  /**
   * Planning-only observedAt - corresponds semantically to
   * TenantResourceEvidenceDetail.timing.observedAt (resource.connection.lastSyncAt
   * ?? resource.updatedAt). Allowed to be null or an invalid string for the
   * unknown / not-filterable cases.
   */
  readonly observedAt: Date | string | null;
  /** Reference clock used to evaluate the formula. */
  readonly referenceClock: Date | string;
}

/**
 * Pure helper that applies the selected DERIVED_STALE_DAYS_FORMULA to a single
 * planning fixture. Returns null when the fixture is structurally not
 * filterable (null observedAt, invalid observedAt, future observedAt, invalid
 * referenceClock); returns a non-negative integer day count otherwise.
 *
 * This helper is a planning artifact only. It is not a runtime extractor, not
 * an extension of any readout type, and not a query path; it operates on the
 * minimal PlanningTenantResourceTimingFixture shape.
 */
export function computeDerivedStaleDays(
  fixture: PlanningTenantResourceTimingFixture,
): number | null {
  const referenceClockMs = toMs(fixture.referenceClock);
  if (referenceClockMs === null) return null;
  if (fixture.observedAt === null) return null;
  const observedAtMs = toMs(fixture.observedAt);
  if (observedAtMs === null) return null;
  const deltaMs = referenceClockMs - observedAtMs;
  if (deltaMs < 0) return null;
  return Math.floor(deltaMs / DERIVED_STALE_DAYS_FORMULA.millisecondsPerDay);
}

function toMs(value: Date | string): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// take: 2 calibration fixture (planning-only)
// ---------------------------------------------------------------------------

export interface DerivedStaleDaysCalibrationCase {
  readonly caseId: string;
  readonly description: string;
  readonly referenceClock: string;
  readonly fixtures: readonly PlanningTenantResourceTimingFixture[];
  /**
   * Expected resource keys after applying the TPQR-005 in-memory rule:
   *   filter derivedStaleDays > 14, orderBy derivedStaleDays DESC then
   *   resourceKey ASC, take 2. Computed by the evaluator; recorded here as
   *   the documented planning expectation.
   */
  readonly expectedTopResourceKeys: readonly string[];
}

const REFERENCE_CLOCK_FOR_CALIBRATION = "2026-04-26T00:00:00.000Z";

function isoDaysAgo(days: number): string {
  const referenceMs = Date.parse(REFERENCE_CLOCK_FOR_CALIBRATION);
  const targetMs = referenceMs - days * 86_400_000;
  return new Date(targetMs).toISOString();
}

export const DERIVED_STALE_DAYS_CALIBRATION: readonly DerivedStaleDaysCalibrationCase[] =
  [
    {
      caseId: "PF3A005-CAL-001",
      description:
        "Saturating mix: four resources strictly older than 14 days, two of which are tied. take: 2 with deterministic tie-break by resourceKey ASC must select the two oldest distinct keys without saturation.",
      referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
      fixtures: [
        {
          resourceKey: "connector:conn_a",
          observedAt: isoDaysAgo(40),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
        {
          resourceKey: "connector:conn_b",
          observedAt: isoDaysAgo(40),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
        {
          resourceKey: "import_source:src_c",
          observedAt: isoDaysAgo(20),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
        {
          resourceKey: "capture_session:cap_d",
          observedAt: isoDaysAgo(15),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
      ],
      expectedTopResourceKeys: ["connector:conn_a", "connector:conn_b"],
    },
    {
      caseId: "PF3A005-CAL-002",
      description:
        "Boundary case: items at exactly 14 and 13 days must NOT pass the strictly-greater-than-14 filter; the 15-day item must.",
      referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
      fixtures: [
        {
          resourceKey: "connector:boundary_13",
          observedAt: isoDaysAgo(13),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
        {
          resourceKey: "connector:boundary_14",
          observedAt: isoDaysAgo(14),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
        {
          resourceKey: "connector:boundary_15",
          observedAt: isoDaysAgo(15),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
      ],
      expectedTopResourceKeys: ["connector:boundary_15"],
    },
    {
      caseId: "PF3A005-CAL-003",
      description:
        "Unknown / invalid / future observedAt must be excluded from the > 14 filter (treated as unknown, not stale). A real 30-day stale connector is the only result.",
      referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
      fixtures: [
        {
          resourceKey: "connector:null_observed",
          observedAt: null,
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
        {
          resourceKey: "connector:invalid_observed",
          observedAt: "not-a-date",
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
        {
          resourceKey: "connector:future_observed",
          observedAt: isoDaysAgo(-3),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
        {
          resourceKey: "connector:thirty_days_stale",
          observedAt: isoDaysAgo(30),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
      ],
      expectedTopResourceKeys: ["connector:thirty_days_stale"],
    },
    {
      caseId: "PF3A005-CAL-004",
      description:
        "All items are below the > 14 threshold; the in-memory filter must return zero rows so take: 2 cannot manufacture noise.",
      referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
      fixtures: [
        {
          resourceKey: "connector:fresh_2",
          observedAt: isoDaysAgo(2),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
        {
          resourceKey: "import_source:fresh_7",
          observedAt: isoDaysAgo(7),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
        {
          resourceKey: "capture_session:fresh_14",
          observedAt: isoDaysAgo(14),
          referenceClock: REFERENCE_CLOCK_FOR_CALIBRATION,
        },
      ],
      expectedTopResourceKeys: [],
    },
  ] as const;

/**
 * Pure evaluator for a single calibration case. Mirrors the documented TPQR-005
 * in-memory rule: filter derivedStaleDays != null AND derivedStaleDays > 14;
 * orderBy derivedStaleDays DESC then resourceKey ASC; take 2. Returns the
 * resourceKey list in the order produced by the rule.
 */
export function applyTpqr005CalibrationRule(
  fixtures: readonly PlanningTenantResourceTimingFixture[],
): readonly string[] {
  const scored = fixtures
    .map((fixture) => ({
      resourceKey: fixture.resourceKey,
      derivedStaleDays: computeDerivedStaleDays(fixture),
    }))
    .filter(
      (row): row is { resourceKey: string; derivedStaleDays: number } =>
        row.derivedStaleDays !== null &&
        row.derivedStaleDays > DERIVED_STALE_DAYS_FORMULA.thresholdForTpqr005Filter,
    );
  scored.sort((left, right) => {
    if (right.derivedStaleDays !== left.derivedStaleDays) {
      return right.derivedStaleDays - left.derivedStaleDays;
    }
    return left.resourceKey.localeCompare(right.resourceKey);
  });
  return scored
    .slice(0, DERIVED_STALE_DAYS_FORMULA.noiseGuardTake)
    .map((row) => row.resourceKey);
}

// ---------------------------------------------------------------------------
// PF3A-005 evidence matrix (deterministic)
// ---------------------------------------------------------------------------

export const DERIVED_STALE_DAYS_EVIDENCE: readonly DerivedStaleDaysEvidenceRow[] =
  [
    // -----------------------------------------------------------------------
    // PF3A005-EV-001 | selected_query_source | connector.lastSyncedAt
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-001",
      filePath: "lib/tenant-resources/workspace-operating-impact-query.ts",
      evidenceLocator:
        "lib/tenant-resources/workspace-operating-impact-query.ts:38",
      evidenceKind: "selected_query_source",
      relatedSourceCandidate: "connector_last_synced_at",
      evidenceSummary:
        "getWorkspaceTenantResourceOperatingImpactReadout selects connector.lastSyncedAt (line 38) and connector.updatedAt (line 42) from db.connector.findMany with workspaceId scope; this is one of the three raw timestamp candidates surfaced by PF3A-005 for the derivedStaleDays question.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Query select shape is recorded as evidence only; PF3A-005 does not change the existing select clause.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-002 | selected_query_source | importSource.updatedAt
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-002",
      filePath: "lib/tenant-resources/workspace-operating-impact-query.ts",
      evidenceLocator:
        "lib/tenant-resources/workspace-operating-impact-query.ts:56",
      evidenceKind: "selected_query_source",
      relatedSourceCandidate: "import_source_updated_at",
      evidenceSummary:
        "getWorkspaceTenantResourceOperatingImpactReadout selects importSource.lastSyncedAt (line 55) and importSource.updatedAt (line 56) from db.importSource.findMany with workspaceId scope; this is the second raw timestamp candidate surfaced by PF3A-005.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Query select shape is recorded as evidence only; PF3A-005 does not change the existing select clause.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-003 | selected_query_source | importJob.finishedAt
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-003",
      filePath: "lib/tenant-resources/workspace-operating-impact-query.ts",
      evidenceLocator:
        "lib/tenant-resources/workspace-operating-impact-query.ts:71",
      evidenceKind: "selected_query_source",
      relatedSourceCandidate: "import_job_finished_at",
      evidenceSummary:
        "getWorkspaceTenantResourceOperatingImpactReadout selects importJob.finishedAt (line 71) and importJob.startedAt (line 73) from db.importJob.findMany; this is the third raw timestamp candidate surfaced by PF3A-005.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Query select shape is recorded as evidence only; PF3A-005 does not change the existing select clause.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-004 | readiness_normalization | connector
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-004",
      filePath: "lib/tenant-resources/readiness.ts",
      evidenceLocator: "lib/tenant-resources/readiness.ts:270",
      evidenceKind: "readiness_normalization",
      relatedSourceCandidate: "readiness_timing_observed_at_normalized",
      evidenceSummary:
        "buildConnectorResource derives freshness from connector.lastSyncedAt ?? connector.updatedAt (line 270), sets resource.connection.lastSyncAt to connector.lastSyncedAt (line 303), and sets resource.updatedAt to connector.updatedAt ?? connector.lastSyncedAt (line 339); these are the readiness-level normalizations the selected source already piggybacks on.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Readiness builder fact only - PF3A-005 does not modify lib/tenant-resources/readiness.ts.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-005 | readiness_normalization | import-source
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-005",
      filePath: "lib/tenant-resources/readiness.ts",
      evidenceLocator: "lib/tenant-resources/readiness.ts:356",
      evidenceKind: "readiness_normalization",
      relatedSourceCandidate: "readiness_timing_observed_at_normalized",
      evidenceSummary:
        "buildImportSourceResource derives freshnessDate as source.lastSyncedAt ?? latestJob.finishedAt ?? source.updatedAt (line 356), sets resource.connection.lastSyncAt to source.lastSyncedAt ?? latestJob.finishedAt (line 393), and sets resource.updatedAt to source.updatedAt ?? latestJob.finishedAt ?? source.lastSyncedAt (line 428); for import-source readouts the selected source therefore traverses the same normalization path that already exists.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Readiness builder fact only - PF3A-005 does not modify lib/tenant-resources/readiness.ts.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-006 | readout_observed_at_definition
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-006",
      filePath: "lib/tenant-resources/evidence-detail.ts",
      evidenceLocator: "lib/tenant-resources/evidence-detail.ts:175",
      evidenceKind: "readout_observed_at_definition",
      relatedSourceCandidate: "readiness_timing_observed_at_normalized",
      evidenceSummary:
        "buildTenantResourceEvidenceDetail sets timing.observedAt = resource.connection.lastSyncAt ?? resource.updatedAt for every readout; this is the single normalized expression chosen by PF3A-005 as the derivedStaleDays source. Because it is computed across all readout shapes (connector, import_source, capture_session, extension) without privileging connector-only or import-source-only timing, it gives the formula a uniform input across the pipeline.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "PF3A-005 does not modify lib/tenant-resources/evidence-detail.ts; the expression is reused as-is in the planning formula only.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-007 | impact_item_type_truth
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-007",
      filePath: "lib/tenant-resources/operating-impact.ts",
      evidenceLocator: "lib/tenant-resources/operating-impact.ts:24",
      evidenceKind: "impact_item_type_truth",
      evidenceSummary:
        "TenantResourceOperatingImpactItem currently exposes resourceKey, resourceName, provider, sourceKind, severity, primaryGap, status, trustLevel, mappingCompleteness, decision, primaryReasonCode, fallbackType, nextActionMode, nextActionTitle, followThroughStatus, proofRequired, summary, operatorNextMove, evidenceRefs, evidenceDetail, boundaryNotes, href - and NO derivedStaleDays / staleDays / lastSyncedAt field. Surfacing such a field is therefore a separate type-surface review and is out of Phase 3A scope.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "PF3A-005 does not modify TenantResourceOperatingImpactItem or any tenant-resource readout runtime type; any future surfacing of derivedStaleDays must pass an independent type-surface review.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-008 | existing_filter_call_site
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-008",
      filePath: "features/mobile/lib/mobile-command-read-model.ts",
      evidenceLocator:
        "features/mobile/lib/mobile-command-read-model.ts:350",
      evidenceKind: "existing_filter_call_site",
      evidenceSummary:
        "loadTenantResourceIssues currently filters readout.impactItems by severity === 'critical' OR severity === 'high' OR proofRequired === true OR followThroughStatus === 'blocked'; there is NO derivedStaleDays branch today, so PF3A-005 cannot leak into this path.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "PF3A-005 does not modify features/mobile/lib/mobile-command-read-model.ts; loadTenantResourceIssues stays unchanged.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-009 | tpqr005_proposal
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-009",
      filePath: "features/business-advancement/thin-projection-query-review.ts",
      evidenceLocator:
        "features/business-advancement/thin-projection-query-review.ts:315",
      evidenceKind: "tpqr005_proposal",
      evidenceSummary:
        "TPQR-005 (tenant_resource / AS-FX-007 / stalled_case) proposes an in-memory filter over the readout output: derivedStaleDays > 14, orderBy derivedStaleDays DESC, take: 2; runtimeAdoptionPosture stays review_only_not_implemented and the row explicitly notes that derivedStaleDays is not yet a field on TenantResourceOperatingImpactItem.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "TPQR-005 review row is not modified by PF3A-005; PF3A-005 only records the formula it would consume.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-010 | phase3_preflight_doc | PF3-005
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-010",
      filePath: "features/business-advancement/runtime-readiness-preflight.ts",
      evidenceLocator:
        "features/business-advancement/runtime-readiness-preflight.ts:187",
      evidenceKind: "phase3_preflight_doc",
      evidenceSummary:
        "PF3-005 (Phase 3 entry-gate preflight for TPQR-005 / stalled_case) records the conditional runtime guard: define the derivedStaleDays computation formula, specify whether to derive from connector.lastSyncedAt, importSource.updatedAt, or importJob.finishedAt, confirm the chosen field reflects human-meaningful staleness, and calibrate the take: 2 noise guard before runtime adoption.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Doc reference only - PF3A-005 does not modify the preflight artifact.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-011 | phase3a_guard_doc | PF3A-005
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-011",
      filePath: "features/business-advancement/runtime-guard-resolution-plan.ts",
      evidenceLocator:
        "features/business-advancement/runtime-guard-resolution-plan.ts:218",
      evidenceKind: "phase3a_guard_doc",
      evidenceSummary:
        "PF3A-005 (Phase 3A guard-resolution row, resolutionClass: requires_readout_derivation_design) requires a single derivedStaleDays formula, an explicitly named source field, an honest label that the chosen source must reflect human-meaningful staleness rather than automated sync timing, and a planning-only take: 2 calibration; surfacing derivedStaleDays on TenantResourceOperatingImpactItem is left to a separate type-surface review.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Doc reference only - PF3A-005 does not modify the guard-resolution plan artifact.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A005-EV-012 | design_decision_note (planning-only)
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A005-EV-012",
      filePath: "(planning)",
      evidenceLocator:
        "(planning-only formula and source selection for derivedStaleDays)",
      evidenceKind: "design_decision_note",
      relatedSourceCandidate: "readiness_timing_observed_at_normalized",
      evidenceSummary:
        "Selected source: readiness_timing_observed_at_normalized (TenantResourceEvidenceDetail.timing.observedAt = resource.connection.lastSyncAt ?? resource.updatedAt). Selected formula: derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000). Null observedAt, invalid observedAt strings, and future observedAt values relative to the reference clock all yield null (unknown / not filterable), never a stale value. The TPQR-005 in-memory rule that consumes this value (filter derivedStaleDays > 14, orderBy derivedStaleDays DESC then resourceKey ASC, take: 2) and the calibration fixtures live in this artifact only. This note does not authorize runtime adoption, does not modify any readout type, does not modify lib/tenant-resources, does not modify features/mobile/lib/mobile-command-read-model.ts, and does not surface derivedStaleDays on TenantResourceOperatingImpactItem; any such step is a separate type-surface and runtime-adoption review.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Design note - not a runtime change, not a schema change, not a query adoption, not a type-surface change.",
      ],
    },
  ] as const;

// ---------------------------------------------------------------------------
// Evaluator (pure, no side effects)
// ---------------------------------------------------------------------------

export interface DerivedStaleDaysCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface DerivedStaleDaysEvalSummary {
  readonly totalRows: number;
  readonly catalogCandidates: readonly StaleDaysSourceCandidateId[];
  readonly selectedSource: StaleDaysSourceCandidateId;
  readonly selectedFormulaExpression: string;
  readonly adoptionPosture: Pf3a005AdoptionPosture;
  readonly checks: readonly DerivedStaleDaysCheckResult[];
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
  "extends tenantresourceoperatingimpactitem",
  "adds derivedstaledays to tenantresourceoperatingimpactitem",
  "modifies the impact item type",
] as const;

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

const REQUIRED_REPO_TRUTH_LOCATORS = [
  "lib/tenant-resources/workspace-operating-impact-query.ts:38",
  "lib/tenant-resources/workspace-operating-impact-query.ts:56",
  "lib/tenant-resources/workspace-operating-impact-query.ts:71",
  "lib/tenant-resources/readiness.ts:270",
  "lib/tenant-resources/readiness.ts:356",
  "lib/tenant-resources/evidence-detail.ts:175",
  "lib/tenant-resources/operating-impact.ts:24",
  "features/mobile/lib/mobile-command-read-model.ts:350",
  "features/business-advancement/thin-projection-query-review.ts:315",
  "features/business-advancement/runtime-readiness-preflight.ts:187",
  "features/business-advancement/runtime-guard-resolution-plan.ts:218",
] as const;

const ALLOWED_EVIDENCE_KINDS = new Set<DerivedStaleDaysEvidenceKind>([
  "selected_query_source",
  "readiness_normalization",
  "readout_observed_at_definition",
  "impact_item_type_truth",
  "existing_filter_call_site",
  "tpqr005_proposal",
  "phase3_preflight_doc",
  "phase3a_guard_doc",
  "design_decision_note",
]);

const ALLOWED_SOURCE_CANDIDATES = new Set<StaleDaysSourceCandidateId>([
  "connector_last_synced_at",
  "import_source_updated_at",
  "import_job_finished_at",
  "readiness_timing_observed_at_normalized",
]);

const REQUIRED_GUARD_CANDIDATES: readonly StaleDaysSourceCandidateId[] = [
  "connector_last_synced_at",
  "import_source_updated_at",
  "import_job_finished_at",
];

function checkAtLeastOneEvidenceRow(): DerivedStaleDaysCheckResult {
  const passed = DERIVED_STALE_DAYS_EVIDENCE.length > 0;
  return {
    checkName: "at_least_one_evidence_row",
    passed,
    detail: passed
      ? `Evidence matrix contains ${DERIVED_STALE_DAYS_EVIDENCE.length} row(s).`
      : "Evidence matrix must contain at least one row.",
  };
}

function checkEveryRowHasNonEmptyEvidenceAndBoundary(): DerivedStaleDaysCheckResult {
  const violations: string[] = [];
  for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
    if (row.evidenceId.trim() === "") {
      violations.push(`${row.evidenceId}: evidenceId is empty`);
    }
    if (row.filePath.trim() === "") {
      violations.push(`${row.evidenceId}: filePath is empty`);
    }
    if (row.evidenceLocator.trim() === "") {
      violations.push(`${row.evidenceId}: evidenceLocator is empty`);
    }
    if (row.evidenceSummary.trim() === "") {
      violations.push(`${row.evidenceId}: evidenceSummary is empty`);
    }
    if (row.boundaryNotes.length === 0) {
      violations.push(`${row.evidenceId}: boundaryNotes is empty`);
    }
    for (const note of row.boundaryNotes) {
      if (note.trim() === "") {
        violations.push(`${row.evidenceId}: boundaryNotes contains empty string`);
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "every_row_has_non_empty_evidence_and_boundary",
    passed,
    detail: passed
      ? "All rows carry non-empty evidenceId, filePath, evidenceLocator, evidenceSummary, and boundaryNotes."
      : `Empty fields: ${violations.join("; ")}`,
  };
}

function checkEvidenceIdsAreUnique(): DerivedStaleDaysCheckResult {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
    if (seen.has(row.evidenceId)) {
      duplicates.push(row.evidenceId);
    } else {
      seen.add(row.evidenceId);
    }
  }
  const passed = duplicates.length === 0;
  return {
    checkName: "evidence_ids_are_unique",
    passed,
    detail: passed
      ? "All evidenceId values are unique."
      : `Duplicate evidenceIds: ${duplicates.join(", ")}`,
  };
}

function checkRepoTruthLocatorsCited(): DerivedStaleDaysCheckResult {
  const allLocators = DERIVED_STALE_DAYS_EVIDENCE.map(
    (row) => row.evidenceLocator,
  ).join(" | ");
  const missing = REQUIRED_REPO_TRUTH_LOCATORS.filter(
    (locator) => !allLocators.includes(locator),
  );
  const passed = missing.length === 0;
  return {
    checkName: "repo_truth_locators_cited",
    passed,
    detail: passed
      ? `All required repo-truth locators cited: ${REQUIRED_REPO_TRUTH_LOCATORS.join(", ")}.`
      : `Missing repo-truth locators: ${missing.join(", ")}`,
  };
}

function checkBoundaryNotesPreserveDistinctions(): DerivedStaleDaysCheckResult {
  const violations: string[] = [];
  for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
    const combined = row.boundaryNotes.join(" \n ").toLowerCase();
    for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
      if (!combined.includes(phrase)) {
        violations.push(`${row.evidenceId}: boundaryNotes missing "${phrase}"`);
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

function checkNoForbiddenAuthorization(): DerivedStaleDaysCheckResult {
  const violations: string[] = [];
  for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
    const fields: string[] = [row.evidenceSummary, ...row.boundaryNotes];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${row.evidenceId}: contains forbidden authorization "${pattern}"`,
          );
        }
      }
    }
  }
  for (const candidate of DERIVED_STALE_DAYS_SOURCE_CATALOG) {
    const fields = [
      candidate.semantics,
      candidate.verdictRationale,
      candidate.limitationNote,
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${candidate.candidateId}: contains forbidden authorization "${pattern}"`,
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
      ? "No row authorizes auto-write, auto-send, execution authority, LLM ranking, schema design, runtime adoption, type-surface change, or production query adoption."
      : `Forbidden patterns: ${violations.join("; ")}`,
  };
}

function checkEvidenceKindsAndCandidatesValid(): DerivedStaleDaysCheckResult {
  const violations: string[] = [];
  for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
    if (!ALLOWED_EVIDENCE_KINDS.has(row.evidenceKind)) {
      violations.push(
        `${row.evidenceId}: invalid evidenceKind "${row.evidenceKind}"`,
      );
    }
    if (
      row.relatedSourceCandidate !== undefined &&
      !ALLOWED_SOURCE_CANDIDATES.has(row.relatedSourceCandidate)
    ) {
      violations.push(
        `${row.evidenceId}: invalid relatedSourceCandidate "${row.relatedSourceCandidate}"`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "evidence_kinds_and_source_candidates_valid",
    passed,
    detail: passed
      ? "All rows use allowed evidenceKind and relatedSourceCandidate values."
      : `Invalid values: ${violations.join("; ")}`,
  };
}

function checkCatalogCoversThreeGuardCandidates(): DerivedStaleDaysCheckResult {
  const ids = new Set(
    DERIVED_STALE_DAYS_SOURCE_CATALOG.map((entry) => entry.candidateId),
  );
  const missing = REQUIRED_GUARD_CANDIDATES.filter((id) => !ids.has(id));
  const passed = missing.length === 0;
  return {
    checkName: "catalog_covers_three_guard_candidates",
    passed,
    detail: passed
      ? `Source catalog covers all three PF3A-005 guard candidates: ${REQUIRED_GUARD_CANDIDATES.join(", ")}.`
      : `Missing guard candidates: ${missing.join(", ")}`,
  };
}

function checkExactlyOneSelectedCandidate(): DerivedStaleDaysCheckResult {
  const selectedEntries = DERIVED_STALE_DAYS_SOURCE_CATALOG.filter(
    (entry) => entry.verdict === "selected",
  );
  const passed =
    selectedEntries.length === 1 &&
    selectedEntries[0].candidateId === SELECTED_DERIVED_STALE_DAYS_SOURCE &&
    DERIVED_STALE_DAYS_FORMULA.selectedSource === SELECTED_DERIVED_STALE_DAYS_SOURCE;
  return {
    checkName: "exactly_one_selected_candidate_matches_formula",
    passed,
    detail: passed
      ? `Exactly one selected candidate (${SELECTED_DERIVED_STALE_DAYS_SOURCE}) and the formula's selectedSource agrees.`
      : `Selected count was ${selectedEntries.length}; formula.selectedSource=${DERIVED_STALE_DAYS_FORMULA.selectedSource}; SELECTED_DERIVED_STALE_DAYS_SOURCE=${SELECTED_DERIVED_STALE_DAYS_SOURCE}.`,
  };
}

function checkSelectedSourceIsReadinessObservedAt(): DerivedStaleDaysCheckResult {
  const passed =
    SELECTED_DERIVED_STALE_DAYS_SOURCE ===
    "readiness_timing_observed_at_normalized";
  return {
    checkName: "selected_source_is_readiness_observed_at_normalized",
    passed,
    detail: passed
      ? "Selected source is readiness_timing_observed_at_normalized (planning-only)."
      : `Expected readiness_timing_observed_at_normalized, got "${SELECTED_DERIVED_STALE_DAYS_SOURCE}".`,
  };
}

function checkFormulaShape(): DerivedStaleDaysCheckResult {
  const expression = DERIVED_STALE_DAYS_FORMULA.formulaExpression;
  const passed =
    expression.includes("derivedStaleDays") &&
    expression.includes("floor") &&
    expression.includes("max(0,") &&
    expression.includes("referenceClockMs - observedAtMs") &&
    expression.includes("86_400_000") &&
    DERIVED_STALE_DAYS_FORMULA.millisecondsPerDay === 86_400_000 &&
    DERIVED_STALE_DAYS_FORMULA.thresholdForTpqr005Filter === 14 &&
    DERIVED_STALE_DAYS_FORMULA.thresholdComparator === "strictly_greater_than" &&
    DERIVED_STALE_DAYS_FORMULA.noiseGuardTake === 2 &&
    DERIVED_STALE_DAYS_FORMULA.stalenessLabel ===
      "evidence_freshness_staleness_not_human_inactivity";
  return {
    checkName: "formula_shape_is_explicit_and_planning_only",
    passed,
    detail: passed
      ? "Formula expression names floor / max(0, ...) / 86_400_000, threshold > 14, take: 2, evidence-freshness label."
      : `Formula expression mismatch: "${expression}"; threshold=${DERIVED_STALE_DAYS_FORMULA.thresholdForTpqr005Filter}; comparator=${DERIVED_STALE_DAYS_FORMULA.thresholdComparator}; take=${DERIVED_STALE_DAYS_FORMULA.noiseGuardTake}; label=${DERIVED_STALE_DAYS_FORMULA.stalenessLabel}.`,
  };
}

function checkComputeDerivedStaleDaysHandlesNullInvalidFuture(): DerivedStaleDaysCheckResult {
  const referenceClock = "2026-04-26T00:00:00.000Z";
  const nullCase = computeDerivedStaleDays({
    resourceKey: "case_null",
    observedAt: null,
    referenceClock,
  });
  const invalidCase = computeDerivedStaleDays({
    resourceKey: "case_invalid",
    observedAt: "not-a-date",
    referenceClock,
  });
  const futureCase = computeDerivedStaleDays({
    resourceKey: "case_future",
    observedAt: "2026-05-01T00:00:00.000Z",
    referenceClock,
  });
  const exactClockCase = computeDerivedStaleDays({
    resourceKey: "case_exact",
    observedAt: referenceClock,
    referenceClock,
  });
  const fifteenDayCase = computeDerivedStaleDays({
    resourceKey: "case_15",
    observedAt: "2026-04-11T00:00:00.000Z",
    referenceClock,
  });
  const passed =
    nullCase === null &&
    invalidCase === null &&
    futureCase === null &&
    exactClockCase === 0 &&
    fifteenDayCase === 15;
  return {
    checkName: "compute_handles_null_invalid_future_observed_at",
    passed,
    detail: passed
      ? "computeDerivedStaleDays returns null for null/invalid/future observedAt and a non-negative integer day count otherwise (0 at clock equality, 15 at 15d-old observedAt)."
      : `null=${nullCase}; invalid=${invalidCase}; future=${futureCase}; exact=${exactClockCase}; 15d=${fifteenDayCase}.`,
  };
}

function checkFourteenDayThresholdExamples(): DerivedStaleDaysCheckResult {
  const referenceClock = "2026-04-26T00:00:00.000Z";
  const day13 = computeDerivedStaleDays({
    resourceKey: "case_13",
    observedAt: "2026-04-13T00:00:00.000Z",
    referenceClock,
  });
  const day14 = computeDerivedStaleDays({
    resourceKey: "case_14",
    observedAt: "2026-04-12T00:00:00.000Z",
    referenceClock,
  });
  const day15 = computeDerivedStaleDays({
    resourceKey: "case_15",
    observedAt: "2026-04-11T00:00:00.000Z",
    referenceClock,
  });
  const passed = day13 === 13 && day14 === 14 && day15 === 15;
  return {
    checkName: "fourteen_day_threshold_examples_resolved",
    passed,
    detail: passed
      ? "13/14/15-day-old observedAt values resolve to derivedStaleDays 13/14/15 respectively (boundary at strictly > 14)."
      : `13d=${day13}; 14d=${day14}; 15d=${day15}.`,
  };
}

function checkTakeTwoCalibrationCases(): DerivedStaleDaysCheckResult {
  const violations: string[] = [];
  for (const calibrationCase of DERIVED_STALE_DAYS_CALIBRATION) {
    const actual = applyTpqr005CalibrationRule(calibrationCase.fixtures);
    const expected = calibrationCase.expectedTopResourceKeys;
    if (actual.length !== expected.length) {
      violations.push(
        `${calibrationCase.caseId}: expected ${expected.length} key(s), got ${actual.length}`,
      );
      continue;
    }
    for (let index = 0; index < expected.length; index += 1) {
      if (actual[index] !== expected[index]) {
        violations.push(
          `${calibrationCase.caseId}: at index ${index}, expected "${expected[index]}", got "${actual[index]}"`,
        );
      }
    }
    if (actual.length > DERIVED_STALE_DAYS_FORMULA.noiseGuardTake) {
      violations.push(
        `${calibrationCase.caseId}: produced ${actual.length} keys but noise guard is ${DERIVED_STALE_DAYS_FORMULA.noiseGuardTake}`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "take_two_calibration_cases_match_expected",
    passed,
    detail: passed
      ? `All ${DERIVED_STALE_DAYS_CALIBRATION.length} calibration case(s) honor strictly-greater-than-14 / orderBy desc / take: 2.`
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkDesignNoteRefusesRuntimeAdoption(): DerivedStaleDaysCheckResult {
  const designNotes = DERIVED_STALE_DAYS_EVIDENCE.filter(
    (row) => row.evidenceKind === "design_decision_note",
  );
  if (designNotes.length === 0) {
    return {
      checkName: "design_note_refuses_runtime_and_type_surface_adoption",
      passed: false,
      detail:
        "At least one design_decision_note row is required to encode the planning-only formula selection.",
    };
  }
  const violations: string[] = [];
  for (const row of designNotes) {
    const combined = `${row.evidenceSummary} ${row.boundaryNotes.join(" ")}`.toLowerCase();
    if (!combined.includes("not authorize")) {
      violations.push(
        `${row.evidenceId}: design note must explicitly state it does not authorize runtime adoption.`,
      );
    }
    if (!combined.includes("readiness_timing_observed_at_normalized")) {
      violations.push(
        `${row.evidenceId}: design note must name the selected source readiness_timing_observed_at_normalized.`,
      );
    }
    if (
      !combined.includes("derivedstaledays = floor(max(0, referenceclockms - observedatms) / 86_400_000)")
    ) {
      violations.push(
        `${row.evidenceId}: design note must spell out the selected formula derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000).`,
      );
    }
    if (!combined.includes("tpqr-005") && !combined.includes("tpqr005")) {
      violations.push(
        `${row.evidenceId}: design note must reference TPQR-005.`,
      );
    }
    if (!combined.includes("tenantresourceoperatingimpactitem")) {
      violations.push(
        `${row.evidenceId}: design note must explicitly disclaim modification of TenantResourceOperatingImpactItem.`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "design_note_refuses_runtime_and_type_surface_adoption",
    passed,
    detail: passed
      ? "Design note explicitly refuses runtime adoption, names the selected source and formula, references TPQR-005, and disclaims TenantResourceOperatingImpactItem changes."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkAllGuardCandidatesCoveredByEvidence(): DerivedStaleDaysCheckResult {
  const candidates = new Set<StaleDaysSourceCandidateId>();
  for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
    if (row.relatedSourceCandidate) {
      candidates.add(row.relatedSourceCandidate);
    }
  }
  const missing = REQUIRED_GUARD_CANDIDATES.filter((id) => !candidates.has(id));
  const passed = missing.length === 0;
  return {
    checkName: "all_three_guard_candidates_covered_by_evidence",
    passed,
    detail: passed
      ? "All three PF3A-005 guard candidates (connector_last_synced_at, import_source_updated_at, import_job_finished_at) are covered by at least one evidence row."
      : `Missing candidate coverage: ${missing.join(", ")}.`,
  };
}

// ---------------------------------------------------------------------------
// Adoption-posture / gate-not-cleared checks
// ---------------------------------------------------------------------------

const FORBIDDEN_READINESS_PHRASES = [
  "human-meaningful staleness gate cleared",
  "human-meaningful staleness guard cleared",
  "human-meaningful staleness cleared",
  "guard fully cleared",
  "gate fully cleared",
  "pf3a-005 fully resolved",
  "pf3a-005 fully cleared",
  "pf3a-005 unconditionally resolved",
  "pf3a-005 implementation-ready",
  "thin read-model planning go",
  "thin read-model go",
  "runtime adoption ready",
  "ready for runtime adoption",
  "ready for thin read-model planning",
  "approved for thin read-model planning",
  "approved for runtime adoption",
  "fully clears the human-meaningful staleness",
  "clears the human-meaningful staleness guard",
  "clears the human-meaningful staleness gate",
] as const;

function checkPostureFormulaStatusIsPlanningOnly(): DerivedStaleDaysCheckResult {
  const passed =
    PF3A005_ADOPTION_POSTURE.formulaStatus === "selected_for_planning";
  return {
    checkName: "posture_formula_status_is_selected_for_planning",
    passed,
    detail: passed
      ? "PF3A005_ADOPTION_POSTURE.formulaStatus is selected_for_planning."
      : `Expected formulaStatus to be selected_for_planning, got "${PF3A005_ADOPTION_POSTURE.formulaStatus}".`,
  };
}

function checkPostureHumanMeaningfulGateNotCleared(): DerivedStaleDaysCheckResult {
  const passed =
    PF3A005_ADOPTION_POSTURE.humanMeaningfulStalenessGate === "not_cleared";
  return {
    checkName: "posture_human_meaningful_staleness_gate_not_cleared",
    passed,
    detail: passed
      ? "PF3A005_ADOPTION_POSTURE.humanMeaningfulStalenessGate is not_cleared - the upstream PF3A-005 guard is preserved."
      : `Expected humanMeaningfulStalenessGate to be not_cleared, got "${PF3A005_ADOPTION_POSTURE.humanMeaningfulStalenessGate}".`,
  };
}

function checkPostureSemanticScopeIsEvidenceFreshnessOnly(): DerivedStaleDaysCheckResult {
  const passed =
    PF3A005_ADOPTION_POSTURE.semanticScope ===
    "evidence_freshness_only_not_human_inactivity";
  return {
    checkName: "posture_semantic_scope_is_evidence_freshness_only",
    passed,
    detail: passed
      ? "PF3A005_ADOPTION_POSTURE.semanticScope is evidence_freshness_only_not_human_inactivity."
      : `Expected semanticScope to be evidence_freshness_only_not_human_inactivity, got "${PF3A005_ADOPTION_POSTURE.semanticScope}".`,
  };
}

function checkPostureNextDecisionBlocksRuntimeAdoption(): DerivedStaleDaysCheckResult {
  const passed =
    PF3A005_ADOPTION_POSTURE.nextRequiredDecision ===
    "stop_or_explicit_scope_downgrade_before_runtime_adoption";
  return {
    checkName: "posture_next_required_decision_blocks_runtime_adoption",
    passed,
    detail: passed
      ? "PF3A005_ADOPTION_POSTURE.nextRequiredDecision requires stop or explicit scope downgrade before any runtime adoption."
      : `Expected nextRequiredDecision to be stop_or_explicit_scope_downgrade_before_runtime_adoption, got "${PF3A005_ADOPTION_POSTURE.nextRequiredDecision}".`,
  };
}

function checkPostureSelectedSourceMatchesFormula(): DerivedStaleDaysCheckResult {
  const passed =
    PF3A005_ADOPTION_POSTURE.selectedSource ===
      SELECTED_DERIVED_STALE_DAYS_SOURCE &&
    PF3A005_ADOPTION_POSTURE.selectedSource ===
      DERIVED_STALE_DAYS_FORMULA.selectedSource;
  return {
    checkName: "posture_selected_source_matches_formula",
    passed,
    detail: passed
      ? `PF3A005_ADOPTION_POSTURE.selectedSource agrees with the formula (${PF3A005_ADOPTION_POSTURE.selectedSource}).`
      : `Posture selectedSource=${PF3A005_ADOPTION_POSTURE.selectedSource}; SELECTED_DERIVED_STALE_DAYS_SOURCE=${SELECTED_DERIVED_STALE_DAYS_SOURCE}; formula.selectedSource=${DERIVED_STALE_DAYS_FORMULA.selectedSource}.`,
  };
}

function checkPostureNotesPreserveGateNotClearedLanguage(): DerivedStaleDaysCheckResult {
  if (PF3A005_ADOPTION_POSTURE.postureNotes.length === 0) {
    return {
      checkName: "posture_notes_preserve_gate_not_cleared_language",
      passed: false,
      detail: "PF3A005_ADOPTION_POSTURE.postureNotes must contain at least one note.",
    };
  }
  const combined = PF3A005_ADOPTION_POSTURE.postureNotes
    .join(" \n ")
    .toLowerCase();
  const requiredPhrases = [
    "does not clear",
    "human-meaningful staleness",
    "stop and re-surface",
    "evidence-freshness-only",
    "does not authorize",
  ];
  const missing = requiredPhrases.filter(
    (phrase) => !combined.includes(phrase),
  );
  const passed = missing.length === 0;
  return {
    checkName: "posture_notes_preserve_gate_not_cleared_language",
    passed,
    detail: passed
      ? "Posture notes preserve gate-not-cleared / human-meaningful-staleness / stop-or-downgrade / evidence-freshness-only / no-authorization language."
      : `Posture notes missing required phrases: ${missing.join("; ")}.`,
  };
}

function checkNoRowImpliesFullRuntimeOrThinReadModelReadiness(): DerivedStaleDaysCheckResult {
  const violations: string[] = [];
  for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
    const fields: string[] = [row.evidenceSummary, ...row.boundaryNotes];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const phrase of FORBIDDEN_READINESS_PHRASES) {
        if (lower.includes(phrase)) {
          violations.push(
            `${row.evidenceId}: contains forbidden readiness phrase "${phrase}"`,
          );
        }
      }
    }
  }
  for (const candidate of DERIVED_STALE_DAYS_SOURCE_CATALOG) {
    const fields = [
      candidate.semantics,
      candidate.verdictRationale,
      candidate.limitationNote,
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const phrase of FORBIDDEN_READINESS_PHRASES) {
        if (lower.includes(phrase)) {
          violations.push(
            `${candidate.candidateId}: contains forbidden readiness phrase "${phrase}"`,
          );
        }
      }
    }
  }
  for (const note of PF3A005_ADOPTION_POSTURE.postureNotes) {
    const lower = note.toLowerCase();
    for (const phrase of FORBIDDEN_READINESS_PHRASES) {
      if (lower.includes(phrase)) {
        violations.push(
          `PF3A005_ADOPTION_POSTURE.postureNotes contains forbidden readiness phrase "${phrase}"`,
        );
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "no_row_implies_full_runtime_or_thin_read_model_readiness",
    passed,
    detail: passed
      ? "No evidence row, catalog entry, or posture note implies PF3A-005 alone is sufficient for runtime or thin read-model readiness."
      : `Forbidden readiness phrases: ${violations.join("; ")}`,
  };
}

export function evaluateDerivedStaleDaysDerivationDesign(): DerivedStaleDaysEvalSummary {
  const checks: DerivedStaleDaysCheckResult[] = [
    checkAtLeastOneEvidenceRow(),
    checkEveryRowHasNonEmptyEvidenceAndBoundary(),
    checkEvidenceIdsAreUnique(),
    checkRepoTruthLocatorsCited(),
    checkBoundaryNotesPreserveDistinctions(),
    checkNoForbiddenAuthorization(),
    checkEvidenceKindsAndCandidatesValid(),
    checkCatalogCoversThreeGuardCandidates(),
    checkExactlyOneSelectedCandidate(),
    checkSelectedSourceIsReadinessObservedAt(),
    checkFormulaShape(),
    checkComputeDerivedStaleDaysHandlesNullInvalidFuture(),
    checkFourteenDayThresholdExamples(),
    checkTakeTwoCalibrationCases(),
    checkDesignNoteRefusesRuntimeAdoption(),
    checkAllGuardCandidatesCoveredByEvidence(),
    checkPostureFormulaStatusIsPlanningOnly(),
    checkPostureHumanMeaningfulGateNotCleared(),
    checkPostureSemanticScopeIsEvidenceFreshnessOnly(),
    checkPostureNextDecisionBlocksRuntimeAdoption(),
    checkPostureSelectedSourceMatchesFormula(),
    checkPostureNotesPreserveGateNotClearedLanguage(),
    checkNoRowImpliesFullRuntimeOrThinReadModelReadiness(),
  ];
  const catalogCandidates = DERIVED_STALE_DAYS_SOURCE_CATALOG.map(
    (entry) => entry.candidateId,
  );
  return {
    totalRows: DERIVED_STALE_DAYS_EVIDENCE.length,
    catalogCandidates,
    selectedSource: SELECTED_DERIVED_STALE_DAYS_SOURCE,
    selectedFormulaExpression: DERIVED_STALE_DAYS_FORMULA.formulaExpression,
    adoptionPosture: PF3A005_ADOPTION_POSTURE,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
