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
  // IO boundary (database access): every `*.service.ts` plus the explicitly listed shared plumbing. Everything else,
  // in every subdirectory, stays pure. A listed exemption that no longer exists fails, so the list cannot go stale.
  // reminder-cron.ts is the S6 timer entry: it loads the database client and the scan services lazily (dynamic import).
  const IO_EXEMPT = ["lifecycle/core.ts", "lifecycle/case-loader.ts", "reminder-cron.ts"];
  const root = path.dirname(new URL(import.meta.url).pathname);
  const walk = (dir: string): string[] => readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(relative) : [relative];
  });

  it("imports no database, network or runtime-state modules", () => {
    const allowed = new Set([
      "zod", "@/lib/caio-operating-context/contracts", "@/lib/caio-operating-context/detector-runner", "@/lib/member-mcp/task-contract",
    ]);
    const files = walk("").filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
    for (const exempt of IO_EXEMPT) expect(files, exempt).toContain(exempt);
    expect(files.some((name) => name.includes("/")), "subdirectories are scanned").toBe(true);
    for (const file of files.filter((name) => !name.endsWith(".service.ts") && !IO_EXEMPT.includes(name))) {
      // `from "x"`, side-effect `import "x"` and dynamic `import("x")` all count.
      const specifiers = [...readFileSync(path.join(root, file), "utf8").matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/gu)].map((match) => match[1]);
      for (const specifier of specifiers) expect(specifier.startsWith(".") || allowed.has(specifier), `${file}: ${specifier}`).toBe(true);
    }
  });
});
