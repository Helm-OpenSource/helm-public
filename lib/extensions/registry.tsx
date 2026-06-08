import "server-only";

/**
 * lib/extensions/registry.tsx
 *
 * Core seam between the shared layer and registered Packs/Overlays.
 *
 * INVERSION (repo-split Step 5A): this file no longer imports any
 * `@/extensions/<tenant>/*` code. It reads contributions from the runtime
 * registry store (`registry-contract.ts`), which Packs populate at the
 * composition root (`instrumentation.ts`) via `registerPackContributions()`.
 *
 * Public mirror: with no Pack registered the store is empty, so every
 * `resolve*` degrades to empty/fallback — no stub file required.
 *
 * Shared routes/components must call only the public `resolve*`/`list*`
 * functions exported here; they must not import `@/extensions/<tenant>/*`.
 */

import type { ReactNode } from "react";

import { logPageViewEvent } from "@/lib/analytics";
import type { IndustryDemoPack } from "@/lib/demo/industry-fixtures/types";
import {
  runSignalCollectionJobs,
  startSignalCollectionScheduler,
} from "@/lib/signal-collection/scheduler";
import type {
  SignalCollectionJob,
  SignalCollectionRunContext,
} from "@/lib/signal-collection/types";

import {
  getRegisteredAccountBindings,
  getRegisteredBiBoards,
  getRegisteredBiReportP0ProcessService,
  getRegisteredCatalog,
  getRegisteredImplementationConsole,
  getRegisteredIndustryDemoReadouts,
  getRegisteredReportsExtensions,
  getRegisteredSignalCollectionJobProviders,
  getRegisteredWorkspaceNavExtensions,
} from "./registry-contract";
import type {
  BiReportP0ProcessProductionRow,
  BiReportP0ProcessSopRow,
  ExtensionIndustryDemoReadoutPage,
  ReportsExtensionDescriptor,
  ReportsExtensionPageViewEvent,
  ReportsExtensionTab,
  SolutionExtensionCatalogEntry,
  ResolvedApprovalsExtensionsType,
  ResolvedImportsExtensionsType,
  ResolvedReportsExtensionsType,
  ResolvedWorkspaceNavExtensionsType,
  WorkspaceLike,
  ExtensionAccessContext,
  ExtensionAccessResult,
  WorkspaceNavExtensionCluster,
} from "./registry-types";
import type { BiReportSignalRoutingConfig } from "@/lib/bi-report-skill/types";

// Re-export the public type surface so existing callers that did
// `import { WorkspaceLike, ResolvedReportsExtensions, ... } from "@/lib/extensions/registry"`
// keep compiling unchanged.
export type {
  WorkspaceLike,
  SolutionExtensionCatalogEntry,
  ReportsExtensionTab,
  ReportsExtensionPageViewEvent,
  AccountBindingContribution,
  BiBoardContribution,
  WorkspaceNavExtensionIconKey,
  WorkspaceNavExtensionItem,
  WorkspaceNavExtensionCluster,
  ExtensionIndustryDemoReadoutPage,
  BiReportP0ProcessProductionRow,
  BiReportP0ProcessSopRow,
} from "./registry-types";
export type ResolvedReportsExtensions = ResolvedReportsExtensionsType;
export type ResolvedImportsExtensions = ResolvedImportsExtensionsType;
export type ResolvedApprovalsExtensions = ResolvedApprovalsExtensionsType;
export type ResolvedWorkspaceNavExtensions = ResolvedWorkspaceNavExtensionsType;

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export function listSolutionExtensionCatalog(): ReadonlyArray<SolutionExtensionCatalogEntry> {
  return getRegisteredCatalog();
}

// ---------------------------------------------------------------------------
// Reports extensions
// ---------------------------------------------------------------------------

export const REPORTS_EXTENSION_ACCESS_TIMEOUT_MS = 2_500;

