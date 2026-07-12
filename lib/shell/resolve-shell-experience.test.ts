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
