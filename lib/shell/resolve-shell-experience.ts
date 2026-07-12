import "server-only";

/**
 * resolveShellExperience —— 蓝图 §4.4 读侧统一入口（Phase 2）。
 *
 * 本模块把"经营主线"surface 从"Core 直接 buildCoreDefaultMainline"升级为
 * provider-selectable：注册的 mainline provider 组成候选池，运行时按绑定授权
 * 模型（§4.3）至多选一；**无有效绑定即 Core default**（fallback，不参加竞争）。
 *
 * fail 语义方向性（§3.2 / §4.1）：
 *  - 绑定缺失 / 越权 / 版本不兼容 / access 未过 → 回 Core default + 冲突回执；
 *  - provider 产出不通过 conformance 校验 / buildMainline 抛错 → 回 Core default
 *    （fail-open 向完整信息面，不空屏、不部分渲染）。
 *
 * 空 store（公开镜像 / 无 pack 注册）→ 恒等于 buildCoreDefaultMainline，
 * 由 resolve-shell-experience.test.ts 与 registry-core-only-mirror-parity 平价证明。
 */

import {
  getRegisteredAttentionSources,
  getRegisteredMainlineProviders,
  getRegisteredNorthstarKpiSources,
  getRegisteredOperationSuggestionSources,
} from "@/lib/extensions/registry-contract";
import { resolveReportsExtensionAccessSafely } from "@/lib/extensions/registry";
import type {
  AttentionSourceContribution,
  ExtensionAccessContext,
  NorthstarKpiSourceContribution,
  OperationSuggestionSourceContribution,
  WorkspaceLike,
} from "@/lib/extensions/registry-types";

import {
  buildCoreDefaultMainline,
  validateMainlineReadout,
  type CoreDefaultMainlineInput,
  type MainlineReadout,
} from "./operating-mainline";
import {
  buildCoreDefaultNorthstarKpis,
  validateNorthstarKpis,
  type NorthstarKpi,
} from "./northstar-kpi";
import {
  attentionDedupeKey,
  buildCoreDefaultAttention,
  makeUnreturnedSourceItem,
  validateAttentionItems,
  type AttentionItem,
} from "./attention-feed";
import {
  buildCoreDefaultOperationSuggestions,
  validateOperationSuggestions,
  type OperationSuggestion,
} from "./operation-suggestion";
import {
  selectSingleWinner,
  type ProviderCandidate,
  type ProviderSelection,
  type SurfaceBinding,
} from "./provider-selection";

/** Surface key for the single-winner operating-mainline surface (§4.3). */
export const SHELL_MAINLINE_SURFACE_KEY = "mainline";

/**
 * Experimental mainline contract version. While `experimental` there is no
 * backward-compatibility promise, so compatibility is an **exact** string match
 * (§4.3.2: incompatible versions must not enter the candidate set). Bumping
 * this string deliberately drops every provider still on the old version back
 * to the Core default until they re-pin.
 */
export const SHELL_MAINLINE_CONTRACT_VERSION = "mainline.v1-experimental";

export type ShellMainlineResolution = {
  readout: MainlineReadout;
  /** Full selection diagnostics (winner, recommendations, conflict receipt). */
  selection: ProviderSelection;
  /**
   * Set when a *selected* provider's readout was rejected (conformance failure
   * or thrown build) and the Core default was substituted. Null when the Core
   * default was chosen by selection, or when the provider readout passed.
   */
  droppedProviderId: string | null;
};

/**
 * Resolve the operating-mainline readout for a workspace.
 *
 * `binding` is supplied by the caller (read from workspace configuration by a
 * later slice; Phase 2a callers pass `null`, which — with the Core default as
 * fallback — is byte-identical to the pre-Phase-2 direct build).
 */
