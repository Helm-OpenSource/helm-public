import { z } from "zod";

/**
 * Agent-ready change packets for infrequent operations (methodology v2 / Phase 4).
 *
 * Suggestions are read/navigate-only handoff artifacts. Helm describes the goal,
 * bounded changes, dry-run, approvals, rollback and receipts; a user-selected
 * general Agent may consume the packet, but Helm never executes it.
 */

const CATEGORY_VALUES = [
  "initialization",
  "connector_setup",
  "data_seed",
  "migration",
  "one_off_config",
] as const;

export type OperationSuggestionCategory = (typeof CATEGORY_VALUES)[number];

const READINESS_VALUES = ["ready", "blocked_precondition", "pending_source"] as const;

export type OperationSuggestionReadiness = (typeof READINESS_VALUES)[number];

const EFFECT_LEVEL_VALUES = [
  "read_only",
  "configuration_change",
  "external_side_effect",
] as const;

export type AgentReadyChangeEffectLevel = (typeof EFFECT_LEVEL_VALUES)[number];

const ROLLBACK_STRATEGY_VALUES = [
  "not_applicable",
  "restore_previous_state",
  "compensating_action",
  "manual_recovery",
] as const;

export type AgentReadyRollbackStrategy = (typeof ROLLBACK_STRATEGY_VALUES)[number];

/** The 11-field handoff contract defined by the Agent-era UI methodology v2. */
export type AgentReadyChangePacket = {
  goal: string;
  currentState: string;
  prerequisites: ReadonlyArray<string>;
  requiredPermissions: ReadonlyArray<string>;
  proposedChanges: ReadonlyArray<string>;
  effectLevel: AgentReadyChangeEffectLevel;
  forbiddenActions: ReadonlyArray<string>;
  dryRun: {
    required: boolean;
    procedure: string;
    expectedResult: string;
  };
  approvalPolicy: {
    required: boolean;
    approverRole: string | null;
    checkpoints: ReadonlyArray<string>;
    separationOfDutiesRequired: boolean;
  };
  rollback: {
    strategy: AgentReadyRollbackStrategy;
    procedure: string;
    verification: string;
  };
  expectedReceipts: ReadonlyArray<string>;
};

export type OperationSuggestion = {
  key: string;
  category: OperationSuggestionCategory;
  title: string;
  rationale: string;
  readiness: OperationSuggestionReadiness;
  preconditionRefs: ReadonlyArray<string>;
  changePacket: AgentReadyChangePacket;
  verificationRef: string;
  /** Navigation only; never an execution callback. */
  href: string | null;
  basisRef: string;
  pendingSourceNote?: string;
};

const CHANGE_PACKET_FIELDS = [
  "goal",
  "currentState",
  "prerequisites",
  "requiredPermissions",
  "proposedChanges",
  "effectLevel",
  "forbiddenActions",
  "dryRun",
  "approvalPolicy",
  "rollback",
  "expectedReceipts",
] as const;

const OPERATION_SUGGESTION_FIELDS: ReadonlySet<string> = new Set([
  "key",
  "category",
  "title",
  "rationale",
  "readiness",
  "preconditionRefs",
  "changePacket",
  "verificationRef",
  "href",
  "basisRef",
  "pendingSourceNote",
]);

const MAX_PACKET_TEXT_LENGTH = 2_000;
const MAX_PACKET_LIST_ITEMS = 50;
const nonEmptyStringSchema = z.string().trim().min(1).max(MAX_PACKET_TEXT_LENGTH);
const packetStringListSchema = z
  .array(nonEmptyStringSchema)
  .max(MAX_PACKET_LIST_ITEMS);

