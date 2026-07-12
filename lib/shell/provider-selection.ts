/**
 * 单一生效 provider 的选择语义（内部化，蓝图 §4.3）。
 *
 * 原则：**绑定即授权；无绑定即 Core。**
 * - 无显式、有效、surface-scoped 的绑定 → 一律 Core default。
 * - priority 只用于诊断排序与候选推荐，不参与运行时自动接管。
 * - 绑定失效/越权/版本不兼容 → 回 Core + 冲突回执（诊断可见）。
 * - 绑定操作的授权在写入面由 capability evaluator（MANAGE_WORKSPACE_SETUP）
 *   把关；本模块是纯选择逻辑，不做权限判定。
 */

export type ProviderCandidate = {
  providerId: string;
  contractVersion: string;
  priority: number;
  provenance: string;
  enabled: boolean;
  accessOk: boolean;
  contractCompatible: boolean;
};

export type SurfaceBinding = {
  surfaceKey: string;
  providerId: string;
};

export type ConflictReceipt = {
  surfaceKey: string;
  reason:
    | "binding_provider_not_found"
    | "binding_provider_not_eligible"
    | "binding_surface_mismatch"
    | "duplicate_provider_id"
    | "multiple_top_recommendations_without_binding";
  detail: string;
};

export type ProviderSelection = {
  winner: "core_default" | { providerId: string };
  source: "core_default" | "binding";
  /** 诊断排序用的候选推荐（priority 降序，仅展示，不自动接管） */
  recommendations: ReadonlyArray<string>;
  conflictReceipt: ConflictReceipt | null;
};

export function isEligible(candidate: ProviderCandidate): boolean {
  return (
    candidate.enabled &&
    candidate.accessOk &&
    candidate.contractCompatible &&
    Number.isFinite(candidate.priority)
  );
}

export function selectSingleWinner(input: {
  surfaceKey: string;
  candidates: ReadonlyArray<ProviderCandidate>;
  binding: SurfaceBinding | null;
}): ProviderSelection {
  const { surfaceKey, binding } = input;
  // 重复 providerId 属注册面缺陷：整组重复者全部剔除并出回执，不隐式取先者。
  const idCounts = new Map<string, number>();
  for (const c of input.candidates) {
    idCounts.set(c.providerId, (idCounts.get(c.providerId) ?? 0) + 1);
  }
  const duplicateIds = [...idCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => id);
  const candidates = input.candidates.filter(
    (c) => !duplicateIds.includes(c.providerId),
  );
  const duplicateReceipt: ConflictReceipt | null = duplicateIds.length
    ? {
        surfaceKey,
        reason: "duplicate_provider_id",
        detail: `duplicates=${duplicateIds.join(",")}`,
      }
    : null;
  const eligible = candidates.filter(isEligible);
  const recommendations = [...eligible]
    .sort(
      (a, b) =>
        b.priority - a.priority || a.providerId.localeCompare(b.providerId),
    )
    .map((c) => c.providerId);

  // 诊断信号（不影响选择结果）：无绑定/绑定错 surface 时回 Core，并按情况出回执。
  if (!binding || binding.surfaceKey !== surfaceKey) {
    let conflictReceipt: ConflictReceipt | null = duplicateReceipt;
    if (binding && binding.surfaceKey !== surfaceKey) {
      conflictReceipt = {
        surfaceKey,
        reason: "binding_surface_mismatch",
        detail: `binding.surfaceKey=${binding.surfaceKey} bound=${binding.providerId}`,
      };
    } else if (!conflictReceipt) {
      const topPriority = eligible.length
        ? Math.max(...eligible.map((c) => c.priority))
        : null;
      const tied = eligible.filter((c) => c.priority === topPriority);
      if (tied.length > 1) {
        conflictReceipt = {
          surfaceKey,
          reason: "multiple_top_recommendations_without_binding",
          detail: `candidates=${tied.map((c) => c.providerId).join(",")}`,
        };
      }
    }
    return {
      winner: "core_default",
      source: "core_default",
      recommendations,
      conflictReceipt,
    };
  }

  const bound = candidates.find((c) => c.providerId === binding.providerId);
  if (!bound) {
    return {
      winner: "core_default",
      source: "core_default",
      recommendations,
      conflictReceipt: {
        surfaceKey,
        reason: "binding_provider_not_found",
        detail: `bound=${binding.providerId}`,
      },
    };
  }
  if (!isEligible(bound)) {
    return {
      winner: "core_default",
      source: "core_default",
      recommendations,
      conflictReceipt: {
        surfaceKey,
        reason: "binding_provider_not_eligible",
        detail: `bound=${binding.providerId} enabled=${bound.enabled} access=${bound.accessOk} compatible=${bound.contractCompatible}`,
      },
    };
  }
  return {
    winner: { providerId: bound.providerId },
    source: "binding",
    recommendations,
    conflictReceipt: null,
  };
}
