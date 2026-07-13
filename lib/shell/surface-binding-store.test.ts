import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    workspaceSurfaceBinding: {
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
    },
  },
}));

import {
  __resetPackRegistryForTest,
  registerPackContributions,
} from "@/lib/extensions/registry-contract";
import {
  isSingleWinnerSurfaceKey,
  listBindableProvidersForSurface,
  loadWorkspaceSurfaceBindings,
  requiredContractVersionForSurface,
  resolveWorkspaceSurfaceBinding,
  SINGLE_WINNER_SURFACE_KEYS,
} from "@/lib/shell/surface-binding-store";
import {
  SHELL_MAINLINE_CONTRACT_VERSION,
  SHELL_MAINLINE_SURFACE_KEY,
  SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION,
  SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
} from "@/lib/shell/resolve-shell-experience";

beforeEach(() => {
  vi.clearAllMocks();
  __resetPackRegistryForTest();
});
afterEach(() => __resetPackRegistryForTest());

describe("single-winner surface key registry", () => {
  it("recognizes only mainline + role-home-routing as single-winner", () => {
    expect(isSingleWinnerSurfaceKey(SHELL_MAINLINE_SURFACE_KEY)).toBe(true);
    expect(isSingleWinnerSurfaceKey(SHELL_ROLE_HOME_ROUTING_SURFACE_KEY)).toBe(true);
    // concat surfaces are NOT bindable
    expect(isSingleWinnerSurfaceKey("attention")).toBe(false);
    expect(isSingleWinnerSurfaceKey("workstation")).toBe(false);
    expect(isSingleWinnerSurfaceKey("operation-suggestion")).toBe(false);
    expect(SINGLE_WINNER_SURFACE_KEYS).toHaveLength(2);
  });

  it("maps each surface to its exact required contract version", () => {
    expect(requiredContractVersionForSurface(SHELL_MAINLINE_SURFACE_KEY)).toBe(
      SHELL_MAINLINE_CONTRACT_VERSION,
    );
    expect(
      requiredContractVersionForSurface(SHELL_ROLE_HOME_ROUTING_SURFACE_KEY),
    ).toBe(SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION);
  });
});

describe("listBindableProvidersForSurface", () => {
  it("reflects registered role-home-routing providers", () => {
    expect(
      listBindableProvidersForSurface(SHELL_ROLE_HOME_ROUTING_SURFACE_KEY),
    ).toHaveLength(0);
    registerPackContributions("pack-x", {
      roleHomeRoutingProviders: [
        {
          providerId: "prov-rhr",
          contractVersion: SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION,
          priority: 10,
          provenance: "pack-x:rhr",
          stability: "experimental",
          getAccess: async () => ({ ok: true }),
          buildRoleHomeRouting: async () => ({
            routes: [],
            fallback: { kind: "generic" },
          }),
        },
      ],
    });
    const list = listBindableProvidersForSurface(
      SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      providerId: "prov-rhr",
      contractVersion: SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION,
      provenance: "pack-x:rhr",
    });
  });
});

describe("resolveWorkspaceSurfaceBinding", () => {
  it("returns null for a non-single-winner surface without touching the db", async () => {
    const result = await resolveWorkspaceSurfaceBinding("ws_1", "attention");
    expect(result).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when no binding row exists (Core default)", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const result = await resolveWorkspaceSurfaceBinding(
      "ws_1",
      SHELL_MAINLINE_SURFACE_KEY,
    );
    expect(result).toBeNull();
  });

  it("returns the persisted SurfaceBinding shape when a row exists", async () => {
    mocks.findUnique.mockResolvedValue({
      surfaceKey: SHELL_MAINLINE_SURFACE_KEY,
      providerId: "example-mainline-provider",
    });
    const result = await resolveWorkspaceSurfaceBinding(
      "ws_1",
      SHELL_MAINLINE_SURFACE_KEY,
    );
    expect(result).toEqual({
      surfaceKey: SHELL_MAINLINE_SURFACE_KEY,
      providerId: "example-mainline-provider",
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_surfaceKey: {
          workspaceId: "ws_1",
          surfaceKey: SHELL_MAINLINE_SURFACE_KEY,
        },
      },
      select: { surfaceKey: true, providerId: true },
    });
  });
});

describe("loadWorkspaceSurfaceBindings", () => {
  it("returns a row per single-winner surface with Core-default state when unbound", async () => {
    mocks.findMany.mockResolvedValue([]);
    const rows = await loadWorkspaceSurfaceBindings("ws_1");
    expect(rows).toHaveLength(SINGLE_WINNER_SURFACE_KEYS.length);
    for (const row of rows) {
      expect(row.boundProviderId).toBeNull();
      expect(row.boundProviderRegistered).toBe(true); // 无绑定 = 名义已"注册"(Core 默认)
    }
  });

  it("marks candidates compatible/bound and flags a bound-but-unregistered provider", async () => {
    // 绑定到一个未注册的 providerId → boundProviderRegistered=false(读侧 fail-open 回 Core)
    mocks.findMany.mockResolvedValue([
      { surfaceKey: SHELL_ROLE_HOME_ROUTING_SURFACE_KEY, providerId: "prov-registered" },
      { surfaceKey: SHELL_MAINLINE_SURFACE_KEY, providerId: "ghost-provider" },
    ]);
    registerPackContributions("pack-x", {
      roleHomeRoutingProviders: [
        {
          providerId: "prov-registered",
          contractVersion: SHELL_ROLE_HOME_ROUTING_CONTRACT_VERSION,
          priority: 10,
          provenance: "pack-x:rhr",
          stability: "experimental",
          getAccess: async () => ({ ok: true }),
          buildRoleHomeRouting: async () => ({ routes: [], fallback: { kind: "generic" } }),
        },
      ],
    });
    const rows = await loadWorkspaceSurfaceBindings("ws_1");
    const rhr = rows.find((r) => r.surfaceKey === SHELL_ROLE_HOME_ROUTING_SURFACE_KEY)!;
    expect(rhr.boundProviderId).toBe("prov-registered");
    expect(rhr.boundProviderRegistered).toBe(true);
    const boundCandidate = rhr.candidates.find((c) => c.providerId === "prov-registered")!;
    expect(boundCandidate.bound).toBe(true);
    expect(boundCandidate.compatible).toBe(true);

    const mainline = rows.find((r) => r.surfaceKey === SHELL_MAINLINE_SURFACE_KEY)!;
    expect(mainline.boundProviderId).toBe("ghost-provider");
    expect(mainline.boundProviderRegistered).toBe(false); // 绑定的 provider 未注册
  });

  it("marks a registered but contract-incompatible candidate as not compatible", async () => {
    mocks.findMany.mockResolvedValue([]);
    registerPackContributions("pack-y", {
      roleHomeRoutingProviders: [
        {
          providerId: "prov-legacy",
          contractVersion: "role-home-routing.v0-legacy",
          priority: 10,
          provenance: "pack-y:rhr",
          stability: "experimental",
          getAccess: async () => ({ ok: true }),
          buildRoleHomeRouting: async () => ({ routes: [], fallback: { kind: "generic" } }),
        },
      ],
    });
    const rows = await loadWorkspaceSurfaceBindings("ws_1");
    const rhr = rows.find((r) => r.surfaceKey === SHELL_ROLE_HOME_ROUTING_SURFACE_KEY)!;
    const legacy = rhr.candidates.find((c) => c.providerId === "prov-legacy")!;
    expect(legacy.compatible).toBe(false);
  });
});
