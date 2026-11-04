import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseCaioAttentionEnterpriseSuffix,
  parseCaioAttentionRouteConfig,
  parseCaioAttentionRouteRule,
  parseCaioAttentionUserRef,
} from "./contracts";

const rule = {
  detectorId: "detector-a",
  category: "business",
  primaryRoleKey: "primary_role",
  primaryFallbackRoleKeys: ["outcome_role"],
  ccRoleKeys: ["cc_role"],
  escalationRoleKey: "outcome_role",
  escalationFallbackRoleKey: "owner_role",
  reviewerRoleKey: "outcome_role",
  reviewerFallbackRoleKey: "owner_role",
  compatibleRuleVersions: ["v1"],
  committedDue: "suggest",
} as const;

describe("route config schema", () => {
  it("stores canonical bare ids and defaults missing overrides", () => {
    expect(parseCaioAttentionRouteConfig({
      schemaVersion: "caio-attention-routes/v1",
      roleBindings: { primary_role: ["user:u_primary"], cc_role: [] },
    })).toEqual({ ok: true, config: { roleBindings: { primary_role: ["u_primary"], cc_role: [] }, enterpriseOverrides: {} } });
  });

  it.each([
    [{ schemaVersion: "caio-attention-routes/v2", roleBindings: {} }],
    [{ schemaVersion: "caio-attention-routes/v1", roleBindings: { primary_role: ["u_primary"] } }],
    [{ schemaVersion: "caio-attention-routes/v1", roleBindings: { primary_role: ["user:a b"] } }],
    [{ schemaVersion: "caio-attention-routes/v1", roleBindings: { primary_role: ["user:a", "user:a"] } }],
    [{ schemaVersion: "caio-attention-routes/v1", roleBindings: { "Primary Role": ["user:a"] } }],
    [{ schemaVersion: "caio-attention-routes/v1", roleBindings: {}, enterpriseOverrides: { "Bad_Slug": {} } }],
    [{ schemaVersion: "caio-attention-routes/v1", roleBindings: {}, extra: true }],
  ])("rejects %j", (raw) => {
    expect(parseCaioAttentionRouteConfig(raw)).toEqual({ ok: false, errorCode: "route_config_invalid" });
  });

  it("parses user refs strictly", () => {
    expect(parseCaioAttentionUserRef("user:abc_1-2")).toBe("abc_1-2");
    expect(parseCaioAttentionUserRef("abc")).toBeNull();
    expect(parseCaioAttentionUserRef("user:")).toBeNull();
    expect(parseCaioAttentionUserRef(7)).toBeNull();
  });
});

describe("route rule schema", () => {
  it("accepts a rule whose cc roles stay out of the primary and reviewer chains", () => {
    expect(parseCaioAttentionRouteRule(rule).ok).toBe(true);
  });

  it.each([
    [{ ...rule, primaryFallbackRoleKeys: ["cc_role"] }],
    [{ ...rule, reviewerFallbackRoleKey: "cc_role" }],
    [{ ...rule, escalationRoleKey: "cc_role" }],
    [{ ...rule, escalationFallbackRoleKey: "cc_role" }],
    [{ ...rule, compatibleRuleVersions: [] }],
    [{ ...rule, category: "sales" }],
  ])("rejects %j", (raw) => {
    expect(parseCaioAttentionRouteRule(raw)).toEqual({ ok: false, errorCode: "route_rule_invalid" });
  });
});

describe("enterprise suffix", () => {
  it("reads only the trailing suffix", () => {
    expect(parseCaioAttentionEnterpriseSuffix("m:enterprise:aa:enterprise:bb-1")).toEqual({ base: "m:enterprise:aa", slug: "bb-1" });
    expect(parseCaioAttentionEnterpriseSuffix("m:enterprise:Bad")).toBeNull();
    expect(parseCaioAttentionEnterpriseSuffix("plain-key")).toBeNull();
  });
});

describe("module purity", () => {
  it("imports no database, network or runtime-state modules", () => {
    const allowed = new Set(["zod", "@/lib/caio-operating-context/contracts", "@/lib/member-mcp/task-contract"]);
    const dir = path.dirname(new URL(import.meta.url).pathname);
    // The scanner services do IO by design (S6); every other module here stays pure.
    const ioModules = new Set(["reminder-scanner.service.ts"]);
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && !ioModules.has(name))) {
      const specifiers = [...readFileSync(path.join(dir, file), "utf8").matchAll(/from "([^"]+)"/gu)].map((match) => match[1]);
      for (const specifier of specifiers) expect(specifier.startsWith("./") || allowed.has(specifier), `${file}: ${specifier}`).toBe(true);
    }
  });
});
