/**
 * Helm — HSI Pack Artifact Contracts.
 *
 * Phase 1 OFFLINE planning artifact. TS types + validators for the
 * three non-manifest pack artifacts declared in HSI-01:
 *
 *   - implementation_checklist (free-form Markdown; no validator)
 *   - review_packet_template   (JSON shape validated here)
 *   - payload_examples         (JSON shape validated here)
 *
 * These are checked-in files only — no runtime loader is wired. The
 * point of the validators is to keep `case-management-sample` and
 * any future Phase 1 pack honest about the contract before fixtures
 * are added.
 */

import type { HsiDataPosture, HsiReviewSurface, HsiSourceKind } from "./pack-manifest";

// ---------------------------------------------------------------------------
// Review packet template (HSI-01 + HSI-04)
// ---------------------------------------------------------------------------

const REVIEW_PACKET_FORBIDDEN_TRUE_KEYS = [
  "sent",
  "approved",
  "executed",
  "committed",
  "officialWritePerformed",
] as const;

type ReviewPacketForbiddenKey = (typeof REVIEW_PACKET_FORBIDDEN_TRUE_KEYS)[number];

export interface HsiReviewPacketTemplate {
  readonly packId: string;
  readonly templateVersion: string;
  readonly schema?: Record<string, unknown>;
  readonly defaults: {
    readonly humanReviewerRequired: true;
    readonly notForAutoSend: true;
    readonly sent: false;
    readonly approved: false;
    readonly executed: false;
    readonly committed: false;
    readonly officialWritePerformed: false;
    readonly allowedNextSurface: HsiReviewSurface;
    readonly requiredReviewSurface: HsiReviewSurface;
    readonly forbiddenActions: readonly string[];
  };
}

const REQUIRED_REVIEW_PACKET_SCHEMA_FIELDS = [
  "evidence",
  "recommendation",
  "risks",
  "boundaries",
  "nextSteps",
  "owner",
] as const;

/**
 * Validates a review packet template. The HSI-04 invariants
 * (preparation-only flags) must be present and locked at their
 * literal types.
 */