export async function resolveShellMainline(input: {
  workspace: WorkspaceLike;
  english: boolean;
  coreDefault: CoreDefaultMainlineInput;
  binding: SurfaceBinding | null;
  accessContext?: ExtensionAccessContext;
}): Promise<ShellMainlineResolution> {
  const providers = getRegisteredMainlineProviders();

  const candidates: ProviderCandidate[] = await Promise.all(
    providers.map(async (provider): Promise<ProviderCandidate> => {
      const access = await resolveReportsExtensionAccessSafely(
        { id: provider.providerId, getAccess: provider.getAccess },
        input.workspace,
        { accessContext: input.accessContext },
      );
      return {
        providerId: provider.providerId,
        contractVersion: provider.contractVersion,
        priority: provider.priority,
        provenance: provider.provenance,
        enabled: true,
        accessOk: access.ok,
        contractCompatible:
          provider.contractVersion === SHELL_MAINLINE_CONTRACT_VERSION,
      };
    }),
  );

  const selection = selectSingleWinner({
    surfaceKey: SHELL_MAINLINE_SURFACE_KEY,
    candidates,
    binding: input.binding,
  });

  const coreFallback = (droppedProviderId: string | null): ShellMainlineResolution => ({
    readout: buildCoreDefaultMainline(input.coreDefault),
    selection,
    droppedProviderId,
  });

  if (selection.winner === "core_default") {
    return coreFallback(null);
  }

  const winnerId = selection.winner.providerId;
  const provider = providers.find((p) => p.providerId === winnerId);
  // Defensive: selection can only return a providerId drawn from the candidate
  // pool, so this should never miss; fail open to Core default if it somehow does.
  if (!provider) {
    return coreFallback(null);
  }

  try {
    const readout = await provider.buildMainline({
      workspace: input.workspace,
      english: input.english,
    });
    const issues = validateMainlineReadout(readout);
    if (issues.length > 0) {
      console.error(
        `[shell-experience] mainline provider ${winnerId} produced ${issues.length} conformance issue(s); failing open to Core default`,
        { workspaceId: input.workspace.id, issues: issues.slice(0, 8) },
      );
      return coreFallback(winnerId);
    }
    return { readout, selection, droppedProviderId: null };
  } catch (error) {
    console.error(
      `[shell-experience] mainline provider ${winnerId} buildMainline threw; failing open to Core default`,
      error,
    );
    return coreFallback(winnerId);
  }
}

// ---------------------------------------------------------------------------
// Concat surfaces: northstar KPIs + attention feed (blueprint §4.2 / §4.4)
// ---------------------------------------------------------------------------

/** Experimental concat-surface contract versions (exact-match compat, §4.3.2). */
export const SHELL_NORTHSTAR_KPI_CONTRACT_VERSION = "northstar-kpi.v1-experimental";
export const SHELL_ATTENTION_CONTRACT_VERSION = "attention.v1-experimental";

export const SHELL_ATTENTION_SURFACE_KEY = "attention";
export const SHELL_NORTHSTAR_KPI_SURFACE_KEY = "northstar-kpi";

/**
 * §4.4 aggregation budget. `SOURCE_TIMEOUT_MS` (matching the access-probe
 * wrapper) is a **per-source** ceiling: on timeout the source's `AbortSignal`
 * is aborted (cooperative providers cancel in-flight work, §4.4 "贯穿取消") and
 * the source is treated as unreturned. `MAX_SOURCES` bounds fan-out.
 *
 * Honest scope note: all eligible sources run concurrently (bounded only by
 * `MAX_SOURCES`), so aggregate wall-time is bounded by the per-source timeout —
 * one straggler cannot extend the whole read. An explicit *aggregate deadline*
 * + a smaller *concurrency pool* become load-bearing only together (a capped
 * pool serializes batches, so the batch total could exceed one source timeout);
 * both are deferred to a future hardening slice and intentionally NOT faked
 * here with an inert timer.
 */
export const SHELL_SURFACE_SOURCE_TIMEOUT_MS = 2_500;
export const SHELL_SURFACE_MAX_SOURCES = 20;

type SourceOutcome<TItem> =
  | { kind: "items"; items: ReadonlyArray<TItem> }
  | { kind: "unreturned"; reason: "timeout" | "error" };

/**
 * Race a source build against a per-source timeout; never throws. The build
 * receives an `AbortSignal` that is aborted when the timeout fires, so a
 * cooperative provider can cancel its in-flight work instead of leaking it.
 */
