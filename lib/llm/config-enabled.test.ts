import { beforeEach, describe, expect, it, vi } from "vitest";

const rootEnv = vi.hoisted(() => ({
  read: vi.fn(() => ""),
}));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/root-env", () => ({
  readEnvVarFromRootFiles: rootEnv.read,
}));

import { isLLMEnabledByEnv } from "@/lib/llm/config";

describe("LLM_ENABLED strict deployment parsing", () => {
  beforeEach(() => {
    delete process.env.LLM_ENABLED;
    rootEnv.read.mockReset();
    rootEnv.read.mockReturnValue("");
  });

  it("preserves the legacy enabled default when the key is absent", () => {
    expect(isLLMEnabledByEnv()).toBe(true);
  });

  it("accepts only strict true and false values", () => {
    process.env.LLM_ENABLED = " TRUE ";
    expect(isLLMEnabledByEnv()).toBe(true);

    process.env.LLM_ENABLED = "false";
    expect(isLLMEnabledByEnv()).toBe(false);
  });

  it("fails closed for malformed values", () => {
    process.env.LLM_ENABLED = "yes";
    expect(isLLMEnabledByEnv()).toBe(false);
  });

  it("preserves the existing root environment fallback", () => {
    rootEnv.read.mockImplementation((name) =>
      name === "LLM_ENABLED" ? "false" : "",
    );

    expect(isLLMEnabledByEnv()).toBe(false);
  });
});