export function validateHsiReviewPacketTemplate(
  raw: unknown,
): readonly string[] {
  const violations: string[] = [];
  if (!isRecord(raw)) {
    return ["review_packet_template_not_an_object"];
  }
  if (typeof raw.packId !== "string" || raw.packId.length === 0) {
    violations.push("review_packet_template_missing_pack_id");
  }
  if (typeof raw.templateVersion !== "string" || raw.templateVersion.length === 0) {
    violations.push("review_packet_template_missing_template_version");
  }
  if (!isRecord(raw.defaults)) {
    violations.push("review_packet_template_missing_defaults");
    return violations;
  }

  if (!isRecord(raw.schema)) {
    violations.push("review_packet_template_missing_schema");
  } else {
    for (const field of REQUIRED_REVIEW_PACKET_SCHEMA_FIELDS) {
      if (!(field in raw.schema)) {
        violations.push(`review_packet_template_missing_schema_field:${field}`);
      }
    }
  }

  const defaults = raw.defaults;
  if (defaults.humanReviewerRequired !== true) {
    violations.push("review_packet_template_human_reviewer_required_not_true");
  }
  if (defaults.notForAutoSend !== true) {
    violations.push("review_packet_template_not_for_auto_send_not_true");
  }
  for (const key of REVIEW_PACKET_FORBIDDEN_TRUE_KEYS) {
    if (defaults[key as ReviewPacketForbiddenKey] !== false) {
      violations.push(`review_packet_template_${key}_must_default_false`);
    }
  }
  if (typeof defaults.allowedNextSurface !== "string") {
    violations.push("review_packet_template_missing_allowed_next_surface");
  }
  if (typeof defaults.requiredReviewSurface !== "string") {
    violations.push("review_packet_template_missing_required_review_surface");
  }
  if (!Array.isArray(defaults.forbiddenActions) || defaults.forbiddenActions.length === 0) {
    violations.push("review_packet_template_missing_forbidden_actions");
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Payload examples (HSI-01)
// ---------------------------------------------------------------------------

export type HsiPayloadDirection = "input" | "output";

export interface HsiPayloadExample {
  readonly exampleId: string;
  readonly sourceKind: HsiSourceKind;
  readonly direction: HsiPayloadDirection;
  readonly dataPosture: HsiDataPosture;
  readonly title: string;
  readonly data: unknown;
}

export interface HsiPayloadExampleSet {
  readonly packId: string;
  readonly version: string;
  readonly examples: readonly HsiPayloadExample[];
}

const ALLOWED_DATA_POSTURES: readonly HsiDataPosture[] = [
  "synthetic",
  "redacted",
  "alias_only",
];

const ALLOWED_DIRECTIONS: readonly HsiPayloadDirection[] = ["input", "output"];

/**
 * Validates a payload example set against HSI-01 contract:
 * - every example has a known sourceKind + direction
 * - dataPosture is one of synthetic | redacted | alias_only
 * - every sourceKind referenced has at least one input AND at
 *   least one output example
 * - exampleIds are unique
 */
export function validateHsiPayloadExampleSet(
  raw: unknown,
  knownSourceKinds: readonly HsiSourceKind[],
): readonly string[] {
  const violations: string[] = [];
  if (!isRecord(raw)) {
    return ["payload_example_set_not_an_object"];
  }
  if (typeof raw.packId !== "string" || raw.packId.length === 0) {
    violations.push("payload_example_set_missing_pack_id");
  }
  if (typeof raw.version !== "string" || raw.version.length === 0) {
    violations.push("payload_example_set_missing_version");
  }
  if (!Array.isArray(raw.examples) || raw.examples.length === 0) {
    violations.push("payload_example_set_missing_examples");
    return violations;
  }

  const seenIds = new Set<string>();
  const seenInputBySource = new Set<string>();
  const seenOutputBySource = new Set<string>();

  for (const item of raw.examples) {
    if (!isRecord(item)) {
      violations.push("payload_example_not_an_object");
      continue;
    }
    const id = typeof item.exampleId === "string" ? item.exampleId : "<unknown>";
    if (typeof item.exampleId !== "string" || item.exampleId.length === 0) {
      violations.push("payload_example_missing_example_id");
    } else if (seenIds.has(id)) {
      violations.push(`payload_example_duplicate_id:${id}`);
    } else {
      seenIds.add(id);
    }

    const sourceKind = item.sourceKind as HsiSourceKind | undefined;
    if (!sourceKind || !knownSourceKinds.includes(sourceKind)) {
      violations.push(
        `payload_example_unknown_source_kind:${id}:${String(sourceKind ?? "<missing>")}`,
      );
    }
    const direction = item.direction as HsiPayloadDirection | undefined;
    if (!direction || !ALLOWED_DIRECTIONS.includes(direction)) {
      violations.push(
        `payload_example_unknown_direction:${id}:${String(direction ?? "<missing>")}`,
      );
    }
    const posture = item.dataPosture as HsiDataPosture | undefined;
    if (!posture || !ALLOWED_DATA_POSTURES.includes(posture)) {
      violations.push(
        `payload_example_unknown_data_posture:${id}:${String(posture ?? "<missing>")}`,
      );
    }
    if (typeof item.title !== "string" || item.title.length === 0) {
      violations.push(`payload_example_missing_title:${id}`);
    }
    if (item.data === undefined || item.data === null) {
      violations.push(`payload_example_missing_data:${id}`);
    }

    if (sourceKind && direction === "input") {
      seenInputBySource.add(sourceKind);
    }
    if (sourceKind && direction === "output") {
      seenOutputBySource.add(sourceKind);
    }
  }

  // HSI-01: each source kind must have at least one input AND
  // one output example.
  for (const kind of knownSourceKinds) {
    if (!seenInputBySource.has(kind)) {
      violations.push(`payload_example_set_missing_input_for_source:${kind}`);
    }
    if (!seenOutputBySource.has(kind)) {
      violations.push(`payload_example_set_missing_output_for_source:${kind}`);
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