async function runSourceWithTimeout<TItem>(
  build: (signal: AbortSignal) => Promise<ReadonlyArray<TItem>>,
  timeoutMs: number,
  onError: (error: unknown) => void,
): Promise<SourceOutcome<TItem>> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<SourceOutcome<TItem>>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ kind: "unreturned", reason: "timeout" });
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      build(controller.signal)
        .then((items): SourceOutcome<TItem> => ({ kind: "items", items }))
        .catch((error): SourceOutcome<TItem> => {
          onError(error);
          return { kind: "unreturned", reason: "error" };
        }),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type ShellSourceLike = {
  providerId: string;
  contractVersion: string;
  getAccess: (
    workspace: WorkspaceLike,
    context?: ExtensionAccessContext,
  ) => Promise<{ ok: boolean }>;
};

/** Eligibility for a concat source: access ok (2500ms wrapped) + exact contract match. */
async function resolveEligibleSources<TSource extends ShellSourceLike>(input: {
  sources: ReadonlyArray<TSource>;
  compatVersion: string;
  workspace: WorkspaceLike;
  accessContext?: ExtensionAccessContext;
  maxSources: number;
}): Promise<{ eligible: TSource[]; droppedForCap: number }> {
  // Version-incompatible sources are excluded up front (never enter the set, §4.3.2);
  // a source denied by access is silently skipped (not "unavailable" — it is not yours).
  const compatible = input.sources.filter(
    (s) => s.contractVersion === input.compatVersion,
  );
  const capped = compatible.slice(0, input.maxSources);
  const droppedForCap = compatible.length - capped.length;

  const accessOks = await Promise.all(
    capped.map((source) =>
      resolveReportsExtensionAccessSafely(
        { id: source.providerId, getAccess: source.getAccess },
        input.workspace,
        { accessContext: input.accessContext },
      ).then((access) => access.ok),
    ),
  );
  return {
    eligible: capped.filter((_, index) => accessOks[index]),
    droppedForCap,
  };
}

export type ShellNorthstarKpiResolution = {
  kpis: ReadonlyArray<NorthstarKpi>;
  /** Provider ids whose build failed/timed out (dropped from the merge). */
  unreturnedProviderIds: ReadonlyArray<string>;
  /** Provider ids some of whose items failed conformance and were dropped. */
  nonConformantProviderIds: ReadonlyArray<string>;
  droppedForCap: number;
};

/**
 * Northstar KPIs: merge every eligible source's KPIs (concat). Each source runs
 * under the per-source timeout; failed/timed-out sources are dropped (KPIs have
 * no "unreturned item" convention — that is attention-specific, §4.4). Each
 * source's items are conformance-filtered (a non-conformant item is dropped,
 * not the whole source). Cross-source dedupe by KPI key (first writer wins).
 * Empty store ⇒ Core default (empty) — mirror parity.
 */
export async function resolveShellNorthstarKpis(input: {
  workspace: WorkspaceLike;
  english: boolean;
  accessContext?: ExtensionAccessContext;
}): Promise<ShellNorthstarKpiResolution> {
  const sources = getRegisteredNorthstarKpiSources();
  if (sources.length === 0) {
    return {
      kpis: buildCoreDefaultNorthstarKpis(),
      unreturnedProviderIds: [],
      nonConformantProviderIds: [],
      droppedForCap: 0,
    };
  }

  const { eligible, droppedForCap } = await resolveEligibleSources({
    sources: sources as ReadonlyArray<NorthstarKpiSourceContribution>,
    compatVersion: SHELL_NORTHSTAR_KPI_CONTRACT_VERSION,
    workspace: input.workspace,
    accessContext: input.accessContext,
    maxSources: SHELL_SURFACE_MAX_SOURCES,
  });

  const unreturnedProviderIds: string[] = [];
  const nonConformantProviderIds: string[] = [];
  const merged: NorthstarKpi[] = [];
  const seenKeys = new Set<string>();

  const outcomes = await Promise.all(
    eligible.map(async (source) => ({
      providerId: source.providerId,
      outcome: await runSourceWithTimeout(
        (signal) =>
          source.buildKpis({
            workspace: input.workspace,
            english: input.english,
            signal,
          }),
        SHELL_SURFACE_SOURCE_TIMEOUT_MS,
        (error) =>
          console.error(
            `[shell-experience] northstar-kpi source ${source.providerId} buildKpis threw; dropping source`,
            error,
          ),
      ),
    })),
  );

  for (const { providerId, outcome } of outcomes) {
    if (outcome.kind === "unreturned") {
      unreturnedProviderIds.push(providerId);
      continue;
    }
    const issues = validateNorthstarKpis(outcome.items);
    const badKeys = new Set(
      issues.map((i) => i.kpiKey).filter((k): k is string => k !== null),
    );
    if (issues.length > 0) nonConformantProviderIds.push(providerId);
    for (const kpi of outcome.items) {
      if (badKeys.has(kpi.key)) continue; // drop only the offending item
      if (seenKeys.has(kpi.key)) continue; // cross-source dedupe, first writer wins
      seenKeys.add(kpi.key);
      merged.push(kpi);
    }
  }

  return {
    kpis: merged,
    unreturnedProviderIds,
    nonConformantProviderIds,
    droppedForCap,
  };
}

