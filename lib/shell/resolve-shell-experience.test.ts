import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetPackRegistryForTest,
  registerPackContributions,
} from "@/lib/extensions/registry-contract";
import type { MainlineProviderContribution } from "@/lib/extensions/registry-types";

import {
  buildCoreDefaultMainline,
  type CoreDefaultMainlineInput,
  type MainlineReadout,
} from "./operating-mainline";
import {
  resolveShellMainline,
  SHELL_MAINLINE_CONTRACT_VERSION,
  SHELL_MAINLINE_SURFACE_KEY,
} from "./resolve-shell-experience";

const workspace = { id: "ws-shell", slug: "shell", systemKey: null, workspaceClass: null };

const coreDefault: CoreDefaultMainlineInput = {
  asOf: "2026-07-12T00:00:00.000Z",
  english: true,
  counts: { judgementPending: 3, reviewQueue: 2, advanceInFlight: null },
};

/** A conformance-passing readout that is distinguishable from the Core default. */
function providerReadout(): MainlineReadout {
  const base = buildCoreDefaultMainline(coreDefault);
  return {
    ...base,
    nodes: base.nodes.map((n) => ({ ...n, basisRef: `provider-mainline:${n.key}` })),
  };
}

function makeProvider(
  overrides: Partial<MainlineProviderContribution> = {},
  buildImpl?: MainlineProviderContribution["buildMainline"],
): MainlineProviderContribution {
  return {
    providerId: "example-provider",
    contractVersion: SHELL_MAINLINE_CONTRACT_VERSION,
    priority: 10,
    provenance: "test",
    stability: "experimental",
    getAccess: vi.fn(async () => ({ ok: true })),
    buildMainline: buildImpl ?? vi.fn(async () => providerReadout()),
    ...overrides,
  };
}

const bind = (providerId: string) => ({
  surfaceKey: SHELL_MAINLINE_SURFACE_KEY,
  providerId,
});

beforeEach(() => __resetPackRegistryForTest());
afterEach(() => __resetPackRegistryForTest());

