import "server-only";

/**
 * lib/extensions/registry-contract.ts
 *
 * Core-side Pack registration contract + in-memory registry store.
 *
 * This module is **Core** (no `@/extensions/<tenant>/*` imports). It defines
 * the contribution shapes a Pack/Overlay registers, plus a process-singleton
 * store. `lib/extensions/registry.tsx` reads ONLY from this store; it no longer
 * imports any tenant code. Packs register their contributions at the
 * composition root (`instrumentation.ts`) via `registerPackContributions()`.
 *
 * Empty store ⇒ every `resolve*` degrades to empty/fallback — which also makes
 * the public mirror (no tenant packs) a no-op instead of needing a stub file.
 *
 * This is the seam that will become `@helm/pack-sdk` (Pack-SDK L1 contract).
 */

import type {
  BiReportBusinessSignalRecord,
  BiReportSignalRoutingConfig,
} from "@/lib/bi-report-skill/types";
import type { IndustryDemoPack } from "@/lib/demo/industry-fixtures/types";
import type { SignalCollectionJob } from "@/lib/signal-collection/types";

import {
  registerExtensionApiRoutes,
  type ExtensionApiRoute,
} from "./api-route-registry";

// Re-export the route contract so Pack modules import everything pack-related
// from one entry point (the future @helm/pack-sdk surface).
export type { ExtensionApiRoute, ApiRouteMethod } from "./api-route-registry";

import type {
  AccountBindingContribution,
  BiBoardContribution,
  BiReportP0ProcessProductionRow,
  BiReportP0ProcessSopRow,
  ExtensionIndustryDemoReadoutPage,
  ReportsExtensionDescriptor,
  SolutionExtensionCatalogEntry,
  WorkspaceLike,
  WorkspaceNavExtensionDescriptor,
} from "./registry-types";

// Re-export shared types so Pack modules can import everything they need from
// the registry contract (the future @helm/pack-sdk entry point).
export type * from "./registry-types";

/**
 * The BI-report P0 process service a Pack may contribute. When absent, the
 * Core `previewBiReportP0ProcessSignals` / `persistBiReportP0ProcessSignals`
 * throw a clear "no pack registered" error (callers are tenant-gated routes
 * that only run when the pack is enabled).
 */
export type BiReportP0ProcessPersistResult = {
  sourceRunId: string;
  generatedCount: number;
  persistedCount: number;
  signals: unknown[];
  signalCandidates: unknown;
  externalSignals: unknown;
  /** Persisted business-signal records (null = de-duplicated / skipped). */
  persistedSignals: ReadonlyArray<BiReportBusinessSignalRecord | null>;
};

export type BiReportP0ProcessService = {
  skillKey: string;
  resolvePushWorkspaceId: (input: {
    workspaceId?: string | null;
  }) => Promise<string>;
  preview: (input: {
    workspaceId: string;
    windowDate: string;
    productionRows: BiReportP0ProcessProductionRow[];
    sopRows?: BiReportP0ProcessSopRow[];
    signalRouting?: BiReportSignalRoutingConfig;
  }) => Promise<unknown>;
  persist: (input: {
    workspaceId: string;
    windowDate: string;
    sourceRunId?: string | null;
    productionRows: BiReportP0ProcessProductionRow[];
    sopRows?: BiReportP0ProcessSopRow[];
    signalRouting?: BiReportSignalRoutingConfig;
  }) => Promise<BiReportP0ProcessPersistResult>;
};

/** One industry demo readout contribution (industryKey → page builder). */
export type IndustryDemoReadoutContribution = {
  pack: IndustryDemoPack;
  buildReadoutPage: (input: {
    english: boolean;
  }) => ExtensionIndustryDemoReadoutPage;
};

/** Implementation-console-style panel access gate contribution. */
export type ImplementationConsoleContribution = {
  getAccess: (workspace: WorkspaceLike) => Promise<{ ok: boolean }>;
};

// ---------------------------------------------------------------------------
// Full registration payload — everything a Pack contributes in one object.
// All fields optional so a partial pack (or the empty public mirror) is valid.
// ---------------------------------------------------------------------------

export type PackContributions = {
  catalog?: ReadonlyArray<SolutionExtensionCatalogEntry>;
  reportsExtensions?: ReadonlyArray<ReportsExtensionDescriptor>;
  workspaceNavExtensions?: ReadonlyArray<WorkspaceNavExtensionDescriptor>;
  /** Account-binding contribution gated by its own access probe. */
  accountBinding?: {
    getAccess: (workspace: WorkspaceLike) => Promise<{ ok: boolean }>;
    build: () => AccountBindingContribution;
  };
  /** Approvals BI-board contribution gated by its own access probe. */
  biBoard?: {
    getAccess: (workspace: WorkspaceLike) => Promise<{ ok: boolean }>;
    build: () => BiBoardContribution;
  };
  industryDemoReadouts?: ReadonlyArray<IndustryDemoReadoutContribution>;
  biReportP0ProcessService?: BiReportP0ProcessService;
  implementationConsole?: ImplementationConsoleContribution;
  signalCollectionJobs?: () => ReadonlyArray<SignalCollectionJob>;
  /**
   * API routes the pack serves under `/api/extensions/<pack>/...`, dispatched by
   * the Core catch-all (repo-split 5B). Each handler keeps its own auth gate;
   * the registry performs no auth. Patterns are relative to `/api/extensions/`.
   */
  apiRoutes?: ReadonlyArray<ExtensionApiRoute>;
};