export async function resolveReportsExtensionAccessSafely(
  descriptor: {
    id: string;
    getAccess: (
      workspace: WorkspaceLike,
      context?: ExtensionAccessContext,
    ) => Promise<ExtensionAccessResult>;
  },
  workspace: WorkspaceLike,
  options?: { timeoutMs?: number; accessContext?: ExtensionAccessContext },
): Promise<ExtensionAccessResult> {
  const timeoutMs = options?.timeoutMs ?? REPORTS_EXTENSION_ACCESS_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<ExtensionAccessResult>((resolve) => {
    timer = setTimeout(() => {
      console.error(
        `[reports-extensions] ${descriptor.id} getAccess timed out after ${timeoutMs}ms; treating as ok=false`,
      );
      resolve({ ok: false });
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      descriptor.getAccess(workspace, options?.accessContext).catch((error) => {
        console.error(
          `[reports-extensions] ${descriptor.id} getAccess threw; treating as ok=false`,
          error,
        );
        return { ok: false } as const;
      }),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function buildReportsExtensionFallbackSurface(input: {
  descriptorId: string;
  english: boolean;
}): ReactNode {
  const english = input.english;

  return (
    <div
      data-testid="reports-extension-degraded-panel"
      data-extension-id={input.descriptorId}
      className="rounded-2xl border border-[color:var(--status-warning-border,#facc15)] bg-[color:var(--status-warning-bg,#fef9c3)] p-6 text-sm"
    >
      <h2 className="mb-2 text-base font-semibold text-[color:var(--status-warning-text,#854d0e)]">
        {english
          ? "This BI surface is temporarily unavailable"
          : "本扩展读板暂不可用"}
      </h2>
      <p className="mb-2 text-[color:var(--status-warning-text,#854d0e)]">
        {english
          ? "Helm could not prepare this surface just now. The weekly operating review and approvals are still open; the next refresh will retry."
          : "Helm 暂时无法准备本扩展读板。本周经营复盘与复核中心仍可正常进入，下次刷新会自动重试。"}
      </p>
      <p className="text-xs text-[color:var(--status-warning-text,#854d0e)] opacity-80">
        {english
          ? "If this keeps happening, contact your workspace admin."
          : "如持续出现请联系工作区管理员。"}
      </p>
    </div>
  );
}

export async function resolveReportsExtensions(input: {
  workspace: WorkspaceLike;
  english: boolean;
  requestedTab?: string | string[] | undefined;
  accessContext?: ExtensionAccessContext;
}): Promise<ResolvedReportsExtensions> {
  const reportsExtensions: ReadonlyArray<ReportsExtensionDescriptor> =
    getRegisteredReportsExtensions();

  const requestedSingle = Array.isArray(input.requestedTab)
    ? input.requestedTab[0]
    : input.requestedTab;

  const accessResults = await Promise.all(
    reportsExtensions.map(async (descriptor) => ({
      descriptor,
      access: await resolveReportsExtensionAccessSafely(descriptor, input.workspace, {
        accessContext: input.accessContext,
      }),
    })),
  );

  const tabs: ReportsExtensionTab[] = [];
  let active: ResolvedReportsExtensions["active"] = null;

  for (const { descriptor, access } of accessResults) {
    if (!access.ok) continue;
    try {
      tabs.push(...descriptor.buildTabs(input.english));
    } catch (error) {
      console.error(
        `[reports-extensions] ${descriptor.id} buildTabs threw; skipping tabs`,
        error,
      );
    }

    if (active) continue;
    let matched: string | null = null;
    try {
      matched = descriptor.matchTab(requestedSingle ?? undefined);
    } catch (error) {
      console.error(
        `[reports-extensions] ${descriptor.id} matchTab threw; not activating surface`,
        error,
      );
    }
    if (!matched) continue;

    try {
      active = {
        surface: descriptor.renderSurface({
          matchedTab: matched,
          english: input.english,
        }),
        pageViewEvent: descriptor.buildPageViewEvent({ matchedTab: matched }),
      };
    } catch (error) {
      console.error(
        `[reports-extensions] ${descriptor.id} renderSurface threw; rendering inline degraded panel`,
        error,
      );
      active = {
        surface: buildReportsExtensionFallbackSurface({
          descriptorId: descriptor.id,
          english: descriptor.resolveFallbackEnglish
            ? descriptor.resolveFallbackEnglish()
            : input.english,
        }),
        pageViewEvent: null,
      };
    }
  }

  return { tabs, active };
}

// ---------------------------------------------------------------------------
// Imports (account binding) / Approvals (BI board)
// ---------------------------------------------------------------------------

export async function resolveImportsExtensions(input: {
  workspace: WorkspaceLike;
  accessContext?: ExtensionAccessContext;
}): Promise<ResolvedImportsExtensions> {
  for (const binding of getRegisteredAccountBindings()) {
    const access = await binding.getAccess(input.workspace, input.accessContext);
    if (access.ok) {
      return { accountBinding: binding.build() };
    }
  }
  return { accountBinding: null };
}

export async function resolveApprovalsExtensions(input: {
  workspace: WorkspaceLike;
  accessContext?: ExtensionAccessContext;
}): Promise<ResolvedApprovalsExtensions> {
  for (const board of getRegisteredBiBoards()) {
    const access = await board.getAccess(input.workspace, input.accessContext);
    if (access.ok) {
      return { biBoard: board.build() };
    }
  }
  return { biBoard: null };
}

export async function canRenderImplementationConsolePanel(
  workspace: WorkspaceLike,
  accessContext?: ExtensionAccessContext,
): Promise<boolean> {
  const console_ = getRegisteredImplementationConsole();
  if (!console_) return false;
  const access = await console_.getAccess(workspace, accessContext);
  return access.ok;
}

// ---------------------------------------------------------------------------
// Industry demo readouts
// ---------------------------------------------------------------------------

export function listExtensionIndustryDemoPacks(): ReadonlyArray<IndustryDemoPack> {
  return getRegisteredIndustryDemoReadouts().map((c) => c.pack);
}

export function resolveExtensionIndustryDemoReadoutPage(input: {
  industryKey: string;
  english: boolean;
}): ExtensionIndustryDemoReadoutPage | null {
  for (const contribution of getRegisteredIndustryDemoReadouts()) {
    if (contribution.pack.industryKey === input.industryKey) {
      return contribution.buildReadoutPage({ english: input.english });
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Workspace nav
// ---------------------------------------------------------------------------

export async function resolveWorkspaceNavExtensions(input: {
  workspace: WorkspaceLike;
  english: boolean;
  accessContext?: ExtensionAccessContext;
}): Promise<ResolvedWorkspaceNavExtensions> {
  const workspaceNavExtensions = getRegisteredWorkspaceNavExtensions();
  const accessResults = await Promise.all(
    workspaceNavExtensions.map(async (descriptor) => ({
      descriptor,
      access: await descriptor.getAccess(input.workspace, input.accessContext),
    })),
  );

  const clusters: WorkspaceNavExtensionCluster[] = [];
  for (const { descriptor, access } of accessResults) {
    if (!access.ok) continue;
    const cluster = descriptor.buildCluster(input.english);
    if (cluster.items.length === 0) continue;
    clusters.push(cluster);
  }
  return { clusters };
}

export async function logReportsExtensionPageView(
  event: ReportsExtensionPageViewEvent | null,
): Promise<void> {
  if (!event) return;
  await logPageViewEvent(event);
}

// ---------------------------------------------------------------------------
// BI-report P0 process service (Pack-contributed)
// ---------------------------------------------------------------------------

function requireBiReportP0ProcessService() {
  const svc = getRegisteredBiReportP0ProcessService();
  if (!svc) {
    throw new Error(
      "BI-report P0 process service is not registered. This route requires a Pack " +
        "that contributes biReportP0ProcessService (e.g. NPA Pack) to be enabled.",
    );
  }
  return svc;
}

export function getBiReportP0ProcessSkillKey(): string {
  return requireBiReportP0ProcessService().skillKey;
}

export async function resolveBiReportPushWorkspaceIdFromRegistry(input: {
  workspaceId?: string | null;
}): Promise<string> {
  return requireBiReportP0ProcessService().resolvePushWorkspaceId(input);
}

export async function previewBiReportP0ProcessSignals(input: {
  workspaceId: string;
  windowDate: string;
  productionRows: BiReportP0ProcessProductionRow[];
  sopRows?: BiReportP0ProcessSopRow[];
  signalRouting?: BiReportSignalRoutingConfig;
}) {
  return requireBiReportP0ProcessService().preview(input);
}

export async function persistBiReportP0ProcessSignals(input: {
  workspaceId: string;
  windowDate: string;
  sourceRunId?: string | null;
  productionRows: BiReportP0ProcessProductionRow[];
  sopRows?: BiReportP0ProcessSopRow[];
  signalRouting?: BiReportSignalRoutingConfig;
}) {
  return requireBiReportP0ProcessService().persist(input);
}

// ---------------------------------------------------------------------------
// Signal collection jobs (Pack-contributed)
// ---------------------------------------------------------------------------

export function listRegisteredSignalCollectionJobs(): SignalCollectionJob[] {
  const jobs: SignalCollectionJob[] = [];
  for (const provider of getRegisteredSignalCollectionJobProviders()) {
    jobs.push(...provider());
  }
  assertUniqueSignalCollectionJobKeys(jobs);
  return jobs;
}

export async function runRegisteredSignalCollectionJobs(input: {
  jobKeys?: readonly string[];
  source?: SignalCollectionRunContext["source"];
} = {}) {
  return runSignalCollectionJobs({
    jobs: listRegisteredSignalCollectionJobs(),
    jobKeys: input.jobKeys,
    source: input.source ?? "api",
  });
}

export function startRegisteredSignalCollectionScheduler() {
  startSignalCollectionScheduler({
    jobs: listRegisteredSignalCollectionJobs(),
    stateKey: "registered-signal-collection",
    source: "scheduler",
  });
}

function assertUniqueSignalCollectionJobKeys(
  jobs: readonly SignalCollectionJob[],
) {
  const seen = new Set<string>();
  for (const job of jobs) {
    if (seen.has(job.key)) {
      throw new Error(`Duplicate signal collection job key: ${job.key}`);
    }
    if (job.allowedEffects.length === 0) {
      throw new Error(`Signal collection job is missing allowed effects: ${job.key}`);
    }
    seen.add(job.key);
  }
}