describe("resolveShellMainline — binding-is-authorization (blueprint §4.3/§4.4)", () => {
  it("empty store + null binding is byte-identical to buildCoreDefaultMainline (mirror parity)", async () => {
    const res = await resolveShellMainline({ workspace, english: true, coreDefault, binding: null });

    expect(res.selection.winner).toBe("core_default");
    expect(res.selection.source).toBe("core_default");
    expect(res.selection.conflictReceipt).toBeNull();
    expect(res.droppedProviderId).toBeNull();
    expect(JSON.stringify(res.readout)).toBe(
      JSON.stringify(buildCoreDefaultMainline(coreDefault)),
    );
  });

  it("registered provider WITHOUT a binding stays on Core default (binding-is-authorization)", async () => {
    const provider = makeProvider();
    registerPackContributions("pack-a", { mainlineProviders: [provider] });

    const res = await resolveShellMainline({ workspace, english: true, coreDefault, binding: null });

    expect(res.selection.winner).toBe("core_default");
    expect(res.selection.recommendations).toEqual(["example-provider"]); // eligible → recommended, but never auto-takes-over
    expect(res.droppedProviderId).toBeNull();
    expect(provider.buildMainline).not.toHaveBeenCalled();
    expect(res.readout.nodes[0].basisRef).toBe("core-default-mainline:signal");
  });

  it("valid binding + eligible provider + conformant readout ⇒ provider wins", async () => {
    const provider = makeProvider();
    registerPackContributions("pack-a", { mainlineProviders: [provider] });

    const res = await resolveShellMainline({
      workspace,
      english: true,
      coreDefault,
      binding: bind("example-provider"),
    });

    expect(res.selection.winner).toEqual({ providerId: "example-provider" });
    expect(res.selection.source).toBe("binding");
    expect(res.droppedProviderId).toBeNull();
    expect(res.readout.nodes[0].basisRef).toBe("provider-mainline:signal");
    expect(provider.getAccess).toHaveBeenCalledTimes(1);
    expect(provider.buildMainline).toHaveBeenCalledTimes(1);
  });

  it("bound provider whose access probe fails ⇒ Core default + not_eligible, build never called", async () => {
    const provider = makeProvider({ getAccess: vi.fn(async () => ({ ok: false })) });
    registerPackContributions("pack-a", { mainlineProviders: [provider] });

    const res = await resolveShellMainline({
      workspace,
      english: true,
      coreDefault,
      binding: bind("example-provider"),
    });

    expect(res.selection.winner).toBe("core_default");
    expect(res.selection.conflictReceipt?.reason).toBe("binding_provider_not_eligible");
    expect(provider.buildMainline).not.toHaveBeenCalled();
    expect(res.readout.nodes[0].basisRef).toBe("core-default-mainline:signal");
  });

  it("bound provider whose access probe THROWS ⇒ treated as not eligible ⇒ Core default", async () => {
    const provider = makeProvider({
      getAccess: vi.fn(async () => {
        throw new Error("probe boom");
      }),
    });
    registerPackContributions("pack-a", { mainlineProviders: [provider] });

    const res = await resolveShellMainline({
      workspace,
      english: true,
      coreDefault,
      binding: bind("example-provider"),
    });

    expect(res.selection.winner).toBe("core_default");
    expect(res.selection.conflictReceipt?.reason).toBe("binding_provider_not_eligible");
    expect(provider.buildMainline).not.toHaveBeenCalled();
  });

  it("bound provider on an incompatible contractVersion ⇒ Core default (not eligible)", async () => {
    const provider = makeProvider({ contractVersion: "mainline.v0-legacy" });
    registerPackContributions("pack-a", { mainlineProviders: [provider] });

    const res = await resolveShellMainline({
      workspace,
      english: true,
      coreDefault,
      binding: bind("example-provider"),
    });

    expect(res.selection.winner).toBe("core_default");
    expect(res.selection.conflictReceipt?.reason).toBe("binding_provider_not_eligible");
    expect(provider.buildMainline).not.toHaveBeenCalled();
  });

  it("binding for a different surfaceKey ⇒ Core default + binding_surface_mismatch", async () => {
    const provider = makeProvider();
    registerPackContributions("pack-a", { mainlineProviders: [provider] });

    const res = await resolveShellMainline({
      workspace,
      english: true,
      coreDefault,
      binding: { surfaceKey: "attention", providerId: "example-provider" },
    });

    expect(res.selection.winner).toBe("core_default");
    expect(res.selection.conflictReceipt?.reason).toBe("binding_surface_mismatch");
    expect(provider.buildMainline).not.toHaveBeenCalled();
  });

  it("bound provider wins but returns a NON-conformant readout ⇒ fail-open to Core default + droppedProviderId", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // callback field on a node is an iron-law violation caught by validateMainlineReadout
      const badReadout = (): MainlineReadout => {
        const base = providerReadout();
        const [first, ...rest] = base.nodes;
        return {
          ...base,
          nodes: [{ ...first, onClick: () => {} } as never, ...rest],
        };
      };
      const provider = makeProvider({}, vi.fn(badReadout));
      registerPackContributions("pack-a", { mainlineProviders: [provider] });

      const res = await resolveShellMainline({
        workspace,
        english: true,
        coreDefault,
        binding: bind("example-provider"),
      });

      expect(res.droppedProviderId).toBe("example-provider");
      expect(res.readout.nodes[0].basisRef).toBe("core-default-mainline:signal");
      expect(provider.buildMainline).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("bound provider wins but buildMainline THROWS ⇒ fail-open to Core default + droppedProviderId", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const provider = makeProvider(
        {},
        vi.fn(async () => {
          throw new Error("build boom");
        }),
      );
      registerPackContributions("pack-a", { mainlineProviders: [provider] });

      const res = await resolveShellMainline({
        workspace,
        english: true,
        coreDefault,
        binding: bind("example-provider"),
      });

      expect(res.droppedProviderId).toBe("example-provider");
      expect(res.readout.nodes[0].basisRef).toBe("core-default-mainline:signal");
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("binding to an unknown providerId ⇒ Core default + binding_provider_not_found", async () => {
    registerPackContributions("pack-a", { mainlineProviders: [makeProvider()] });

    const res = await resolveShellMainline({
      workspace,
      english: true,
      coreDefault,
      binding: bind("does-not-exist"),
    });

    expect(res.selection.winner).toBe("core_default");
    expect(res.selection.conflictReceipt?.reason).toBe("binding_provider_not_found");
  });
});

// ---------------------------------------------------------------------------
// Concat surfaces — northstar KPIs + attention feed (§4.2 / §4.4)
// ---------------------------------------------------------------------------

import {
  resolveShellNorthstarKpis,
  resolveShellAttention,
  SHELL_ATTENTION_CONTRACT_VERSION,
  SHELL_NORTHSTAR_KPI_CONTRACT_VERSION,
  SHELL_SURFACE_MAX_SOURCES,
  SHELL_SURFACE_SOURCE_TIMEOUT_MS,
} from "./resolve-shell-experience";
import type {
  AttentionSourceContribution,
  NorthstarKpiSourceContribution,
} from "@/lib/extensions/registry-types";
import type { NorthstarKpi } from "./northstar-kpi";
import type { AttentionItem } from "./attention-feed";

function aKpi(overrides: Partial<NorthstarKpi> = {}): NorthstarKpi {
  return {
    key: "recovery_rate",
    label: "回收率",
    status: "measured",
    unit: "percent",
    value: 42,
    bandLabel: null,
    direction: "up_good",
    href: "/operating",
    basisRef: "provider:recovery_rate",
    ...overrides,
  };
}

function kpiSource(
  overrides: Partial<NorthstarKpiSourceContribution> = {},
): NorthstarKpiSourceContribution {
  return {
    providerId: "kpi-a",
    contractVersion: SHELL_NORTHSTAR_KPI_CONTRACT_VERSION,
    provenance: "test",
    stability: "experimental",
    getAccess: vi.fn(async () => ({ ok: true })),
    buildKpis: vi.fn(async () => [aKpi()]),
    ...overrides,
  };
}

function anItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    key: "case-42",
    severity: "warning",
    label: "案件 #42 待跟进",
    roleCategory: "operator",
    href: "/approvals",
    basisRef: "provider:case-42",
    ...overrides,
  };
}