const agentReadyChangePacketSchema = z
  .object({
    goal: nonEmptyStringSchema,
    currentState: nonEmptyStringSchema,
    prerequisites: packetStringListSchema,
    requiredPermissions: packetStringListSchema,
    proposedChanges: packetStringListSchema.min(1),
    effectLevel: z.enum(EFFECT_LEVEL_VALUES),
    forbiddenActions: packetStringListSchema.min(1),
    dryRun: z
      .object({
        required: z.boolean(),
        procedure: nonEmptyStringSchema,
        expectedResult: nonEmptyStringSchema,
      })
      .strict(),
    approvalPolicy: z
      .object({
        required: z.boolean(),
        approverRole: nonEmptyStringSchema.nullable(),
        checkpoints: packetStringListSchema,
        separationOfDutiesRequired: z.boolean(),
      })
      .strict(),
    rollback: z
      .object({
        strategy: z.enum(ROLLBACK_STRATEGY_VALUES),
        procedure: nonEmptyStringSchema,
        verification: nonEmptyStringSchema,
      })
      .strict(),
    expectedReceipts: packetStringListSchema.min(1),
  })
  .strict()
  .superRefine((packet, context) => {
    if (packet.effectLevel !== "read_only" && packet.requiredPermissions.length === 0) {
      context.addIssue({
        code: "custom",
        message: "change_effect_without_required_permissions",
        path: ["requiredPermissions"],
      });
    }
    if (packet.effectLevel === "configuration_change" && !packet.dryRun.required) {
      context.addIssue({
        code: "custom",
        message: "configuration_change_without_required_dry_run",
        path: ["dryRun", "required"],
      });
    }
    if (packet.effectLevel === "external_side_effect" && !packet.dryRun.required) {
      context.addIssue({
        code: "custom",
        message: "external_side_effect_without_required_dry_run",
        path: ["dryRun", "required"],
      });
    }
    if (packet.effectLevel === "external_side_effect" && !packet.approvalPolicy.required) {
      context.addIssue({
        code: "custom",
        message: "external_side_effect_without_approval",
        path: ["approvalPolicy", "required"],
      });
    }
    if (packet.approvalPolicy.required && !packet.approvalPolicy.approverRole) {
      context.addIssue({
        code: "custom",
        message: "approval_without_approver_role",
        path: ["approvalPolicy", "approverRole"],
      });
    }
    if (packet.approvalPolicy.required && packet.approvalPolicy.checkpoints.length === 0) {
      context.addIssue({
        code: "custom",
        message: "approval_without_checkpoints",
        path: ["approvalPolicy", "checkpoints"],
      });
    }
    if (
      packet.approvalPolicy.separationOfDutiesRequired &&
      !packet.approvalPolicy.required
    ) {
      context.addIssue({
        code: "custom",
        message: "separation_of_duties_without_approval",
        path: ["approvalPolicy", "separationOfDutiesRequired"],
      });
    }
  });

const PII_PATTERNS: ReadonlyArray<RegExp> = [
  /\b1[3-9]\d{9}\b/,
  /\b\d{15}(?:\d{2}[0-9Xx])?\b/,
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
];

const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\b(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)\s*[:=]/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isInSitePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes(":") || value.includes("\\")) return false;
  return value.length <= 500;
}

export type OperationSuggestionConformanceIssue = {
  suggestionKey: string | null;
  issue: string;
};

function addIssue(
  issues: OperationSuggestionConformanceIssue[],
  suggestionKey: string | null,
  issue: string,
): void {
  issues.push({ suggestionKey, issue });
}

function scanStringValue(input: {
  value: string;
  path: string;
  suggestionKey: string | null;
  issues: OperationSuggestionConformanceIssue[];
}): void {
  if (input.value.length > MAX_PACKET_TEXT_LENGTH) {
    addIssue(input.issues, input.suggestionKey, `${input.path}_too_long`);
    return;
  }
  if (PII_PATTERNS.some((pattern) => pattern.test(input.value))) {
    addIssue(input.issues, input.suggestionKey, `${input.path}_looks_like_pii`);
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.test(input.value))) {
    addIssue(input.issues, input.suggestionKey, `${input.path}_looks_like_secret`);
  }
}

function scanParsedPacketStrings(
  value: unknown,
  path: string,
  suggestionKey: string | null,
  issues: OperationSuggestionConformanceIssue[],
): void {
  if (typeof value === "string") {
    scanStringValue({ value, path, suggestionKey, issues });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanParsedPacketStrings(item, `${path}[${index}]`, suggestionKey, issues),
    );
    return;
  }
  if (!isRecord(value)) return;
  Object.entries(value).forEach(([field, nestedValue]) =>
    scanParsedPacketStrings(nestedValue, `${path}.${field}`, suggestionKey, issues),
  );
}

