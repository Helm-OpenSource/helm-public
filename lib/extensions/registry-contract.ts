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
  AttentionSourceContribution,
  BiBoardContribution,
  BiReportP0ProcessProductionRow,
  BiReportP0ProcessSopRow,
  ExtensionIndustryDemoReadoutPage,
  AgentRunAuditSourceContribution,
  MainlineProviderContribution,
  NorthstarKpiSourceContribution,
  OperationSuggestionSourceContribution,
  ReportsExtensionDescriptor,
  RoleHomeRoutingProviderContribution,
  SolutionExtensionCatalogEntry,
  WorkspaceNavExtensionDescriptor,
  WorkstationSourceContribution,
  ExtensionAccessProbe,
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
  getAccess: ExtensionAccessProbe;
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
    getAccess: ExtensionAccessProbe;
    build: () => AccountBindingContribution;
  };
  /** Approvals BI-board contribution gated by its own access probe. */
  biBoard?: {
    getAccess: ExtensionAccessProbe;
    build: () => BiBoardContribution;
  };
  industryDemoReadouts?: ReadonlyArray<IndustryDemoReadoutContribution>;
  /**
   * Single-winner operating-mainline providers (blueprint Phase 2, experimental).
   * Registered contributions form the *candidate pool*; the runtime picks at
   * most one via the binding-is-authorization model (§4.3). With no valid
   * binding — the default — the Core default provider is used.
   */
  mainlineProviders?: ReadonlyArray<MainlineProviderContribution>;
  /**
   * Northstar-KPI sources (blueprint Phase 2, experimental, **concat**). Every
   * eligible source's KPIs are merged by `resolveShellNorthstarKpis`.
   */
  northstarKpiSources?: ReadonlyArray<NorthstarKpiSourceContribution>;
  /**
   * Attention sources (blueprint Phase 2, experimental, **concat**). Collected
   * concurrently and merged by `resolveShellAttention` under the §4.4 budget.
   */
  attentionSources?: ReadonlyArray<AttentionSourceContribution>;
  /**
   * Operation-suggestion sources (blueprint Phase 4, experimental, **concat**).
   * Infrequent-operation suggestions merged by `resolveShellOperationSuggestions`.
   */
  operationSuggestionSources?: ReadonlyArray<OperationSuggestionSourceContribution>;
  /**
   * Single-winner role-home routing providers (blueprint Phase 3, experimental).
   * Candidate pool; the runtime picks one via the binding model (§4.3), else
   * the Core default routing.
   */
  roleHomeRoutingProviders?: ReadonlyArray<RoleHomeRoutingProviderContribution>;
  /**
   * Workstation sources (blueprint Phase 3, experimental, **concat**). Merged by
   * `resolveShellWorkstations` under the §4.4 budget.
   */
  workstationSources?: ReadonlyArray<WorkstationSourceContribution>;
  /**
   * Run-trajectory audit sources (blueprint Phase 5, experimental, **concat**).
   * Read-only agent-run audit entries merged by `resolveShellRunTrajectoryAudit`.
   */
  agentRunAuditSources?: ReadonlyArray<AgentRunAuditSourceContribution>;
  biReportP0ProcessService?: BiReportP0ProcessService;
  implementationConsole?: ImplementationConsoleContribution;
  signalCollectionJobs?: () => ReadonlyArray<SignalCollectionJob>;
  /**
   * API routes the pack serves under `/api/extensions/<pack>/...`, dispatched by
   * the Core catch-all (repo-split 5B). Each route must declare authorization
   * metadata: either the Core permission evaluator wrapper or handler-owned
   * gate evidence. Patterns are relative to `/api/extensions/`.
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
  mainlineProviders: MainlineProviderContribution[];
  northstarKpiSources: NorthstarKpiSourceContribution[];
  attentionSources: AttentionSourceContribution[];
  operationSuggestionSources: OperationSuggestionSourceContribution[];
  roleHomeRoutingProviders: RoleHomeRoutingProviderContribution[];
  workstationSources: WorkstationSourceContribution[];
  agentRunAuditSources: AgentRunAuditSourceContribution[];
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
    mainlineProviders: [],
    northstarKpiSources: [],
    attentionSources: [],
    operationSuggestionSources: [],
    roleHomeRoutingProviders: [],
    workstationSources: [],
    agentRunAuditSources: [],
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
  if (contributions.mainlineProviders)
    s.mainlineProviders.push(...contributions.mainlineProviders);
  if (contributions.northstarKpiSources)
    s.northstarKpiSources.push(...contributions.northstarKpiSources);
  if (contributions.attentionSources)
    s.attentionSources.push(...contributions.attentionSources);
  if (contributions.operationSuggestionSources)
    s.operationSuggestionSources.push(...contributions.operationSuggestionSources);
  if (contributions.roleHomeRoutingProviders)
    s.roleHomeRoutingProviders.push(...contributions.roleHomeRoutingProviders);
  if (contributions.workstationSources)
    s.workstationSources.push(...contributions.workstationSources);
  if (contributions.agentRunAuditSources)
    s.agentRunAuditSources.push(...contributions.agentRunAuditSources);
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
export function getRegisteredMainlineProviders(): ReadonlyArray<MainlineProviderContribution> {
  return store().mainlineProviders;
}
export function getRegisteredNorthstarKpiSources(): ReadonlyArray<NorthstarKpiSourceContribution> {
  return store().northstarKpiSources;
}
export function getRegisteredAttentionSources(): ReadonlyArray<AttentionSourceContribution> {
  return store().attentionSources;
}
export function getRegisteredOperationSuggestionSources(): ReadonlyArray<OperationSuggestionSourceContribution> {
  return store().operationSuggestionSources;
}
export function getRegisteredRoleHomeRoutingProviders(): ReadonlyArray<RoleHomeRoutingProviderContribution> {
  return store().roleHomeRoutingProviders;
}
export function getRegisteredWorkstationSources(): ReadonlyArray<WorkstationSourceContribution> {
  return store().workstationSources;
}
export function getRegisteredAgentRunAuditSources(): ReadonlyArray<AgentRunAuditSourceContribution> {
  return store().agentRunAuditSources;
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