export type ShellAttentionResolution = {
  items: ReadonlyArray<AttentionItem>;
  unreturnedProviderIds: ReadonlyArray<string>;
  nonConformantProviderIds: ReadonlyArray<string>;
  droppedForCap: number;
};

/**
 * Attention feed: concurrently collect every eligible source under the §4.4
 * budget (per-source 2500ms timeout; each source's `AbortSignal` is aborted on
 * its own timeout so cooperative providers cancel in-flight work), merge,
 * dedupe cross-source by `providerId::item.key`, drop non-conformant items
 * (fail-closed on suspected PII), and render an "unreturned source" item for
 * any eligible source that misses the budget (§4.4 — never silently swallowed).
 * Empty store ⇒ Core default (empty) — mirror parity.
 */
export async function resolveShellAttention(input: {
  workspace: WorkspaceLike;
  english: boolean;
  roleCategory?: string | null;
  accessContext?: ExtensionAccessContext;
}): Promise<ShellAttentionResolution> {
  const sources = getRegisteredAttentionSources();
  if (sources.length === 0) {
    return {
      items: buildCoreDefaultAttention(),
      unreturnedProviderIds: [],
      nonConformantProviderIds: [],
      droppedForCap: 0,
    };
  }

  const { eligible, droppedForCap } = await resolveEligibleSources({
    sources: sources as ReadonlyArray<AttentionSourceContribution>,
    compatVersion: SHELL_ATTENTION_CONTRACT_VERSION,
    workspace: input.workspace,
    accessContext: input.accessContext,
    maxSources: SHELL_SURFACE_MAX_SOURCES,
  });

  const unreturnedProviderIds: string[] = [];
  const nonConformantProviderIds: string[] = [];
  const merged: AttentionItem[] = [];
  const seenKeys = new Set<string>();

  const outcomes = await Promise.all(
    eligible.map(async (source) => ({
      providerId: source.providerId,
      outcome: await runSourceWithTimeout(
        (signal) =>
          source.buildAttention({
            workspace: input.workspace,
            english: input.english,
            roleCategory: input.roleCategory ?? null,
            signal,
          }),
        SHELL_SURFACE_SOURCE_TIMEOUT_MS,
        (error) =>
          console.error(
            `[shell-experience] attention source ${source.providerId} buildAttention threw; showing unreturned item`,
            error,
          ),
      ),
    })),
  );

  for (const { providerId, outcome } of outcomes) {
    if (outcome.kind === "unreturned") {
      unreturnedProviderIds.push(providerId);
      merged.push(
        makeUnreturnedSourceItem({ providerId, english: input.english, reason: outcome.reason }),
      );
      continue;
    }
    const issues = validateAttentionItems(outcome.items);
    const badKeys = new Set(
      issues.map((i) => i.itemKey).filter((k): k is string => k !== null),
    );
    if (issues.length > 0) nonConformantProviderIds.push(providerId);
    for (const item of outcome.items) {
      if (badKeys.has(item.key)) continue; // drop only the offending item (fail-closed on PII)
      const dedupeKey = attentionDedupeKey(providerId, item);
      if (seenKeys.has(dedupeKey)) continue; // cross-source dedupe
      seenKeys.add(dedupeKey);
      merged.push(item);
    }
  }

  return {
    items: merged,
    unreturnedProviderIds,
    nonConformantProviderIds,
    droppedForCap,
  };
}

