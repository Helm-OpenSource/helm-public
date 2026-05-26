import { describe, expect, it } from "vitest";
import {
  isValidPromptVersionString,
  resolvePromptVersionForKey,
  validatePromptVersionOverrides,
} from "@/lib/llm/prompt-version-resolver";
import type { WorkspaceLLMConfig } from "@/lib/llm/types";

const baseConfig: WorkspaceLLMConfig = {
  provider: "qwen",
  defaultModel: "qwen3.6-plus",
  extractionModel: "qwen3.6-plus",
  briefingModel: "qwen3.6-plus",
  reasoningModel: "qwen3.6-plus",
  llmEnabled: true,
  llmBudgetTier: "pilot",
};

describe("prompt-version-resolver · resolvePromptVersionForKey", () => {
  it("returns registry default when no overrides", () => {
    const r = resolvePromptVersionForKey({
      promptKey: "bi-report-review",
      registryDefaultVersion: "bi-report-review-v2",
      workspaceConfig: baseConfig,
    });
    expect(r.version).toBe("bi-report-review-v2");
    expect(r.source).toBe("registry_default");
  });

  it("returns registry default when overrides is null", () => {
    const r = resolvePromptVersionForKey({
      promptKey: "bi-report-review",
      registryDefaultVersion: "bi-report-review-v2",
      workspaceConfig: { ...baseConfig, promptVersionOverrides: null },
    });
    expect(r.version).toBe("bi-report-review-v2");
    expect(r.source).toBe("registry_default");
  });

  it("returns workspace override when present", () => {
    const r = resolvePromptVersionForKey({
      promptKey: "bi-report-review",
      registryDefaultVersion: "bi-report-review-v2",
      workspaceConfig: {
        ...baseConfig,
        promptVersionOverrides: { "bi-report-review": "bi-report-review-v1" },
      },
    });
    expect(r.version).toBe("bi-report-review-v1");
    expect(r.source).toBe("workspace_override");
  });

  it("falls back to registry default when override exists but for a different key", () => {
    const r = resolvePromptVersionForKey({
      promptKey: "object-briefing",
      registryDefaultVersion: "briefing-v1",
      workspaceConfig: {
        ...baseConfig,
        promptVersionOverrides: { "bi-report-review": "bi-report-review-v1" },
      },
    });
    expect(r.version).toBe("briefing-v1");
    expect(r.source).toBe("registry_default");
  });

  it("falls back to registry default when override value is empty string", () => {
    const r = resolvePromptVersionForKey({
      promptKey: "object-briefing",
      registryDefaultVersion: "briefing-v1",
      workspaceConfig: {
        ...baseConfig,
        promptVersionOverrides: { "object-briefing": "" },
      },
    });
    expect(r.version).toBe("briefing-v1");
    expect(r.source).toBe("registry_default");
  });
});

describe("prompt-version-resolver · isValidPromptVersionString", () => {
  it("accepts valid version strings", () => {
    expect(isValidPromptVersionString("v1")).toBe(true);
    expect(isValidPromptVersionString("briefing-v1")).toBe(true);
    expect(isValidPromptVersionString("bi-report-review-v2.1")).toBe(true);
    expect(isValidPromptVersionString("v1/experimental")).toBe(true);
    expect(isValidPromptVersionString("v_1_test")).toBe(true);
  });

  it("rejects empty / too-long strings", () => {
    expect(isValidPromptVersionString("")).toBe(false);
    expect(isValidPromptVersionString("a".repeat(65))).toBe(false);
  });

  it("rejects non-string types", () => {
    expect(isValidPromptVersionString(null)).toBe(false);
    expect(isValidPromptVersionString(undefined)).toBe(false);
    expect(isValidPromptVersionString(123)).toBe(false);
    expect(isValidPromptVersionString({})).toBe(false);
  });

  it("rejects strings with disallowed characters", () => {
    expect(isValidPromptVersionString("v1 with space")).toBe(false);
    expect(isValidPromptVersionString("v1@$%")).toBe(false);
    expect(isValidPromptVersionString("v1\n")).toBe(false);
  });
});

describe("prompt-version-resolver · validatePromptVersionOverrides", () => {
  it("ok when all entries are valid version strings (no allowedVersions)", () => {
    const r = validatePromptVersionOverrides({
      overrides: {
        "bi-report-review": "bi-report-review-v1",
        "object-briefing": "briefing-v1",
      },
    });
    expect(r.ok).toBe(true);
    expect(Object.keys(r.errors)).toHaveLength(0);
  });

  it("fails when version string is invalid", () => {
    const r = validatePromptVersionOverrides({
      overrides: {
        "bi-report-review": "has space",
      },
    });
    expect(r.ok).toBe(false);
    expect(r.errors["bi-report-review"]).toContain("Invalid version string");
  });

  it("fails when version not in allowed list (when list provided)", () => {
    const r = validatePromptVersionOverrides({
      overrides: {
        "bi-report-review": "bi-report-review-v3",
      },
      allowedVersionsByKey: {
        "bi-report-review": ["bi-report-review-v1", "bi-report-review-v2"],
      },
    });
    expect(r.ok).toBe(false);
    expect(r.errors["bi-report-review"]).toContain("not in allowed list");
  });

  it("ok when version is in allowed list", () => {
    const r = validatePromptVersionOverrides({
      overrides: {
        "bi-report-review": "bi-report-review-v1",
      },
      allowedVersionsByKey: {
        "bi-report-review": ["bi-report-review-v1", "bi-report-review-v2"],
      },
    });
    expect(r.ok).toBe(true);
  });
});
