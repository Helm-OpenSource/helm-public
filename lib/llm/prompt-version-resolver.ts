/**
 * prompt-version-resolver — let workspaces pin or roll back to a specific
 * prompt version per key, without forking the builder code.
 *
 * Implementation of T019 spec §二 Gap 5 (prompt template versioning +
 * rollback). Minimum viable scope: per-workspace OVERRIDE of the
 * registry's default version for any given prompt key. The actual prompt
 * builder functions (buildBiReportAnalysisPrompt, etc.) are still owned
 * by lib/llm/prompt-registry.ts; this resolver only decides which
 * VERSION STRING to pass through the recordLLMCall pipeline + which
 * builder variant the caller should route to.
 *
 * Use case: a workspace using V2 prompts hits a regression. Owner sets
 * `promptVersionOverrides: { "bi-report-review": "bi-report-review-v1" }`
 * in the workspace config, falling back to V1 until V2 is fixed.
 *
 * See HELM_LLM_SPEND_AND_ABUSE_GUARDS_SPEC_V1 (internal) §二 Gap 5.
 */

import type { WorkspaceLLMConfig } from "@/lib/llm/types";

export type PromptVersionOverrides = Record<string, string>;

/**
 * Workspace config extension carrying per-key prompt version overrides.
 * Backwards compatible: `undefined` / `null` means "use registry default".
 */
export type WorkspaceLLMConfigWithPromptOverrides = WorkspaceLLMConfig & {
  promptVersionOverrides?: PromptVersionOverrides | null;
};

export function resolvePromptVersionForKey(input: {
  promptKey: string;
  registryDefaultVersion: string;
  workspaceConfig: WorkspaceLLMConfigWithPromptOverrides;
}): { version: string; source: "workspace_override" | "registry_default" } {
  const overrides = input.workspaceConfig.promptVersionOverrides;
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, input.promptKey)) {
    const overrideValue = overrides[input.promptKey];
    if (typeof overrideValue === "string" && overrideValue.length > 0) {
      return { version: overrideValue, source: "workspace_override" };
    }
  }
  return { version: input.registryDefaultVersion, source: "registry_default" };
}

/**
 * Validate that an override version string follows the registry's version
 * naming convention. Used by an API/admin tool when accepting workspace
 * config updates — prevents typos / arbitrary strings.
 */
export function isValidPromptVersionString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 64) return false;
  // Allowed chars: alphanumeric, dash, underscore, dot, slash
  return /^[a-zA-Z0-9_./-]+$/.test(value);
}

/**
 * Apply override map validation: every value must be a valid version string
 * AND match an allowed list (if the caller knows the allowed versions per
 * key). Returns errors per-key.
 */
export function validatePromptVersionOverrides(input: {
  overrides: PromptVersionOverrides;
  allowedVersionsByKey?: Record<string, string[]>;
}): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.overrides)) {
    if (!isValidPromptVersionString(value)) {
      errors[key] = `Invalid version string: ${JSON.stringify(value)}`;
      continue;
    }
    const allowed = input.allowedVersionsByKey?.[key];
    if (allowed && !allowed.includes(value)) {
      errors[key] = `Version "${value}" not in allowed list for key "${key}" (allowed: ${allowed.join(", ")})`;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}
