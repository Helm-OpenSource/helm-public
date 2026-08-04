import { describe, expect, it } from "vitest";

import type { CaioNegativeRule } from "@/lib/caio-context-broker/broker-contracts";
import { resolveCrossProjectPolicy } from "@/lib/caio-context-broker/cross-project";

function optOutRule(
  overrides: Partial<CaioNegativeRule> = {},
): CaioNegativeRule {
  return {
    id: `rule:${overrides.ruleKey ?? "no-cross"}:1`,
    workspaceId: "ws-1",
    ruleKey: "no-cross",
    scopeKind: "workspace",
    scopeRef: null,
    ruleKind: "no_cross_project_context",
    pattern: { sourceProject: "unused-by-resolution" },
    version: 1,
    status: "published",
    createdByRef: "user:a",
    publishedByRef: "user:owner",
    createdAt: "2026-07-29T00:00:00.000Z",
    publishedAt: "2026-07-29T00:01:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

describe("resolveCrossProjectPolicy", () => {
  it("allows same-project flows regardless of rules", () => {
    const resolution = resolveCrossProjectPolicy({
      rules: [optOutRule()],
      workspaceId: "ws-1",
      sourceProject: "proj-a",
      targetProject: "proj-a",
    });
    expect(resolution.allowed).toBe(true);
    expect(resolution.blockedByRuleRefs).toEqual([]);
  });

  it("workspace-level rule blocks every cross-project flow", () => {
    const resolution = resolveCrossProjectPolicy({
      rules: [optOutRule({ ruleKey: "ws-isolation", version: 4 })],
      workspaceId: "ws-1",
      sourceProject: "proj-a",
      targetProject: "proj-b",
    });
    expect(resolution.allowed).toBe(false);
    expect(resolution.blockedByRuleRefs).toEqual(["ws-isolation@v4"]);
  });

  it("project-level rule blocks the opted-out project from CONTRIBUTING", () => {
    const rules = [
      optOutRule({
        ruleKey: "isolate-proj-a",
        scopeKind: "project",
        scopeRef: "proj-a",
      }),
    ];
    const resolution = resolveCrossProjectPolicy({
      rules,
      workspaceId: "ws-1",
      sourceProject: "proj-a",
      targetProject: "proj-b",
    });
    expect(resolution.allowed).toBe(false);
    expect(resolution.blockedByRuleRefs).toEqual(["isolate-proj-a@v1"]);
  });

  it("project-level rule blocks the opted-out project from RECEIVING", () => {
    const rules = [
      optOutRule({
        ruleKey: "isolate-proj-a",
        scopeKind: "project",
        scopeRef: "proj-a",
      }),
    ];
    const resolution = resolveCrossProjectPolicy({
      rules,
      workspaceId: "ws-1",
      sourceProject: "proj-c",
      targetProject: "proj-a",
    });
    expect(resolution.allowed).toBe(false);
    expect(resolution.blockedByRuleRefs).toEqual(["isolate-proj-a@v1"]);
  });

  it("does not block flows between two uninvolved projects", () => {
    const rules = [
      optOutRule({
        ruleKey: "isolate-proj-a",
        scopeKind: "project",
        scopeRef: "proj-a",
      }),
    ];
    const resolution = resolveCrossProjectPolicy({
      rules,
      workspaceId: "ws-1",
      sourceProject: "proj-b",
      targetProject: "proj-c",
    });
    expect(resolution.allowed).toBe(true);
  });

  it("ignores draft, revoked, other-kind, and other-workspace rules", () => {
    const resolution = resolveCrossProjectPolicy({
      rules: [
        optOutRule({ status: "draft" }),
        optOutRule({ ruleKey: "revoked", status: "revoked" }),
        optOutRule({ ruleKey: "deny-kind", ruleKind: "deny" }),
        optOutRule({ ruleKey: "other-ws", workspaceId: "ws-2" }),
      ],
      workspaceId: "ws-1",
      sourceProject: "proj-a",
      targetProject: "proj-b",
    });
    expect(resolution.allowed).toBe(true);
  });
});