// ---------------------------------------------------------------------------
// Concat surface: operation suggestions (blueprint Phase 4)
// ---------------------------------------------------------------------------

export const SHELL_OPERATION_SUGGESTION_CONTRACT_VERSION =
  "operation-suggestion.v1-experimental";
export const SHELL_OPERATION_SUGGESTION_SURFACE_KEY = "operation-suggestion";

export type ShellOperationSuggestionResolution = {
  suggestions: ReadonlyArray<OperationSuggestion>;
  /** Provider ids whose build failed/timed out (dropped from the merge). */
  unreturnedProviderIds: ReadonlyArray<string>;
  /** Provider ids some of whose items failed conformance and were dropped. */
  nonConformantProviderIds: ReadonlyArray<string>;
  droppedForCap: number;
};

/**
 * Operation suggestions: merge every eligible source's suggestions (concat).
 * Same §4.4 budget as the other concat surfaces (per-source timeout with
 * per-source AbortSignal; failed/timed-out sources dropped and recorded — no
 * "unreturned item" convention here). Each source's items are
 * conformance-filtered (a non-conformant / suspected-secret / suspected-PII
 * item is dropped, not the whole source — fail-closed). Cross-source dedupe by
 * suggestion key (first writer wins). Empty store ⇒ Core default (empty) —
 * mirror parity. Read/navigate-only: suggestion ≠ execution.
 */
export async function resolveShellOperationSuggestions(input: {
  workspace: WorkspaceLike;
  english: boolean;
  accessContext?: ExtensionAccessContext;
}): Promise<ShellOperationSuggestionResolution> {
  const sources = getRegisteredOperationSuggestionSources();
  if (sources.length === 0) {
    return {
      suggestions: buildCoreDefaultOperationSuggestions(),
      unreturnedProviderIds: [],
      nonConformantProviderIds: [],
      droppedForCap: 0,
    };
  }

  const { eligible, droppedForCap } = await resolveEligibleSources({
    sources: sources as ReadonlyArray<OperationSuggestionSourceContribution>,
    compatVersion: SHELL_OPERATION_SUGGESTION_CONTRACT_VERSION,
    workspace: input.workspace,
    accessContext: input.accessContext,
    maxSources: SHELL_SURFACE_MAX_SOURCES,
  });

  const unreturnedProviderIds: string[] = [];
  const nonConformantProviderIds: string[] = [];
  const merged: OperationSuggestion[] = [];
  const seenKeys = new Set<string>();

  const outcomes = await Promise.all(
    eligible.map(async (source) => ({
      providerId: source.providerId,
      outcome: await runSourceWithTimeout(
        (signal) =>
          source.buildOperationSuggestions({
            workspace: input.workspace,
            english: input.english,
            signal,
          }),
        SHELL_SURFACE_SOURCE_TIMEOUT_MS,
        (error) =>
          console.error(
            `[shell-experience] operation-suggestion source ${source.providerId} build threw; dropping source`,
            error,
          ),
      ),
    })),
  );

  for (const { providerId, outcome } of outcomes) {
    if (outcome.kind === "unreturned") {
      unreturnedProviderIds.push(providerId);
      continue;
    }
    const issues = validateOperationSuggestions(outcome.items);
    const badKeys = new Set(
      issues.map((i) => i.suggestionKey).filter((k): k is string => k !== null),
    );
    if (issues.length > 0) nonConformantProviderIds.push(providerId);
    for (const suggestion of outcome.items) {
      if (badKeys.has(suggestion.key)) continue; // drop only the offending item (fail-closed on secret/PII)
      if (seenKeys.has(suggestion.key)) continue; // cross-source dedupe, first writer wins
      seenKeys.add(suggestion.key);
      merged.push(suggestion);
    }
  }

  return {
    suggestions: merged,
    unreturnedProviderIds,
    nonConformantProviderIds,
    droppedForCap,
  };
}
