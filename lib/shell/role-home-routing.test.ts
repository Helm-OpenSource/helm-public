import { describe, expect, it } from "vitest";

import { ROLE_PRESET_KEYS } from "@/lib/definitions/role-presets";
import { resolveRoleLens } from "./role-home";
import {
  buildCoreDefaultRoleHomeRouting,
  resolveRoleHomeDestinationFromCandidates,
  resolveRoleHomeDestination,
  validateRoleHomeRoutingTable,
  type RoleHomeRoutingTable,
} from "./role-home-routing";

function table(overrides: Partial<RoleHomeRoutingTable> = {}): RoleHomeRoutingTable {
  return {
    routes: [{ roleCategory: "FOUNDER_CEO", destination: { kind: "control_tower" } }],
    fallback: { kind: "generic" },
    ...overrides,
  };
}

const has = (t: RoleHomeRoutingTable, issue: string) =>
  validateRoleHomeRoutingTable(t).some((i) => i.issue === issue);

describe("validateRoleHomeRoutingTable", () => {
  it("passes a well-formed table (control_tower / workstation routes, generic fallback)", () => {
    expect(
      validateRoleHomeRoutingTable(
        table({
          routes: [
            { roleCategory: "FOUNDER_CEO", destination: { kind: "control_tower" } },
            { roleCategory: "COLLECTOR", destination: { kind: "workstation", workstationKey: "collection" } },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("requires the fallback to be generic (fail-safe direction)", () => {
    expect(has(table({ fallback: { kind: "control_tower" } }), "fallback_not_generic")).toBe(true);
    expect(has(table({ fallback: { kind: "workstation", workstationKey: "x" } }), "fallback_not_generic")).toBe(true);
    expect(has(table({ fallback: null as never }), "fallback_missing")).toBe(true);
  });

  it("rejects unknown destination kind and empty workstation key", () => {
    expect(has(table({ routes: [{ roleCategory: "R", destination: { kind: "elsewhere" } as never }] }), "destination_unknown_kind")).toBe(true);
    expect(
      has(table({ routes: [{ roleCategory: "R", destination: { kind: "workstation", workstationKey: " " } }] }), "destination_empty_workstation_key"),
    ).toBe(true);
  });

  it("rejects empty and duplicate roleCategory", () => {
    expect(has(table({ routes: [{ roleCategory: "", destination: { kind: "control_tower" } }] }), "empty_role_category")).toBe(true);
    expect(
      has(
        table({
          routes: [
            { roleCategory: "dup", destination: { kind: "control_tower" } },
            { roleCategory: "dup", destination: { kind: "generic" } },
          ],
        }),
        "duplicate_role_category",
      ),
    ).toBe(true);
  });
});

describe("resolveRoleHomeDestination", () => {
  const t = table({
    routes: [
      { roleCategory: "FOUNDER_CEO", destination: { kind: "control_tower" } },
      { roleCategory: "COLLECTOR", destination: { kind: "workstation", workstationKey: "collection" } },
    ],
  });

  it("returns the routed destination on a hit", () => {
    expect(resolveRoleHomeDestination(t, "FOUNDER_CEO")).toEqual({ kind: "control_tower" });
    expect(resolveRoleHomeDestination(t, "COLLECTOR")).toEqual({ kind: "workstation", workstationKey: "collection" });
  });

  it("falls back to generic on a miss / null / empty", () => {
    expect(resolveRoleHomeDestination(t, "UNKNOWN")).toEqual({ kind: "generic" });
    expect(resolveRoleHomeDestination(t, null)).toEqual({ kind: "generic" });
    expect(resolveRoleHomeDestination(t, "  ")).toEqual({ kind: "generic" });
  });
});

describe("resolveRoleHomeDestinationFromCandidates", () => {
  const t = table({
    routes: [
      { roleCategory: "FOUNDER_CEO", destination: { kind: "control_tower" } },
      { roleCategory: "ADMIN", destination: { kind: "control_tower" } },
      { roleCategory: "OPERATOR", destination: { kind: "workstation", workstationKey: "collection" } },
    ],
  });

  it("tries candidate categories in order before falling back", () => {
    expect(resolveRoleHomeDestinationFromCandidates(t, [null, "ADMIN"])).toEqual({ kind: "control_tower" });
    expect(resolveRoleHomeDestinationFromCandidates(t, ["UNKNOWN", "OPERATOR"])).toEqual({
      kind: "workstation",
      workstationKey: "collection",
    });
  });

  it("keeps the table fallback when no candidate is routed", () => {
    expect(resolveRoleHomeDestinationFromCandidates(t, [null, "UNKNOWN", " "])).toEqual({ kind: "generic" });
  });
});

describe("buildCoreDefaultRoleHomeRouting", () => {
  it("is conformant, covers every preset, and derives destinations from resolveRoleLens", () => {
    const core = buildCoreDefaultRoleHomeRouting();
    expect(validateRoleHomeRoutingTable(core)).toEqual([]);
    expect(core.fallback).toEqual({ kind: "generic" });
    expect(core.routes.map((r) => r.roleCategory).sort()).toEqual([...ROLE_PRESET_KEYS].sort());
    for (const route of core.routes) {
      const expected = resolveRoleLens(route.roleCategory) === "generic" ? "generic" : "control_tower";
      expect(route.destination.kind).toBe(expected);
    }
  });
});
