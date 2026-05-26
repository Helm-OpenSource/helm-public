/**
 * Helm feature flags
 *
 * Env-driven, read-only at module load. The shared layer reads boolean /
 * allow-list flags via the helpers in this file; **no** DB write path,
 * **no** central flag service, **no** dynamic toggle UI is introduced
 * here. Flag changes happen at deploy time by setting env vars.
 *
 * Flags listed in this file are subject to the controlled-trial posture
 * (see AGENTS.md §6 hard boundaries). New flags must:
 *   1. default to the safe / disabled state
 *   2. document the runtime adoption gate they participate in
 *   3. add a test that the default state preserves existing behaviour
 */

// ---------------------------------------------------------------------------
// Phase 3 runtime adoption — Business Advancement thin read-model adapter
// ---------------------------------------------------------------------------
// See docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md
// and docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md §三
// Week 2 #15. Gating chain:
//   1. BUSINESS_ADVANCEMENT_RUNTIME_ENABLED must be `true`
//   2. workspaceId must be in BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST
//   3. all 6 hard prerequisites + 5-role Required Reviewer approval landed
// Default behaviour: gate off → callers fall back to read-first compression
// (no behaviour change vs. pre-Phase-3 main).

const BUSINESS_ADVANCEMENT_ENV_KEYS = {
  RUNTIME_ENABLED: "BUSINESS_ADVANCEMENT_RUNTIME_ENABLED",
  RUNTIME_ALLOWLIST: "BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST",
} as const;

const OPERATING_SIGNAL_FLOW_SHADOW_ENV_KEYS = {
  RUNTIME_SHADOW_ENABLED: "OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED",
  RUNTIME_SHADOW_ALLOWLIST: "OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST",
} as const;

function readBooleanEnv(key: string): boolean {
  const raw = process.env[key];
  if (raw == null) return false;
  return ["true", "1", "yes", "on"].includes(raw.trim().toLowerCase());
}

function readCsvEnv(key: string): readonly string[] {
  const raw = process.env[key];
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * @returns `true` only when the Business Advancement runtime adoption flag
 *   is explicitly set to a truthy value AND the workspace appears in the
 *   allow-list. Either condition missing → `false`.
 *
 * The function does not throw, does not call DB, does not call network.
 * Callers must assume `false` is the default and write fallback paths
 * accordingly.
 */
export function isBusinessAdvancementRuntimeEnabledForWorkspace(
  workspaceId: string,
): boolean {
  if (!readBooleanEnv(BUSINESS_ADVANCEMENT_ENV_KEYS.RUNTIME_ENABLED)) return false;
  const allowlist = readCsvEnv(BUSINESS_ADVANCEMENT_ENV_KEYS.RUNTIME_ALLOWLIST);
  if (allowlist.length === 0) return false;
  return allowlist.includes(workspaceId);
}

/**
 * Exposed for tests and oncall diagnostics. Returns the current snapshot;
 * callers should treat each invocation as a fresh env read.
 */
export function readBusinessAdvancementRuntimeFlagSnapshot(): {
  flagEnabled: boolean;
  allowlist: readonly string[];
} {
  return {
    flagEnabled: readBooleanEnv(BUSINESS_ADVANCEMENT_ENV_KEYS.RUNTIME_ENABLED),
    allowlist: readCsvEnv(BUSINESS_ADVANCEMENT_ENV_KEYS.RUNTIME_ALLOWLIST),
  };
}

// ---------------------------------------------------------------------------
// Phase 3A runtime shadow — Operating Signal Flow read-only projection
// ---------------------------------------------------------------------------
// See docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3A_SHADOW_ADAPTER_IMPLEMENTATION_PLAN.md.
// Gating chain:
//   1. OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED must be `true`
//   2. workspaceId must be in OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST
// Default behaviour: gate off -> /operating keeps using the fixture-backed
// display; no runtime query is attempted.

export function isOperatingSignalFlowRuntimeShadowEnabledForWorkspace(
  workspaceId: string,
): boolean {
  if (!readBooleanEnv(OPERATING_SIGNAL_FLOW_SHADOW_ENV_KEYS.RUNTIME_SHADOW_ENABLED)) {
    return false;
  }
  const allowlist = readCsvEnv(OPERATING_SIGNAL_FLOW_SHADOW_ENV_KEYS.RUNTIME_SHADOW_ALLOWLIST);
  if (allowlist.length === 0) return false;
  return allowlist.includes(workspaceId);
}

export function readOperatingSignalFlowRuntimeShadowFlagSnapshot(): {
  flagEnabled: boolean;
  allowlist: readonly string[];
} {
  return {
    flagEnabled: readBooleanEnv(OPERATING_SIGNAL_FLOW_SHADOW_ENV_KEYS.RUNTIME_SHADOW_ENABLED),
    allowlist: readCsvEnv(OPERATING_SIGNAL_FLOW_SHADOW_ENV_KEYS.RUNTIME_SHADOW_ALLOWLIST),
  };
}