function getValueAtPath(value: unknown, path: ReadonlyArray<PropertyKey>): unknown {
  let current = value;
  for (const segment of path) {
    if (typeof segment === "number" && Array.isArray(current)) {
      current = current[segment];
      continue;
    }
    if (typeof segment === "string" && isRecord(current)) {
      current = current[segment];
      continue;
    }
    return undefined;
  }
  return current;
}

function mapPacketSchemaIssue(input: {
  issue: z.ZodIssue;
  packet: Record<string, unknown>;
  suggestionKey: string | null;
  issues: OperationSuggestionConformanceIssue[];
}): void {
  const { issue, packet, suggestionKey, issues } = input;
  if (issue.code === "custom") {
    addIssue(issues, suggestionKey, issue.message);
    return;
  }
  if (issue.code === "unrecognized_keys") {
    const container = getValueAtPath(packet, issue.path);
    issue.keys.forEach((key) => {
      const rawValue = isRecord(container) ? container[key] : undefined;
      const path = ["change_packet", ...issue.path.map(String), key].join(".");
      addIssue(
        issues,
        suggestionKey,
        typeof rawValue === "function"
          ? `callback_field:${path}`
          : `unknown_change_packet_field:${[...issue.path.map(String), key].join(".")}`,
      );
    });
    return;
  }
  const rawValue = getValueAtPath(packet, issue.path);
  if (typeof rawValue === "function") {
    addIssue(
      issues,
      suggestionKey,
      `callback_field:change_packet.${issue.path.map(String).join(".")}`,
    );
    return;
  }
  const [field, ...nestedPath] = issue.path.map(String);
  if (!field) {
    addIssue(issues, suggestionKey, "invalid_change_packet");
    return;
  }
  if (
    CHANGE_PACKET_FIELDS.includes(field as (typeof CHANGE_PACKET_FIELDS)[number]) &&
    !Object.prototype.hasOwnProperty.call(packet, field)
  ) {
    return;
  }
  if (
    (field === "goal" || field === "currentState") &&
    !isNonEmptyString(packet[field])
  ) {
    addIssue(issues, suggestionKey, `empty_change_packet_field:${field}`);
    return;
  }
  if (
    (field === "proposedChanges" ||
      field === "forbiddenActions" ||
      field === "expectedReceipts") &&
    Array.isArray(packet[field]) &&
    packet[field].length === 0
  ) {
    addIssue(issues, suggestionKey, `empty_change_packet_field:${field}`);
    return;
  }
  if (field === "effectLevel") {
    addIssue(issues, suggestionKey, "unknown_change_packet_effect_level");
    return;
  }
  addIssue(
    issues,
    suggestionKey,
    `invalid_change_packet_field:${[field, ...nestedPath].join(".")}`,
  );
}

function validateChangePacket(
  value: unknown,
  suggestionKey: string | null,
  issues: OperationSuggestionConformanceIssue[],
): AgentReadyChangePacket | null {
  if (!isRecord(value)) {
    addIssue(issues, suggestionKey, "missing_change_packet");
    return null;
  }
  for (const field of CHANGE_PACKET_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      addIssue(issues, suggestionKey, `missing_change_packet_field:${field}`);
    }
  }
  const parsed = agentReadyChangePacketSchema.safeParse(value);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) =>
      mapPacketSchemaIssue({ issue, packet: value, suggestionKey, issues }),
    );
    return null;
  }
  scanParsedPacketStrings(parsed.data, "change_packet", suggestionKey, issues);
  return parsed.data;
}

/**
 * Returns all conformance issues. The resolver drops only each offending item,
 * records its provider and never partially renders a malformed change packet.
 */
