import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    workspaceSurfaceBinding: {
      findUnique: mocks.findUnique,
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
