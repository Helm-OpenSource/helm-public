/**
 * Helm — HSI Facade Types (HSI-03).
 *
 * Phase 1 OFFLINE planning artifact. These are *types only* — no
 * runtime implementation exists, and Phase 1 explicitly forbids
 * implementing them as schema, API, runtime query, hosted MCP or
 * production connector. The point is to lock the shape so future
 * Phase 2 local-CLI preview consumes the same contract the eval
 * gate is built against.
 *
 * Source of truth: docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md
 * Section HSI-03 (Headless Facade Contract) + HSI-04 (Preparation-only).
 */

import type {
  HsiDataPosture,
  HsiReviewSurface,
  HsiSignalFamily,
  HsiSourceKind,
} from "./pack-manifest";

/**
 * READ-ONLY. Returns the capabilities a pack supports for a given
 * intent / source / signal-family slice. No payload data, no state
 * transitions, no LLM ranking.
 */
export interface SearchSignalCapabilitiesInput {
  readonly workspaceId: string;
  readonly intent?: string;
  readonly sourceKind?: HsiSourceKind;
  readonly signalFamily?: HsiSignalFamily;
}

export interface SearchSignalCapabilitiesResult {
  readonly capabilities: ReadonlyArray<{
    readonly capabilityId: string;
    readonly packId: string;
    readonly signalFamily: HsiSignalFamily;
    readonly description: string;
    readonly reviewSurface: HsiReviewSurface;
  }>;
}

/**
 * READ-ONLY. Returns a redacted / synthetic payload example for a
 * specific capability. Never returns raw customer data, even if a
 * caller asks for it — the eval verifies cross-tenant or raw
 * payload returns as `rawDataLeakCount` incident.
 */
export interface GetSignalPayloadExampleInput {
  readonly workspaceId: string;
  readonly capabilityId: string;
}

export interface GetSignalPayloadExampleResult {
  readonly fixtureId: string;
  readonly dataPosture: HsiDataPosture;
  readonly input: unknown;
  readonly output: unknown;
  readonly requiredFields: readonly string[];
  readonly boundaryFields: readonly string[];
}

/**
 * READ-ONLY. Projects an Operating Signal Flow snapshot from
 * fixture or, in later phases, an authorized read model. Phase 1
 * answers only from fixtures.
 */
export interface ProjectOperatingSignalSnapshotInput {
  readonly workspaceId: string;
  readonly fixtureScope: "pack_default" | "named_fixture";
  readonly fixtureId?: string;
}

export interface ProjectOperatingSignalSnapshotResult {
  readonly workspaceId: string;
  readonly generatedAt: string;
  readonly nodes: ReadonlyArray<{
    readonly nodeId: string;
    readonly signalFamily: HsiSignalFamily;
    readonly blocker?: string;
    readonly evidenceRefs: readonly string[];
  }>;
  readonly highestPressurePath: readonly string[];
}

/**
 * PREPARATION-ONLY (HSI-04). Drafts a review packet. Crossing any
 * of the forbidden boundaries — auto-send, auto-approve, status
 * change, cross-workspace draft, raw payload — is a hard violation
 * tallied by the evaluator.
 *
 * Output is a draft that a human reviewer must explicitly approve
 * via a separate surface; the packet itself cannot trigger any
 * external side effect.
 */
export interface PrepareReviewPacketInput {
  readonly workspaceId: string;
  readonly capabilityId: string;
  readonly fixtureId: string;
}

export interface PrepareReviewPacketResult {
  /** Always false in Phase 1. Setting this true is a violation. */
  readonly sent: false;
  /** Always false in Phase 1. Setting this true is a violation. */
  readonly approved: false;
  /** Always false in Phase 1. Setting this true is a violation. */
  readonly executed: false;
  /** Always false in Phase 1. Setting this true is a violation. */
  readonly committed: false;
  /** Always false in Phase 1. Setting this true is a violation. */
  readonly officialWritePerformed: false;
  /** Hard flag — see HSI-04. */
  readonly notForAutoSend: true;
  readonly humanReviewerRequired: true;
  readonly requiredReviewSurface: HsiReviewSurface;
  readonly evidenceRefs: readonly string[];
  readonly risks: readonly string[];
  readonly missingInfo: readonly string[];
  readonly allowedNextSurface: HsiReviewSurface;
  readonly forbiddenActions: readonly string[];
  readonly draftBody: string;
}

/**
 * READ-ONLY. Explains why a proposed action would be allowed,
 * downgraded or refused given the current pack policy. Used by
 * `boundary_attempt` family fixtures to verify boundary classifier
 * has explicit reasons attached.
 */
export interface ExplainSignalBoundaryInput {
  readonly workspaceId: string;
  readonly proposedAction: string;
  readonly capabilityId: string;
}

export type ExplainSignalBoundaryOutcome =
  | "allowed"
  | "downgraded_to_draft"
  | "downgraded_to_review_packet"
  | "refused";

export interface ExplainSignalBoundaryResult {
  readonly outcome: ExplainSignalBoundaryOutcome;
  readonly reason: string;
  readonly forbidden: boolean;
}

/**
 * Union shape used by the evaluator to traverse facade declarations
 * in fixtures. Future Phase 2 CLI preview implementations should
 * type their handlers against this union to keep the contract in
 * sync.
 */
export type HsiFacadeShape =
  | {
      readonly name: "search_signal_capabilities";
      readonly input: SearchSignalCapabilitiesInput;
      readonly output: SearchSignalCapabilitiesResult;
    }
  | {
      readonly name: "get_signal_payload_example";
      readonly input: GetSignalPayloadExampleInput;
      readonly output: GetSignalPayloadExampleResult;
    }
  | {
      readonly name: "project_operating_signal_snapshot";
      readonly input: ProjectOperatingSignalSnapshotInput;
      readonly output: ProjectOperatingSignalSnapshotResult;
    }
  | {
      readonly name: "prepare_review_packet";
      readonly input: PrepareReviewPacketInput;
      readonly output: PrepareReviewPacketResult;
    }
  | {
      readonly name: "explain_signal_boundary";
      readonly input: ExplainSignalBoundaryInput;
      readonly output: ExplainSignalBoundaryResult;
    };
