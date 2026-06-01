/**
 * registry-core-only-mirror-parity — repo-split 5C proof.
 *
 * Proves that the REAL `lib/extensions/registry.tsx` (which ships in the public
 * mirror) behaves as a Core-only / no-extension deployment when no Pack has
 * registered — i.e. it returns exactly the "no extension available" shapes the
 * deleted public-mirror stub used to hardcode.
 *
 * This is the evidence the owner required before removing the stub: the public
 * mirror no longer needs `scripts/build-public-mirror-extensions-stub.ts`,
 * because the unmodified registry already degrades to empty. The mirror ships
 * `registry.tsx` + `registry-contract.ts` + `registry-types.ts` +
 * `api-route-registry.ts` (all verified tenant-import-free) while
 * `extensions/pack-bootstrap.ts` (the only tenant-naming wire) stays
 * mirror-private, so `instrumentation.ts` finds no bootstrap and the store stays
 * empty.
 *
 * If a future edit reintroduces a hardcoded tenant contribution into
 * registry.tsx, this test fails — catching the regression the stub used to mask.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetPackRegistryForTest } from "./registry-contract";
import {
  canRenderImplementationConsolePanel,
  listExtensionIndustryDemoPacks,
  listRegisteredSignalCollectionJobs,
  listSolutionExtensionCatalog,
  resolveApprovalsExtensions,
  resolveExtensionIndustryDemoReadoutPage,
  resolveImportsExtensions,
  resolveReportsExtensions,
  resolveWorkspaceNavExtensions,
  runRegisteredSignalCollectionJobs,
} from "./registry";

const workspace = {
  id: "ws-core-only",
  slug: "core-only",
  systemKey: null,
  workspaceClass: null,
};

beforeEach(() => __resetPackRegistryForTest());
afterEach(() => __resetPackRegistryForTest());

describe("real registry.tsx degrades to Core-only with an empty store (mirror parity)", () => {
  it("catalog / demo packs / signal jobs are empty", () => {
    expect(listSolutionExtensionCatalog()).toEqual([]);
    expect(listExtensionIndustryDemoPacks()).toEqual([]);
    expect(listRegisteredSignalCollectionJobs()).toEqual([]);
  });

  it("reports / imports / approvals / nav resolvers return the no-extension shape", async () => {
    expect(await resolveReportsExtensions({ workspace, english: true })).toEqual({
      tabs: [],
      active: null,
    });
    expect(await resolveImportsExtensions({ workspace })).toEqual({ accountBinding: null });
    expect(await resolveApprovalsExtensions({ workspace })).toEqual({ biBoard: null });
    expect(await resolveWorkspaceNavExtensions({ workspace, english: true })).toEqual({
      clusters: [],
    });
  });

  it("implementation-console panel is hidden and demo readout is null", async () => {
    expect(await canRenderImplementationConsolePanel(workspace)).toBe(false);
    expect(
      resolveExtensionIndustryDemoReadoutPage({ industryKey: "anything", english: true }),
    ).toBeNull();
  });

  it("runRegisteredSignalCollectionJobs reports an all-zero run", async () => {
    const result = await runRegisteredSignalCollectionJobs();
    expect(result.jobCount).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(0);
    expect(result.jobs).toEqual([]);
  });
});