// ---------------------------------------------------------------------------
// Process-singleton store.
// ---------------------------------------------------------------------------

type MutableStore = {
  catalog: SolutionExtensionCatalogEntry[];
  reportsExtensions: ReportsExtensionDescriptor[];
  workspaceNavExtensions: WorkspaceNavExtensionDescriptor[];
  accountBindings: NonNullable<PackContributions["accountBinding"]>[];
  biBoards: NonNullable<PackContributions["biBoard"]>[];
  industryDemoReadouts: IndustryDemoReadoutContribution[];
  biReportP0ProcessService: BiReportP0ProcessService | null;
  implementationConsole: ImplementationConsoleContribution | null;
  signalCollectionJobProviders: Array<() => ReadonlyArray<SignalCollectionJob>>;
  registeredPackIds: Set<string>;
};

function emptyStore(): MutableStore {
  return {
    catalog: [],
    reportsExtensions: [],
    workspaceNavExtensions: [],
    accountBindings: [],
    biBoards: [],
    industryDemoReadouts: [],
    biReportP0ProcessService: null,
    implementationConsole: null,
    signalCollectionJobProviders: [],
    registeredPackIds: new Set(),
  };
}

// Survive HMR / multiple module evaluations via globalThis.
const STORE_KEY = "__helm_pack_registry_store__";
function store(): MutableStore {
  const g = globalThis as unknown as Record<string, MutableStore | undefined>;
  if (!g[STORE_KEY]) g[STORE_KEY] = emptyStore();
  return g[STORE_KEY]!;
}

/**
 * Register a Pack's contributions. Idempotent per `packId` (re-registering the
 * same id is a no-op, so HMR / double instrumentation does not duplicate tabs).
 */
export function registerPackContributions(
  packId: string,
  contributions: PackContributions,
): void {
  const s = store();
  if (s.registeredPackIds.has(packId)) return;
  s.registeredPackIds.add(packId);

  if (contributions.catalog) s.catalog.push(...contributions.catalog);
  if (contributions.reportsExtensions)
    s.reportsExtensions.push(...contributions.reportsExtensions);
  if (contributions.workspaceNavExtensions)
    s.workspaceNavExtensions.push(...contributions.workspaceNavExtensions);
  if (contributions.accountBinding)
    s.accountBindings.push(contributions.accountBinding);
  if (contributions.biBoard) s.biBoards.push(contributions.biBoard);
  if (contributions.industryDemoReadouts)
    s.industryDemoReadouts.push(...contributions.industryDemoReadouts);
  if (contributions.biReportP0ProcessService)
    s.biReportP0ProcessService = contributions.biReportP0ProcessService;
  if (contributions.implementationConsole)
    s.implementationConsole = contributions.implementationConsole;
  if (contributions.signalCollectionJobs)
    s.signalCollectionJobProviders.push(contributions.signalCollectionJobs);
  if (contributions.apiRoutes && contributions.apiRoutes.length > 0)
    registerExtensionApiRoutes(packId, contributions.apiRoutes);
}

/** Test/diagnostic helper: clear the registry (not used in production paths). */
export function __resetPackRegistryForTest(): void {
  const g = globalThis as unknown as Record<string, MutableStore | undefined>;
  g[STORE_KEY] = emptyStore();
}

// Read-side accessors used by registry.tsx -----------------------------------

export function getRegisteredCatalog(): ReadonlyArray<SolutionExtensionCatalogEntry> {
  return store().catalog;
}
export function getRegisteredReportsExtensions(): ReadonlyArray<ReportsExtensionDescriptor> {
  return store().reportsExtensions;
}
export function getRegisteredWorkspaceNavExtensions(): ReadonlyArray<WorkspaceNavExtensionDescriptor> {
  return store().workspaceNavExtensions;
}
export function getRegisteredAccountBindings(): ReadonlyArray<
  NonNullable<PackContributions["accountBinding"]>
> {
  return store().accountBindings;
}
export function getRegisteredBiBoards(): ReadonlyArray<
  NonNullable<PackContributions["biBoard"]>
> {
  return store().biBoards;
}
export function getRegisteredIndustryDemoReadouts(): ReadonlyArray<IndustryDemoReadoutContribution> {
  return store().industryDemoReadouts;
}
export function getRegisteredBiReportP0ProcessService(): BiReportP0ProcessService | null {
  return store().biReportP0ProcessService;
}
export function getRegisteredImplementationConsole(): ImplementationConsoleContribution | null {
  return store().implementationConsole;
}
export function getRegisteredSignalCollectionJobProviders(): ReadonlyArray<
  () => ReadonlyArray<SignalCollectionJob>
> {
  return store().signalCollectionJobProviders;
}
