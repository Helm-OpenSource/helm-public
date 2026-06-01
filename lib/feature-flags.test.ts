import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isBusinessAdvancementRuntimeEnabledForWorkspace,
  isOperatingSignalFlowRuntimeShadowEnabledForWorkspace,
  readBusinessAdvancementRuntimeFlagSnapshot,
  readOperatingSignalFlowRuntimeShadowFlagSnapshot,
} from "@/lib/feature-flags";

const ORIGINAL_ENV = { ...process.env };

describe("feature-flags / business advancement runtime", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED;
    delete process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST;
    delete process.env.OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED;
    delete process.env.OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to disabled when neither env var is set", () => {
    expect(isBusinessAdvancementRuntimeEnabledForWorkspace("ws-1")).toBe(false);
    expect(readBusinessAdvancementRuntimeFlagSnapshot()).toEqual({
      flagEnabled: false,
      allowlist: [],
    });
  });

  it("stays disabled when flag is on but allowlist is empty", () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = "true";
    expect(isBusinessAdvancementRuntimeEnabledForWorkspace("ws-1")).toBe(false);
  });

  it("stays disabled when allowlist is set but flag is off", () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-1, ws-2";
    expect(isBusinessAdvancementRuntimeEnabledForWorkspace("ws-1")).toBe(false);
  });

  it("enables only listed workspaces when flag is on AND workspace is in allowlist", () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = "true";
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-1, ws-2";
    expect(isBusinessAdvancementRuntimeEnabledForWorkspace("ws-1")).toBe(true);
    expect(isBusinessAdvancementRuntimeEnabledForWorkspace("ws-2")).toBe(true);
    expect(isBusinessAdvancementRuntimeEnabledForWorkspace("ws-other")).toBe(false);
  });

  it("treats the standard truthy env strings as enabled", () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-1";
    for (const truthy of ["true", "1", "yes", "on", "TRUE", "On"]) {
      process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = truthy;
      expect(isBusinessAdvancementRuntimeEnabledForWorkspace("ws-1")).toBe(true);
    }
  });

  it("treats anything else as disabled (no leniency for typos)", () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-1";
    for (const falsy of ["", "false", "0", "no", "off", "enabled", " true ", "any"]) {
      process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = falsy;
      const expected = falsy.trim().toLowerCase() === "true";
      expect(isBusinessAdvancementRuntimeEnabledForWorkspace("ws-1")).toBe(expected);
    }
  });
});

describe("feature-flags / operating signal flow runtime shadow", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED;
    delete process.env.OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to disabled when neither env var is set", () => {
    expect(isOperatingSignalFlowRuntimeShadowEnabledForWorkspace("ws-1")).toBe(false);
    expect(readOperatingSignalFlowRuntimeShadowFlagSnapshot()).toEqual({
      flagEnabled: false,
      allowlist: [],
    });
  });

  it("stays disabled when flag is on but the workspace is not allowlisted", () => {
    process.env.OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED = "true";
    process.env.OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST = "ws-other";
    expect(isOperatingSignalFlowRuntimeShadowEnabledForWorkspace("ws-1")).toBe(false);
  });

  it("enables only listed workspaces when the shadow flag is explicitly on", () => {
    process.env.OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED = "true";
    process.env.OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST = "ws-1, ws-2";
    expect(isOperatingSignalFlowRuntimeShadowEnabledForWorkspace("ws-1")).toBe(true);
    expect(isOperatingSignalFlowRuntimeShadowEnabledForWorkspace("ws-2")).toBe(true);
    expect(isOperatingSignalFlowRuntimeShadowEnabledForWorkspace("ws-other")).toBe(false);
  });
});