export function validateOperationSuggestions(
  suggestions: ReadonlyArray<OperationSuggestion>,
): OperationSuggestionConformanceIssue[] {
  const issues: OperationSuggestionConformanceIssue[] = [];
  const seenKeys = new Set<string>();

  for (const rawSuggestion of suggestions as ReadonlyArray<unknown>) {
    if (!isRecord(rawSuggestion)) {
      addIssue(issues, null, "suggestion_not_object");
      continue;
    }
    const suggestionKey = isNonEmptyString(rawSuggestion.key) ? rawSuggestion.key : null;
    if (!isNonEmptyString(rawSuggestion.key)) addIssue(issues, suggestionKey, "empty_key");
    if (!isNonEmptyString(rawSuggestion.title)) addIssue(issues, suggestionKey, "empty_title");
    if (!isNonEmptyString(rawSuggestion.rationale)) {
      addIssue(issues, suggestionKey, "empty_rationale");
    }
    if (!isNonEmptyString(rawSuggestion.verificationRef)) {
      addIssue(issues, suggestionKey, "empty_verification_ref");
    }
    if (!isNonEmptyString(rawSuggestion.basisRef)) {
      addIssue(issues, suggestionKey, "empty_basis_ref");
    }
    if (suggestionKey) {
      if (seenKeys.has(suggestionKey)) addIssue(issues, suggestionKey, "duplicate_key");
      seenKeys.add(suggestionKey);
    }
    if (!CATEGORY_VALUES.includes(rawSuggestion.category as OperationSuggestionCategory)) {
      addIssue(issues, suggestionKey, "unknown_category");
    }
    if (!READINESS_VALUES.includes(rawSuggestion.readiness as OperationSuggestionReadiness)) {
      addIssue(issues, suggestionKey, "unknown_readiness");
    }
    if (Object.prototype.hasOwnProperty.call(rawSuggestion, "agentBrief")) {
      addIssue(issues, suggestionKey, "legacy_agent_brief_not_allowed");
    }
    for (const [field, value] of Object.entries(rawSuggestion)) {
      if (!OPERATION_SUGGESTION_FIELDS.has(field)) {
        addIssue(
          issues,
          suggestionKey,
          typeof value === "function"
            ? `callback_field:${field}`
            : `unknown_suggestion_field:${field}`,
        );
      }
    }

    const packet = validateChangePacket(rawSuggestion.changePacket, suggestionKey, issues);
    const preconditionRefs = rawSuggestion.preconditionRefs;
    if (!Array.isArray(preconditionRefs)) {
      addIssue(issues, suggestionKey, "precondition_refs_not_array");
    } else if (preconditionRefs.some((ref) => !isNonEmptyString(ref))) {
      addIssue(issues, suggestionKey, "empty_precondition_ref");
    } else if (preconditionRefs.length > MAX_PACKET_LIST_ITEMS) {
      addIssue(issues, suggestionKey, "too_many_precondition_refs");
    }
    const topLevelStrings: ReadonlyArray<[string, unknown]> = [
      ["key", rawSuggestion.key],
      ["title", rawSuggestion.title],
      ["rationale", rawSuggestion.rationale],
      ["verificationRef", rawSuggestion.verificationRef],
      ["basisRef", rawSuggestion.basisRef],
      ["pendingSourceNote", rawSuggestion.pendingSourceNote],
      ["href", rawSuggestion.href],
    ];
    topLevelStrings.forEach(([path, value]) => {
      if (typeof value === "string") {
        scanStringValue({ value, path, suggestionKey, issues });
      }
    });
    if (Array.isArray(preconditionRefs)) {
      preconditionRefs.forEach((ref, index) => {
        if (typeof ref === "string") {
          scanStringValue({
            value: ref,
            path: `preconditionRefs[${index}]`,
            suggestionKey,
            issues,
          });
        }
      });
    }
    if (
      rawSuggestion.readiness === "blocked_precondition" &&
      (!Array.isArray(preconditionRefs) || preconditionRefs.length === 0)
    ) {
      addIssue(issues, suggestionKey, "blocked_without_precondition_refs");
    }
    if (
      rawSuggestion.readiness === "blocked_precondition" &&
      packet?.prerequisites.length === 0
    ) {
      addIssue(issues, suggestionKey, "blocked_without_packet_prerequisites");
    }
    if (
      rawSuggestion.readiness === "pending_source" &&
      !isNonEmptyString(rawSuggestion.pendingSourceNote)
    ) {
      addIssue(issues, suggestionKey, "pending_source_without_note");
    }
    if (
      rawSuggestion.href !== null &&
      (typeof rawSuggestion.href !== "string" || !isInSitePath(rawSuggestion.href))
    ) {
      addIssue(issues, suggestionKey, "href_not_in_site");
    }
  }

  return issues;
}

/** Core has no infrequent-operation source; empty is the honest default. */
export function buildCoreDefaultOperationSuggestions(): ReadonlyArray<OperationSuggestion> {
  return [];
}
