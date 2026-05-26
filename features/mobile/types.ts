/**
 * Helm Mobile Command Surface Types
 *
 * Phase 1: Static Mobile IA Prototype
 * Reference: docs/product/HELM_MOBILE_COMMAND_SURFACE_REQUIREMENTS_V1.md
 */

/**
 * The 6 types of Must Push items that can appear on the mobile first screen.
 * Each represents a different urgency or blocking condition that requires user attention.
 */
export type MustPushType =
  | "overdue_commitment"
  | "blocked_decision"
  | "stalled_opportunity"
  | "meeting_follow_up"
  | "customer_waiting"
  | "proof_or_review_required";

/**
 * Severity level for Must Push items. Used in deterministic ranking.
 */
export type MustPushSeverity = "critical" | "high" | "medium" | "low";

/**
 * Action mode indicates what kind of page or action the primary button leads to.
 */
export type MustPushActionMode =
  | "open_page"
  | "open_object"
  | "open_review"
  | "prepare_draft";

export type MobileAskHelmActionMode = MustPushActionMode;

export type MustPushOutcomeCheckpointStatus =
  | "not_collected"
  | "review_pending"
  | "accepted"
  | "downgraded"
  | "blocked";

/**
 * Outcome checkpoint keeps a Must Push item from ending at a recommendation.
 * It points the operator to the next review-safe result signal to collect.
 */
export interface MustPushOutcomeCheckpoint {
  /** Short label for the checkpoint */
  label: string;
  /** When the outcome should be checked again */
  dueHint: string;
  /** The result signal Helm expects to review next */
  expectedSignal: string;
  /** Internal review-safe navigation target; no external write is implied */
  reviewHref: string;
  /** Current collection posture */
  status: MustPushOutcomeCheckpointStatus;
}

export type MustPushOutcomeLedgerPosture =
  | "collect_signal"
  | "review_due"
  | "accepted"
  | "blocked";

/**
 * Review-safe outcome ledger item derived from Must Push checkpoints.
 * This is a read model only: no outcome write, external send, or commitment is implied.
 */
export interface MustPushOutcomeLedgerItem {
  id: string;
  mustPushId: string;
  title: string;
  type: MustPushType;
  severity: MustPushSeverity;
  checkpointStatus: MustPushOutcomeCheckpointStatus;
  posture: MustPushOutcomeLedgerPosture;
  dueHint: string;
  expectedSignal: string;
  reviewHref: string | null;
  boundaryNote: string;
}

export interface MustPushOutcomeReviewCue {
  mustPushId: string;
  question: string;
  evidenceToCheck: string[];
  allowedDecisions: string[];
  boundaryNote: string;
}

export interface MustPushOutcomeLedgerSummary {
  items: MustPushOutcomeLedgerItem[];
  dueCount: number;
  reviewPendingCount: number;
  blockedCount: number;
  nextReviewHref: string | null;
  reviewCue: MustPushOutcomeReviewCue | null;
  summary: string;
  boundaryNote: string;
}

/**
 * A single Must Push item displayed on the mobile first screen.
 * Each item answers: what is it, why now, where to go, and what boundary applies.
 */
export interface MustPushItem {
  /** Unique identifier for this item */
  id: string;
  /** Type of Must Push item */
  type: MustPushType;
  /** Short title (what is it) */
  title: string;
  /** Explanation of why this needs attention now (1-2 sentences) */
  reason: string;
  /** Primary action to take */
  primaryAction: {
    /** Button label */
    label: string;
    /** Deep link to destination */
    href: string;
    /** Type of action/destination */
    mode: MustPushActionMode;
  };
  /** Optional boundary note when recommendation != commitment or review is required */
  boundaryNote?: {
    type: "read_only" | "review_required" | "suggestion_not_commitment" | "out_of_scope";
    message: string;
  };
  /** Review-safe checkpoint for collecting the result after this item is acted on */
  outcomeCheckpoint?: MustPushOutcomeCheckpoint;
  /** Severity for sorting */
  severity: MustPushSeverity;
  /** Score for deterministic ranking (higher = more urgent) */
  score: number;
}

/**
 * Mobile-specific Ask Helm response contract.
 * Compressed from desktop AskHelmResponse for smaller screens.
 */
export interface MobileAskHelmResponse {
  /** Main answer (1 sentence max) */
  judgement: string;
  /** Explanation (1-2 sentences max) */
  reason: string;
  /** Primary action button */
  primaryAction: {
    label: string;
    href: string;
    mode: MobileAskHelmActionMode;
  };
  /** Optional secondary action */
  secondaryAction?: {
    label: string;
    href: string;
  };
  /** Boundary note for high-risk, review-required, or scope-limited queries */
  boundaryNote?: {
    type: string;
    message: string;
  };
  /** Grounding information showing what data was used */
  grounding: {
    objectCount: number;
    memoryUsed: boolean;
    systemKnowledgeUsed: boolean;
    sourceLabels: string[];
  };
}

/**
 * Workspace status displayed at the top of mobile first screen.
 */
export interface WorkspaceStatus {
  /** Workspace name */
  workspaceName: string;
  /** One-sentence summary of today's focus */
  todaySummary: string;
  /** Highest risk or priority item */
  topAlert: string | null;
  /** Number of items requiring review */
  reviewCount: number;
  /** Number of visible Must Push items with outcome checkpoints */
  outcomeCheckpointCount?: number;
}

/**
 * Preset prompt for Ask Helm input.
 */
export interface AskHelmPresetPrompt {
  /** Display text */
  label: string;
  /** Actual query to send to interpreter */
  query: string;
}

// ── Mobile Hero / Judgement Loop ──────────────────────────────────────────────

export type MobileHeroState =
  | "normal"
  | "evidence_insufficient"
  | "conflict"
  | "connector_down"
  | "cross_tenant_denied"
  | "empty";

/** Pointer to the evidence that backs a Hero card — no raw original quote. */
export interface MobileHeroEvidenceRef {
  /** Human-readable hint about the data source (e.g. "CRM · 3 records") */
  sourceHint: string;
  /** Helm's interpretation of what the evidence means */
  helmInterpretation: string;
}

/** A single action rendered on the Hero card. Always GET / internal href. */
export interface MobileHeroAction {
  label: string;
  href: string;
  /** "primary" = main CTA; "secondary" = supporting link */
  variant: "primary" | "secondary";
}

/** The read-model returned by buildMobileJudgementLoop. */
export interface MobileJudgementLoopModel {
  state: MobileHeroState;
  /** Null when state is "empty". */
  item: MustPushItem | null;
  /** One-line headline shown in the Hero card. */
  headline: string;
  /** Short sub-text (1 sentence). */
  subtext: string;
  evidence: MobileHeroEvidenceRef | null;
  actions: MobileHeroAction[];
}
