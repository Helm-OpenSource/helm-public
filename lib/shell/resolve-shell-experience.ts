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

import { getRegisteredMainlineProviders } from "@/lib/extensions/registry-contract";
import { resolveReportsExtensionAccessSafely } from "@/lib/extensions/registry";
import type {
  ExtensionAccessContext,
  WorkspaceLike,
} from "@/lib/extensions/registry-types";

import {
  buildCoreDefaultMainline,
  validateMainlineReadout,
  type CoreDefaultMainlineInput,
  type MainlineReadout,
} from "./operating-mainline";
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