function attentionSource(
  overrides: Partial<AttentionSourceContribution> = {},
): AttentionSourceContribution {
  return {
    providerId: "att-a",
    contractVersion: SHELL_ATTENTION_CONTRACT_VERSION,
    provenance: "test",
    stability: "experimental",
    getAccess: vi.fn(async () => ({ ok: true })),
    buildAttention: vi.fn(async () => [anItem()]),
    ...overrides,
  };
}

describe("resolveShellNorthstarKpis — concat aggregation (§4.2/§4.4)", () => {
  it("empty store ⇒ Core default (empty) — mirror parity", async () => {
    const res = await resolveShellNorthstarKpis({ workspace, english: true });
    expect(res.kpis).toEqual([]);
    expect(res.unreturnedProviderIds).toEqual([]);
    expect(res.droppedForCap).toBe(0);
  });

  it("merges KPIs from multiple eligible sources (concat)", async () => {
    registerPackContributions("p", {
      northstarKpiSources: [
        kpiSource({ providerId: "kpi-a", buildKpis: vi.fn(async () => [aKpi({ key: "a" })]) }),
        kpiSource({ providerId: "kpi-b", buildKpis: vi.fn(async () => [aKpi({ key: "b" })]) }),
      ],
    });
    const res = await resolveShellNorthstarKpis({ workspace, english: true });
    expect(res.kpis.map((k) => k.key).sort()).toEqual(["a", "b"]);
  });

  it("silently skips access-denied sources (not yours ≠ unavailable)", async () => {
    const denied = kpiSource({ providerId: "kpi-denied", getAccess: vi.fn(async () => ({ ok: false })) });
    registerPackContributions("p", { northstarKpiSources: [denied] });
    const res = await resolveShellNorthstarKpis({ workspace, english: true });
    expect(res.kpis).toEqual([]);
    expect(res.unreturnedProviderIds).toEqual([]);
    expect(denied.buildKpis).not.toHaveBeenCalled();
  });

  it("excludes version-incompatible sources up front", async () => {
    const legacy = kpiSource({ providerId: "kpi-legacy", contractVersion: "northstar-kpi.v0" });
    registerPackContributions("p", { northstarKpiSources: [legacy] });
    const res = await resolveShellNorthstarKpis({ workspace, english: true });
    expect(res.kpis).toEqual([]);
    expect(legacy.getAccess).not.toHaveBeenCalled();
  });

  it("a source whose build throws is dropped and recorded as unreturned", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      registerPackContributions("p", {
        northstarKpiSources: [
          kpiSource({ providerId: "kpi-good", buildKpis: vi.fn(async () => [aKpi({ key: "good" })]) }),
          kpiSource({
            providerId: "kpi-bad",
            buildKpis: vi.fn(async () => {
              throw new Error("build boom");
            }),
          }),
        ],
      });
      const res = await resolveShellNorthstarKpis({ workspace, english: true });
      expect(res.kpis.map((k) => k.key)).toEqual(["good"]);
      expect(res.unreturnedProviderIds).toEqual(["kpi-bad"]);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("drops only the non-conformant item, keeps the rest, records the provider", async () => {
    registerPackContributions("p", {
      northstarKpiSources: [
        kpiSource({
          providerId: "kpi-mixed",
          buildKpis: vi.fn(async () => [
            aKpi({ key: "ok" }),
            aKpi({ key: "bad", unit: "currency_band", value: 999, bandLabel: "¥1k" }), // raw value on currency_band
          ]),
        }),
      ],
    });
    const res = await resolveShellNorthstarKpis({ workspace, english: true });
    expect(res.kpis.map((k) => k.key)).toEqual(["ok"]);
    expect(res.nonConformantProviderIds).toEqual(["kpi-mixed"]);
  });

  it("dedupes by KPI key across sources (first writer wins)", async () => {
    registerPackContributions("p", {
      northstarKpiSources: [
        kpiSource({ providerId: "kpi-a", buildKpis: vi.fn(async () => [aKpi({ key: "dup", value: 1 })]) }),
        kpiSource({ providerId: "kpi-b", buildKpis: vi.fn(async () => [aKpi({ key: "dup", value: 2 })]) }),
      ],
    });
    const res = await resolveShellNorthstarKpis({ workspace, english: true });
    expect(res.kpis).toHaveLength(1);
    expect(res.kpis[0].value).toBe(1);
  });

  it("caps fan-out at SHELL_SURFACE_MAX_SOURCES and reports the drop", async () => {
    const many = Array.from({ length: SHELL_SURFACE_MAX_SOURCES + 3 }, (_, i) =>
      kpiSource({ providerId: `kpi-${i}`, buildKpis: vi.fn(async () => [aKpi({ key: `k${i}` })]) }),
    );
    registerPackContributions("p", { northstarKpiSources: many });
    const res = await resolveShellNorthstarKpis({ workspace, english: true });
    expect(res.droppedForCap).toBe(3);
    expect(res.kpis).toHaveLength(SHELL_SURFACE_MAX_SOURCES);
  });

  it("a source that never returns is dropped at the per-source timeout", async () => {
    vi.useFakeTimers();
    try {
      registerPackContributions("p", {
        northstarKpiSources: [
          kpiSource({ providerId: "kpi-hang", buildKpis: vi.fn(() => new Promise<never[]>(() => {})) }),
        ],
      });
      const pending = resolveShellNorthstarKpis({ workspace, english: true });
      await vi.advanceTimersByTimeAsync(SHELL_SURFACE_SOURCE_TIMEOUT_MS + 50);
      const res = await pending;
      expect(res.kpis).toEqual([]);
      expect(res.unreturnedProviderIds).toEqual(["kpi-hang"]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("resolveShellAttention — concat aggregation with unreturned items (§4.4)", () => {
  it("empty store ⇒ Core default (empty) — mirror parity", async () => {
    const res = await resolveShellAttention({ workspace, english: true });
    expect(res.items).toEqual([]);
    expect(res.unreturnedProviderIds).toEqual([]);
  });

  it("merges items from multiple sources; same item.key across providers is kept (namespaced dedupe)", async () => {
    registerPackContributions("p", {
      attentionSources: [
        attentionSource({ providerId: "att-a", buildAttention: vi.fn(async () => [anItem({ key: "shared" })]) }),
        attentionSource({ providerId: "att-b", buildAttention: vi.fn(async () => [anItem({ key: "shared" })]) }),
      ],
    });
    const res = await resolveShellAttention({ workspace, english: true });
    expect(res.items).toHaveLength(2); // both kept: providerId::key differs
  });

  it("renders an 'unreturned source' item when a source build throws (§4.4 — never silent)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      registerPackContributions("p", {
        attentionSources: [
          attentionSource({ providerId: "att-ok", buildAttention: vi.fn(async () => [anItem({ key: "ok" })]) }),
          attentionSource({
            providerId: "att-bad",
            buildAttention: vi.fn(async () => {
              throw new Error("att boom");
            }),
          }),
        ],
      });
      const res = await resolveShellAttention({ workspace, english: true });
      expect(res.unreturnedProviderIds).toEqual(["att-bad"]);
      const unreturned = res.items.find((i) => i.key.startsWith("unreturned:att-bad"));
      expect(unreturned).toBeDefined();
      expect(unreturned?.severity).toBe("info");
      expect(res.items.some((i) => i.key === "ok")).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("drops only the suspected-PII item (fail-closed), keeps the rest", async () => {
    registerPackContributions("p", {
      attentionSources: [
        attentionSource({
          providerId: "att-mixed",
          buildAttention: vi.fn(async () => [
            anItem({ key: "clean" }),
            anItem({ key: "leaky", label: "客户 13800138000" }),
          ]),
        }),
      ],
    });
    const res = await resolveShellAttention({ workspace, english: true });
    expect(res.items.map((i) => i.key)).toEqual(["clean"]);
    expect(res.nonConformantProviderIds).toEqual(["att-mixed"]);
  });

  it("silently skips access-denied attention sources", async () => {
    const denied = attentionSource({ providerId: "att-denied", getAccess: vi.fn(async () => ({ ok: false })) });
    registerPackContributions("p", { attentionSources: [denied] });
    const res = await resolveShellAttention({ workspace, english: true });
    expect(res.items).toEqual([]);
    expect(denied.buildAttention).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Concat surface — operation suggestions (Phase 4)
// ---------------------------------------------------------------------------

import {
  resolveShellOperationSuggestions,
  SHELL_OPERATION_SUGGESTION_CONTRACT_VERSION,
} from "./resolve-shell-experience";
import type { OperationSuggestionSourceContribution } from "@/lib/extensions/registry-types";
import type { OperationSuggestion } from "./operation-suggestion";

function aSuggestion(overrides: Partial<OperationSuggestion> = {}): OperationSuggestion {
  return {
    key: "init-focus-areas",
    category: "initialization",
    title: "设置工作区关注领域",
    rationale: "冷启动需先声明关注领域",
    readiness: "ready",
    preconditionRefs: [],
    agentBrief: "在 /settings 配置 focusAreas",
    verificationRef: "/settings",
    href: "/settings",
    basisRef: "provider:init-focus-areas",
    ...overrides,
  };
}

function opSuggestionSource(
  overrides: Partial<OperationSuggestionSourceContribution> = {},
): OperationSuggestionSourceContribution {
  return {
    providerId: "ops-a",
    contractVersion: SHELL_OPERATION_SUGGESTION_CONTRACT_VERSION,
    provenance: "test",
    stability: "experimental",
    getAccess: vi.fn(async () => ({ ok: true })),
    buildOperationSuggestions: vi.fn(async () => [aSuggestion()]),
    ...overrides,
  };
}

describe("resolveShellOperationSuggestions — concat aggregation (Phase 4)", () => {
  it("empty store ⇒ Core default (empty) — mirror parity", async () => {
    const res = await resolveShellOperationSuggestions({ workspace, english: true });
    expect(res.suggestions).toEqual([]);
    expect(res.unreturnedProviderIds).toEqual([]);
    expect(res.droppedForCap).toBe(0);
  });

  it("merges suggestions from multiple eligible sources (concat)", async () => {
    registerPackContributions("p", {
      operationSuggestionSources: [
        opSuggestionSource({ providerId: "ops-a", buildOperationSuggestions: vi.fn(async () => [aSuggestion({ key: "a" })]) }),
        opSuggestionSource({ providerId: "ops-b", buildOperationSuggestions: vi.fn(async () => [aSuggestion({ key: "b" })]) }),
      ],
    });
    const res = await resolveShellOperationSuggestions({ workspace, english: true });
    expect(res.suggestions.map((s) => s.key).sort()).toEqual(["a", "b"]);
  });

  it("silently skips access-denied sources", async () => {
    const denied = opSuggestionSource({ providerId: "ops-denied", getAccess: vi.fn(async () => ({ ok: false })) });
    registerPackContributions("p", { operationSuggestionSources: [denied] });
    const res = await resolveShellOperationSuggestions({ workspace, english: true });
    expect(res.suggestions).toEqual([]);
    expect(denied.buildOperationSuggestions).not.toHaveBeenCalled();
  });

  it("excludes version-incompatible sources up front", async () => {
    const legacy = opSuggestionSource({ providerId: "ops-legacy", contractVersion: "operation-suggestion.v0" });
    registerPackContributions("p", { operationSuggestionSources: [legacy] });
    const res = await resolveShellOperationSuggestions({ workspace, english: true });
    expect(res.suggestions).toEqual([]);
    expect(legacy.getAccess).not.toHaveBeenCalled();
  });

  it("a source whose build throws is dropped and recorded as unreturned", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      registerPackContributions("p", {
        operationSuggestionSources: [
          opSuggestionSource({ providerId: "ops-good", buildOperationSuggestions: vi.fn(async () => [aSuggestion({ key: "good" })]) }),
          opSuggestionSource({
            providerId: "ops-bad",
            buildOperationSuggestions: vi.fn(async () => {
              throw new Error("boom");
            }),
          }),
        ],
      });
      const res = await resolveShellOperationSuggestions({ workspace, english: true });
      expect(res.suggestions.map((s) => s.key)).toEqual(["good"]);
      expect(res.unreturnedProviderIds).toEqual(["ops-bad"]);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("drops only the suspected-secret item (fail-closed), keeps the rest", async () => {
    registerPackContributions("p", {
      operationSuggestionSources: [
        opSuggestionSource({
          providerId: "ops-mixed",
          buildOperationSuggestions: vi.fn(async () => [
            aSuggestion({ key: "clean" }),
            aSuggestion({ key: "leaky", agentBrief: `run with ${"token"}=${`sk-${"ABCDEF0123456789abcdef"}`}` }),
          ]),
        }),
      ],
    });
    const res = await resolveShellOperationSuggestions({ workspace, english: true });
    expect(res.suggestions.map((s) => s.key)).toEqual(["clean"]);
    expect(res.nonConformantProviderIds).toEqual(["ops-mixed"]);
  });

  it("dedupes by suggestion key across sources (first writer wins)", async () => {
    registerPackContributions("p", {
      operationSuggestionSources: [
        opSuggestionSource({ providerId: "ops-a", buildOperationSuggestions: vi.fn(async () => [aSuggestion({ key: "dup", title: "first" })]) }),
        opSuggestionSource({ providerId: "ops-b", buildOperationSuggestions: vi.fn(async () => [aSuggestion({ key: "dup", title: "second" })]) }),
      ],
    });
    const res = await resolveShellOperationSuggestions({ workspace, english: true });
    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0].title).toBe("first");
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — role-home routing (single-winner) + workstations (concat)
// ---------------------------------------------------------------------------

import {
  resolveShellRoleHomeRouting,
  resolveShellWorkstations,
  SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION,
  SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
  SHELL_WORKSTATION_CONTRACT_VERSION,
} from "./resolve-shell-experience";
import type {
  RoleHomeRoutingProviderContribution,
  WorkstationSourceContribution,
} from "@/lib/extensions/registry-types";
import { buildCoreDefaultRoleHomeRouting, type RoleHomeRoutingTable } from "./role-home-routing";
import type { WorkstationDescriptor } from "./workstation";

function providerTable(overrides: Partial<RoleHomeRoutingTable> = {}): RoleHomeRoutingTable {
  return {
    routes: [{ roleCategory: "COLLECTOR", destination: { kind: "workstation", workstationKey: "collection" } }],
    fallback: { kind: "generic" },
    ...overrides,
  };
}

function roleHomeProvider(
  overrides: Partial<RoleHomeRoutingProviderContribution> = {},
  buildImpl?: RoleHomeRoutingProviderContribution["buildRoleHomeRouting"],
): RoleHomeRoutingProviderContribution {
  return {
    providerId: "example-provider",
    contractVersion: SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION,
    priority: 10,
    provenance: "test",
    stability: "experimental",
    getAccess: vi.fn(async () => ({ ok: true })),
    buildRoleHomeRouting: buildImpl ?? vi.fn(async () => providerTable()),
    ...overrides,
  };
}

const rhBind = (providerId: string) => ({
  surfaceKey: SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
  providerId,
});

describe("resolveShellRoleHomeRouting — single-winner (Phase 3)", () => {
  it("empty store + null binding ⇒ Core default routing (parity)", async () => {
    const res = await resolveShellRoleHomeRouting({ workspace, english: true, binding: null });
    expect(res.selection.winner).toBe("core_default");
    expect(res.droppedProviderId).toBeNull();
    expect(JSON.stringify(res.table)).toBe(JSON.stringify(buildCoreDefaultRoleHomeRouting()));
  });

  it("registered provider WITHOUT a binding stays on Core default", async () => {
    const provider = roleHomeProvider();
    registerPackContributions("p", { roleHomeRoutingProviders: [provider] });
    const res = await resolveShellRoleHomeRouting({ workspace, english: true, binding: null });
    expect(res.selection.winner).toBe("core_default");
    expect(provider.buildRoleHomeRouting).not.toHaveBeenCalled();
  });

  it("valid binding + eligible + conformant ⇒ provider table wins", async () => {
    const provider = roleHomeProvider();
    registerPackContributions("p", { roleHomeRoutingProviders: [provider] });
    const res = await resolveShellRoleHomeRouting({ workspace, english: true, binding: rhBind("example-provider") });
    expect(res.selection.winner).toEqual({ providerId: "example-provider" });
    expect(res.table.routes[0].destination).toEqual({ kind: "workstation", workstationKey: "collection" });
    expect(res.droppedProviderId).toBeNull();
  });

  it("bound provider with failing access ⇒ Core default, build not called", async () => {
    const provider = roleHomeProvider({ getAccess: vi.fn(async () => ({ ok: false })) });
    registerPackContributions("p", { roleHomeRoutingProviders: [provider] });
    const res = await resolveShellRoleHomeRouting({ workspace, english: true, binding: rhBind("example-provider") });
    expect(res.selection.winner).toBe("core_default");
    expect(provider.buildRoleHomeRouting).not.toHaveBeenCalled();
  });

  it("bound provider on incompatible version ⇒ Core default", async () => {
    const provider = roleHomeProvider({ contractVersion: "role-home-routing.v0" });
    registerPackContributions("p", { roleHomeRoutingProviders: [provider] });
    const res = await resolveShellRoleHomeRouting({ workspace, english: true, binding: rhBind("example-provider") });
    expect(res.selection.winner).toBe("core_default");
  });

  it("provider table with a non-generic fallback ⇒ fail-open to Core default + droppedProviderId", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const provider = roleHomeProvider(
        {},
        vi.fn(async () => providerTable({ fallback: { kind: "control_tower" } })),
      );
      registerPackContributions("p", { roleHomeRoutingProviders: [provider] });
      const res = await resolveShellRoleHomeRouting({ workspace, english: true, binding: rhBind("example-provider") });
      expect(res.droppedProviderId).toBe("example-provider");
      expect(JSON.stringify(res.table)).toBe(JSON.stringify(buildCoreDefaultRoleHomeRouting()));
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("provider build throws ⇒ fail-open to Core default + droppedProviderId", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const provider = roleHomeProvider(
        {},
        vi.fn(async () => {
          throw new Error("boom");
        }),
      );
      registerPackContributions("p", { roleHomeRoutingProviders: [provider] });
      const res = await resolveShellRoleHomeRouting({ workspace, english: true, binding: rhBind("example-provider") });
      expect(res.droppedProviderId).toBe("example-provider");
    } finally {
      errorSpy.mockRestore();
    }
  });
});

function aWorkstation(overrides: Partial<WorkstationDescriptor> = {}): WorkstationDescriptor {
  return {
    key: "collection",
    label: "催收工位",
    href: "/operating",
    roleCategories: ["COLLECTOR"],
    ...overrides,
  };
}

function workstationSource(
  overrides: Partial<WorkstationSourceContribution> = {},
): WorkstationSourceContribution {
  return {
    providerId: "ws-a",
    contractVersion: SHELL_WORKSTATION_CONTRACT_VERSION,
    provenance: "test",
    stability: "experimental",
    getAccess: vi.fn(async () => ({ ok: true })),
    buildWorkstations: vi.fn(async () => [aWorkstation()]),
    ...overrides,
  };
}

describe("resolveShellWorkstations — concat (Phase 3)", () => {
  it("empty store ⇒ Core default (empty) — mirror parity", async () => {
    const res = await resolveShellWorkstations({ workspace, english: true });
    expect(res.workstations).toEqual([]);
  });

  it("merges workstations from multiple eligible sources", async () => {
    registerPackContributions("p", {
      workstationSources: [
        workstationSource({ providerId: "ws-a", buildWorkstations: vi.fn(async () => [aWorkstation({ key: "a" })]) }),
        workstationSource({ providerId: "ws-b", buildWorkstations: vi.fn(async () => [aWorkstation({ key: "b" })]) }),
      ],
    });
    const res = await resolveShellWorkstations({ workspace, english: true });
    expect(res.workstations.map((w) => w.key).sort()).toEqual(["a", "b"]);
  });

  it("skips access-denied and version-incompatible sources", async () => {
    const denied = workstationSource({ providerId: "ws-denied", getAccess: vi.fn(async () => ({ ok: false })) });
    const legacy = workstationSource({ providerId: "ws-legacy", contractVersion: "workstation.v0" });
    registerPackContributions("p", { workstationSources: [denied, legacy] });
    const res = await resolveShellWorkstations({ workspace, english: true });
    expect(res.workstations).toEqual([]);
    expect(denied.buildWorkstations).not.toHaveBeenCalled();
    expect(legacy.getAccess).not.toHaveBeenCalled();
  });

  it("a source that throws is dropped and recorded as unreturned", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      registerPackContributions("p", {
        workstationSources: [
          workstationSource({ providerId: "ws-good", buildWorkstations: vi.fn(async () => [aWorkstation({ key: "good" })]) }),
          workstationSource({
            providerId: "ws-bad",
            buildWorkstations: vi.fn(async () => {
              throw new Error("boom");
            }),
          }),
        ],
      });
      const res = await resolveShellWorkstations({ workspace, english: true });
      expect(res.workstations.map((w) => w.key)).toEqual(["good"]);
      expect(res.unreturnedProviderIds).toEqual(["ws-bad"]);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("drops only the non-conformant descriptor, keeps the rest", async () => {
    registerPackContributions("p", {
      workstationSources: [
        workstationSource({
          providerId: "ws-mixed",
          buildWorkstations: vi.fn(async () => [
            aWorkstation({ key: "clean" }),
            aWorkstation({ key: "bad", href: "https://evil.example" }),
          ]),
        }),
      ],
    });
    const res = await resolveShellWorkstations({ workspace, english: true });
    expect(res.workstations.map((w) => w.key)).toEqual(["clean"]);
    expect(res.nonConformantProviderIds).toEqual(["ws-mixed"]);
  });

  it("dedupes by workstation key across sources (first writer wins)", async () => {
    registerPackContributions("p", {
      workstationSources: [
        workstationSource({ providerId: "ws-a", buildWorkstations: vi.fn(async () => [aWorkstation({ key: "dup", label: "first" })]) }),
        workstationSource({ providerId: "ws-b", buildWorkstations: vi.fn(async () => [aWorkstation({ key: "dup", label: "second" })]) }),
      ],
    });
    const res = await resolveShellWorkstations({ workspace, english: true });
    expect(res.workstations).toHaveLength(1);
    expect(res.workstations[0].label).toBe("first");
  });
});
